/**
 * Tests for wallet signature verification (auth.ts).
 *
 * Covers: nonce generation/consumption, signature verification,
 * expired nonces, invalid signatures, and wrong wallet rejection.
 */

import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import {
  generateNonce,
  consumeNonce,
  verifyWalletSignature,
} from "../src/utils/auth.js";

describe("nonce management", () => {
  it("generates and consumes a nonce", () => {
    const nonce = generateNonce("session-1");
    expect(nonce).toBeTruthy();
    expect(typeof nonce).toBe("string");

    const consumed = consumeNonce("session-1");
    expect(consumed).toBe(nonce);
  });

  it("returns null on second consume (single-use)", () => {
    generateNonce("session-2");
    consumeNonce("session-2");
    const second = consumeNonce("session-2");
    expect(second).toBeNull();
  });

  it("returns null for nonexistent session", () => {
    expect(consumeNonce("nonexistent")).toBeNull();
  });

  it("returns null for expired nonce", () => {
    // Manually expire by setting Date.now ahead
    const originalNow = Date.now;
    generateNonce("session-expire");

    // Fast-forward 61 seconds
    Date.now = () => originalNow() + 61_000;
    const result = consumeNonce("session-expire");
    expect(result).toBeNull();

    Date.now = originalNow;
  });

  it("generates unique nonces per session", () => {
    const nonce1 = generateNonce("session-a");
    const nonce2 = generateNonce("session-b");
    expect(nonce1).not.toBe(nonce2);
  });
});

describe("verifyWalletSignature", () => {
  let keypair: nacl.SignKeyPair;
  let walletAddress: string;

  beforeAll(() => {
    keypair = nacl.sign.keyPair();
    walletAddress = new PublicKey(keypair.publicKey).toBase58();
  });

  it("verifies a valid signature", () => {
    const nonce = "test-nonce-12345";
    const messageBytes = new TextEncoder().encode(nonce);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);

    expect(verifyWalletSignature(walletAddress, nonce, signature)).toBe(true);
  });

  it("rejects an invalid signature (all zeros)", () => {
    const nonce = "test-nonce-12345";
    const invalidSig = new Uint8Array(64);

    expect(verifyWalletSignature(walletAddress, nonce, invalidSig)).toBe(false);
  });

  it("rejects a signature signed with a different nonce", () => {
    const originalNonce = "original-nonce";
    const messageBytes = new TextEncoder().encode(originalNonce);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);

    expect(verifyWalletSignature(walletAddress, "different-nonce", signature)).toBe(false);
  });

  it("rejects a signature from a different wallet", () => {
    const nonce = "test-nonce";
    const messageBytes = new TextEncoder().encode(nonce);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);

    const otherKeypair = nacl.sign.keyPair();
    const otherWallet = new PublicKey(otherKeypair.publicKey).toBase58();

    expect(verifyWalletSignature(otherWallet, nonce, signature)).toBe(false);
  });

  it("handles invalid wallet address gracefully", () => {
    const sig = new Uint8Array(64);
    expect(verifyWalletSignature("not-a-valid-address", "nonce", sig)).toBe(false);
  });

  it("handles empty signature gracefully", () => {
    const sig = new Uint8Array(0);
    expect(verifyWalletSignature(walletAddress, "nonce", sig)).toBe(false);
  });
});

describe("full auth flow", () => {
  it("generates nonce, signs it, and verifies successfully", () => {
    const keypair = nacl.sign.keyPair();
    const wallet = new PublicKey(keypair.publicKey).toBase58();

    // Server generates nonce
    const nonce = generateNonce("full-flow-session");

    // Client signs the nonce
    const messageBytes = new TextEncoder().encode(nonce);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);

    // Server consumes nonce and verifies
    const consumed = consumeNonce("full-flow-session");
    expect(consumed).toBe(nonce);
    expect(verifyWalletSignature(wallet, consumed!, signature)).toBe(true);
  });

  it("blocks replay attack (nonce already consumed)", () => {
    const keypair = nacl.sign.keyPair();
    const wallet = new PublicKey(keypair.publicKey).toBase58();

    const nonce = generateNonce("replay-session");
    const messageBytes = new TextEncoder().encode(nonce);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);

    // First verification succeeds
    const consumed = consumeNonce("replay-session");
    expect(consumed).toBe(nonce);
    expect(verifyWalletSignature(wallet, consumed!, signature)).toBe(true);

    // Second attempt — nonce already consumed
    const replay = consumeNonce("replay-session");
    expect(replay).toBeNull();
  });
});
