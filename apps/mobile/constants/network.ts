import { GAME_SERVER_PORT } from "@monolith/common";
import Constants from "expo-constants";

/**
 * Network configuration for multiplayer.
 *
 * ## Build-time vs Runtime
 * - Build-time: Baked into the JS bundle (fast, can't change without rebuild)
 * - Runtime: Fetched from server or config API (flexible, slower first load)
 *
 * ## Current strategy: Build-time with environment variables
 * Set via `eas build --profile production` or local `.env` files.
 *
 * ## Production deployment
 * Server deployed to Railway/Fly/Render with a stable URL.
 * Client built once with `EXPO_PUBLIC_GAME_SERVER_URL` env var.
 *
 * ## Local dev
 * Use ngrok or LAN IP in `.env.local` (gitignored).
 */

// ─── Environment Variables ────────────────────────────────

// For Expo, env vars must be prefixed with EXPO_PUBLIC_ to be accessible client-side
// Set these in:
//   - `.env.local` (local dev, gitignored)
//   - EAS Build secrets (production builds)
//   - eas.json profiles

const GAME_SERVER_URL_FROM_ENV =
  Constants.expoConfig?.extra?.gameServerUrl ||
  process.env.EXPO_PUBLIC_GAME_SERVER_URL;

// ─── Fallback for local dev ───────────────────────────────

const LOCAL_DEV_HOST = "192.168.1.84"; // Your LAN IP (update if needed)
const LOCAL_DEV_URL = `ws://${LOCAL_DEV_HOST}:${GAME_SERVER_PORT}`;

// ─── Exports ──────────────────────────────────────────────

export const GAME_SERVER_URL = GAME_SERVER_URL_FROM_ENV || LOCAL_DEV_URL;

// For debugging
if (__DEV__) {
  console.log(`[Network] Game server: ${GAME_SERVER_URL}`);
  if (!GAME_SERVER_URL_FROM_ENV) {
    console.log("[Network] Using local dev fallback (no EXPO_PUBLIC_GAME_SERVER_URL set)");
  }
}
