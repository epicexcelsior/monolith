/**
 * App-wide configuration constants.
 * Reads from environment variables with sensible defaults.
 */

export const CONFIG = {
  solana: {
    rpcUrl:
      process.env.EXPO_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
    network: process.env.EXPO_PUBLIC_SOLANA_NETWORK || "devnet",
    programId: process.env.EXPO_PUBLIC_MONOLITH_PROGRAM_ID || "",
  },
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
  },
  gameServer: {
    url: process.env.EXPO_PUBLIC_GAME_SERVER_URL || "ws://localhost:2567",
  },
} as const;
