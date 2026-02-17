import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { GAME_SERVER_PORT } from "@monolith/common";
import { TowerRoom } from "./rooms/TowerRoom.js";

/**
 * Monolith Game Server
 *
 * Responsibilities:
 * 1. Manage tower state and broadcast updates via WebSocket
 * 2. Run decay ticks (energy drains every 60s)
 * 3. Run simulation bots for demo
 * 4. Serve health/status via REST
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

const httpServer = createServer(app);

// Colyseus game server
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("tower", TowerRoom);

const port = Number(process.env.PORT) || GAME_SERVER_PORT;
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`🗼 Monolith Game Server running on 0.0.0.0:${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   Tower:  http://localhost:${port}/api/tower`);
  console.log(`   WS:     ws://localhost:${port}`);
});
