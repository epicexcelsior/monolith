import "dotenv/config";
import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { GAME_SERVER_PORT } from "@monolith/common";
import { TowerRoom } from "./rooms/TowerRoom.js";
import { getRecentEvents, getTopPlayers, initSupabase } from "./utils/supabase.js";

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
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Tower info (REST)
app.get("/api/tower", async (_req, res) => {
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

// Recent events
app.get("/api/events", async (req, res) => {
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
app.get("/api/leaderboard", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const players = await getTopPlayers(limit);
    res.json(players);
  } catch (err) {
    console.error("[API] /api/leaderboard error:", err);
    res.json([]);
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
