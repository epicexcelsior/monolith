import { PublicKey } from "@solana/web3.js";

// --- SOAR Program ---
export const SOAR_PROGRAM_ID = new PublicKey("SoarNNzwQHMwcfdkdLc6kvbkoMSxcHy89gTHrjhJYkk");

// --- Paste from setup-soar.ts output ---
// Run: cd apps/mobile && npx ts-node --esm scripts/setup-soar.ts
// Then replace these placeholder addresses with real ones.
export const SOAR_GAME_ADDRESS = new PublicKey("11111111111111111111111111111111");
export const SOAR_LEADERBOARD_ADDRESS = new PublicKey("11111111111111111111111111111111");
export const SOAR_AUTHORITY_PUBKEY = new PublicKey("11111111111111111111111111111111");

// Achievement addresses — map to our existing achievement IDs in achievement-store.ts
export const SOAR_ACHIEVEMENTS: Record<string, PublicKey> = {
  first_claim: new PublicKey("11111111111111111111111111111111"),
  streak_3: new PublicKey("11111111111111111111111111111111"),
  streak_7: new PublicKey("11111111111111111111111111111111"),
  streak_14: new PublicKey("11111111111111111111111111111111"),
  streak_30: new PublicKey("11111111111111111111111111111111"),
  top_10: new PublicKey("11111111111111111111111111111111"),
  multi_block: new PublicKey("11111111111111111111111111111111"),
};

// HACKATHON ONLY: Authority keypair for client-side score submission.
// In production, move to server-side behind POST /api/soar/score.
// This key only controls a SOAR game registration (no funds at risk).
export const SOAR_AUTHORITY_SECRET = new Uint8Array([
  // Paste the secret key bytes from setup-soar.ts output or:
  //   cat ~/.config/solana/soar-authority.json
]);

// Whether SOAR integration is active (set false to disable without removing code)
export const SOAR_ENABLED = false; // Set true after running setup-soar.ts and pasting addresses
