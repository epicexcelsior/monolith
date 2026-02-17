import { GAME_SERVER_PORT } from "@monolith/common";

/**
 * Network configuration for multiplayer.
 *
 * Set EXPO_PUBLIC_GAME_SERVER_URL in .env.local:
 *   - USB dev:    ws://localhost:2567   (with adb reverse — use ./dev.sh)
 *   - WiFi dev:   ws://10.0.0.245:2567 (same network)
 *   - ngrok:      ws://x.tcp.ngrok.io:PORT
 *   - Production: wss://your-server.railway.app
 */

const FALLBACK_URL = `ws://localhost:${GAME_SERVER_PORT}`;

export const GAME_SERVER_URL =
  process.env.EXPO_PUBLIC_GAME_SERVER_URL || FALLBACK_URL;
