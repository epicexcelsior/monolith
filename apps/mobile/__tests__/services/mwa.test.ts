/**
 * Tests for MWA service utilities.
 *
 * These test pure functions (no MWA/native dependencies) to ensure
 * they work correctly:
 * - base64ToPublicKey conversion
 * - getMwaCluster format
 * - SECURE_STORE_KEYS consistency
 */

import { PublicKey } from "@solana/web3.js";
import {
  base64ToPublicKey,
  getMwaCluster,
  SECURE_STORE_KEYS,
  APP_IDENTITY,
} from "@/services/mwa";

describe("services/mwa", () => {
  describe("base64ToPublicKey", () => {
    it("should convert a base64-encoded address to a PublicKey", () => {
      // A known test keypair: base58 "11111111111111111111111111111111"
      // which is the System Program address, encoded as base64
      const systemProgramBase64 = Buffer.from(
        PublicKey.default.toBytes(),
      ).toString("base64");

      const result = base64ToPublicKey(systemProgramBase64);

      expect(result).toBeInstanceOf(PublicKey);
      expect(result.equals(PublicKey.default)).toBe(true);
    });

    it("should handle a real wallet address", () => {
      // Create a known PublicKey and round-trip it
      const original = new PublicKey(
        "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      );
      const base64 = Buffer.from(original.toBytes()).toString("base64");

      const result = base64ToPublicKey(base64);

      expect(result.equals(original)).toBe(true);
      expect(result.toBase58()).toBe(
        "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      );
    });
  });

  describe("getMwaCluster", () => {
    it("should return a solana: prefixed cluster string", () => {
      const cluster = getMwaCluster();
      expect(cluster).toMatch(/^solana:(devnet|mainnet-beta|testnet)$/);
    });

    it("should default to solana:devnet", () => {
      // In test environment, EXPO_PUBLIC_SOLANA_NETWORK is not set
      const cluster = getMwaCluster();
      expect(cluster).toBe("solana:devnet");
    });
  });

  describe("SECURE_STORE_KEYS", () => {
    it("should have all required keys", () => {
      expect(SECURE_STORE_KEYS).toHaveProperty("AUTH_TOKEN");
      expect(SECURE_STORE_KEYS).toHaveProperty("BASE64_ADDRESS");
      expect(SECURE_STORE_KEYS).toHaveProperty("WALLET_URI_BASE");
      expect(SECURE_STORE_KEYS).toHaveProperty("HAS_COMPLETED_ONBOARDING");
    });

    it("should have unique key values", () => {
      const values = Object.values(SECURE_STORE_KEYS);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });

  describe("APP_IDENTITY", () => {
    it("should have required fields for MWA authorize", () => {
      expect(APP_IDENTITY).toHaveProperty("name");
      expect(APP_IDENTITY).toHaveProperty("uri");
      expect(APP_IDENTITY).toHaveProperty("icon");
      expect(typeof APP_IDENTITY.name).toBe("string");
      expect(typeof APP_IDENTITY.uri).toBe("string");
    });
  });
});
