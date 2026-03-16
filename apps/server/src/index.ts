import "dotenv/config";
import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { GAME_SERVER_PORT } from "@monolith/common";
import { TowerRoom, getActiveRoom, serializeBlock, blockToRow, validateUploadToken } from "./rooms/TowerRoom.js";
import { getRecentEvents, getTopPlayers, initSupabase, upsertBlock, uploadBlockImage } from "./utils/supabase.js";
import blinksRouter from "./routes/blinks.js";

/**
 * Monolith Game Server
 *
 * Responsibilities:
 * 1. Manage tower state and broadcast updates via WebSocket
 * 2. Run decay ticks (energy drains every 60s)
 * 3. Run simulation bots for demo
 * 4. Serve health/status via REST
 * 5. Persist player blocks to Supabase
 *
 * Built on Colyseus for room-based multiplayer.
 */

const app = express();
app.use(express.json({ limit: "2mb" })); // Increased for base64 image uploads

// Static files (Blink icons)
app.use("/static", express.static(path.join(__dirname, "../static")));

// Solana Blinks — mounted BEFORE global cors() so our Actions-spec
// CORS headers (X-Action-Version, X-Blockchain-Ids) aren't stripped
// by Express's default OPTIONS handler
app.use(blinksRouter);

// Global CORS for all other routes
app.use(cors());

// Rate limiters
const readLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false });

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Tower info (REST)
app.get("/api/tower", readLimiter, async (_req, res) => {
  try {
    const rooms = await matchMaker.query({ name: "tower" });
    const totalClients = rooms.reduce((sum: number, r: any) => sum + (r.clients || 0), 0);
    res.json({
      rooms: rooms.length,
      players: totalClients,
    });
  } catch {
    res.json({ rooms: 0, players: 0 });
  }
});

// Tower blocks (for web viewer)
app.get("/api/tower/blocks", readLimiter, (_req, res) => {
  try {
    const room = getActiveRoom();
    if (!room) { res.json([]); return; }
    const blocks: any[] = [];
    (room as any).state.blocks.forEach((b: any) => {
      blocks.push({
        id: b.id,
        layer: b.layer,
        index: b.index,
        energy: b.energy,
        ownerColor: b.ownerColor,
        emoji: b.appearance?.emoji || "",
        name: b.appearance?.name || "",
        isGhost: b.isGhost || false,
        ownerName: b.appearance?.name || "",
      });
    });
    res.json(blocks);
  } catch (err) {
    console.error("[API] /api/tower/blocks error:", err);
    res.json([]);
  }
});

// Recent events
app.get("/api/events", readLimiter, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const events = await getRecentEvents(limit);
    res.json(events);
  } catch (err) {
    console.error("[API] /api/events error:", err);
    res.json([]);
  }
});

// XP Leaderboard
app.get("/api/leaderboard", readLimiter, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const players = await getTopPlayers(limit);
    res.json(players);
  } catch (err) {
    console.error("[API] /api/leaderboard error:", err);
    res.json([]);
  }
});

// Block image upload
app.post("/api/blocks/:blockId/image", writeLimiter, async (req, res) => {
  try {
    const blockId = req.params.blockId as string;
    const { wallet, image, uploadToken } = req.body;

    if (!blockId || !image || typeof image !== "string") {
      res.status(400).json({ error: "Missing blockId or image" });
      return;
    }

    // Validate base64 image size (max ~2MB decoded)
    if (image.length > 2_800_000) {
      res.status(400).json({ error: "Image too large (max 2MB)" });
      return;
    }

    // Sanitize blockId — only allow alphanumeric, dashes, underscores
    if (!/^[\w-]+$/.test(blockId)) {
      res.status(400).json({ error: "Invalid blockId format" });
      return;
    }

    // Authenticate: require a one-time upload token (issued via WS)
    // Falls back to wallet-based ownership check for backward compatibility
    const room = getActiveRoom();
    if (!room) {
      res.status(503).json({ error: "Game room not ready" });
      return;
    }
    const block = room.state.blocks.get(blockId);
    if (!block) {
      res.status(404).json({ error: "Block not found" });
      return;
    }

    if (uploadToken) {
      const tokenWallet = validateUploadToken(uploadToken, blockId);
      if (!tokenWallet) {
        res.status(403).json({ error: "Invalid or expired upload token" });
        return;
      }
      if (block.owner !== tokenWallet) {
        res.status(403).json({ error: "Not your block" });
        return;
      }
    } else if (wallet) {
      // Legacy path — unauthenticated wallet check (log warning)
      console.warn(`[API] Image upload using unauthenticated wallet field for ${blockId} — migrate to upload tokens`);
      if (block.owner !== wallet) {
        res.status(403).json({ error: "Not your block" });
        return;
      }
    } else {
      res.status(400).json({ error: "Missing uploadToken or wallet" });
      return;
    }

    // Decode base64 and upload to Supabase Storage
    const imageBuffer = Buffer.from(image, "base64");
    const imageUrl = await uploadBlockImage(blockId, imageBuffer);

    if (!imageUrl) {
      res.status(500).json({ error: "Upload failed" });
      return;
    }

    // Update in-memory block state, persist, and broadcast
    block.appearance.imageUrl = imageUrl;
    upsertBlock(blockToRow(block)); // fire-and-forget persistence
    room.broadcast("block_update", {
      ...serializeBlock(block),
      eventType: "customize",
    });

    console.log(`[API] Image uploaded for ${blockId}: ${imageUrl.slice(0, 60)}...`);
    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error("[API] /api/blocks/:blockId/image error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const httpServer = createServer(app);

// Colyseus game server
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("tower", TowerRoom);

const port = Number(process.env.PORT) || GAME_SERVER_PORT;
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`🗼 Monolith Game Server running on 0.0.0.0:${port}`);
  initSupabase(); // Eagerly init + verify DB connectivity at startup
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   Tower:  http://localhost:${port}/api/tower`);
  console.log(`   Events: http://localhost:${port}/api/events`);
  console.log(`   WS:     ws://localhost:${port}`);
});
