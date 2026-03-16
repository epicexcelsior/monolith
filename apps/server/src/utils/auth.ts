/**
 * Wallet signature verification for server-side authentication.
 *
 * Flow:
 * 1. Client joins room, server sends `auth_challenge` with a nonce
 * 2. Client signs the nonce with their wallet private key (via MWA signMessages)
 * 3. Client sends `auth_response` with wallet address + signature
 * 4. Server verifies using nacl.sign.detached.verify
 *
 * Nonces are single-use and expire after 60 seconds.
 */

import nacl from "tweetnacl";
import crypto from "crypto";
import { PublicKey } from "@solana/web3.js";

// ─── Nonce Store ─────────────────────────────────────────

const nonceStore = new Map<string, { nonce: string; expires: number }>();
const NONCE_TTL_MS = 60_000; // 60 seconds

/**
 * Generate a cryptographic nonce for a session.
 * Stored internally and consumed on verification.
 */
export function generateNonce(sessionId: string): string {
  const nonce = crypto.randomBytes(32).toString("base64");
  nonceStore.set(sessionId, { nonce, expires: Date.now() + NONCE_TTL_MS });
  return nonce;
}

/**
 * Consume a nonce for a session (single-use).
 * Returns the nonce if valid and not expired, null otherwise.
 */
export function consumeNonce(sessionId: string): string | null {
  const entry = nonceStore.get(sessionId);
  if (!entry) return null;
  nonceStore.delete(sessionId);
  if (Date.now() > entry.expires) return null;
  return entry.nonce;
}

// ─── Signature Verification ─────────────────────────────

/**
 * Verify that a signature was produced by the private key
 * corresponding to the given Solana wallet address.
 *
 * @param walletAddress - Base58-encoded Solana public key
 * @param nonce - The original nonce string that was signed
 * @param signature - The Ed25519 detached signature (64 bytes)
 * @returns true if the signature is valid
 */
export function verifyWalletSignature(
  walletAddress: string,
  nonce: string,
  signature: Uint8Array,
): boolean {
  try {
    const pubkeyBytes = new PublicKey(walletAddress).toBytes();
    const messageBytes = new TextEncoder().encode(nonce);
    return nacl.sign.detached.verify(messageBytes, signature, pubkeyBytes);
  } catch {
    return false;
  }
}
