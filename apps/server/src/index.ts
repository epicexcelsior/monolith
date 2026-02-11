import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { GAME_SERVER_PORT } from "@monolith/common";

/**
 * Monolith Game Server
 *
 * Responsibilities:
 * 1. Manage tower state and broadcast updates via WebSocket
 * 2. Run entropy ticks (every 4 hours, energy drains)
 * 3. Run simulation bots for demo
 * 4. Serve tower state snapshots via REST
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

// Tower state snapshot (REST fallback)
app.get("/api/tower", (_req, res) => {
  res.json({
    message: "Tower state endpoint — will return full tower snapshot",
    totalBlocks: 0,
    occupiedBlocks: 0,
  });
});

const httpServer = createServer(app);

// Colyseus game server
// TODO: Register TowerRoom when game room is implemented
// const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
// gameServer.define('tower', TowerRoom);

const port = GAME_SERVER_PORT;
httpServer.listen(port, () => {
  console.log(`🗼 Monolith Game Server running on port ${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   Tower:  http://localhost:${port}/api/tower`);
});
