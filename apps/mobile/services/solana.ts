import { Connection, clusterApiUrl } from "@solana/web3.js";

/**
 * Solana RPC service.
 *
 * Uses devnet by default. Will switch to mainnet when
 * Drift Protocol integration is ready.
 */

const NETWORK = process.env.EXPO_PUBLIC_SOLANA_NETWORK || "devnet";
const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ||
  "https://solana-devnet.g.alchemy.com/v2/iZggasNITBS_glMXEkk8u";

/**
 * Singleton Solana connection.
 * Reuse this everywhere — don't create multiple connections.
 */
export const connection = new Connection(RPC_URL, "confirmed");

/**
 * Get the current network name.
 */
export function getNetwork() {
  return NETWORK;
}

/**
 * Get the RPC URL being used.
 */
export function getRpcUrl() {
  return RPC_URL;
}
