/**
 * Tests for the Zustand wallet store.
 *
 * Validates state transitions for connect/disconnect/loading/error flows.
 * Uses Zustand's getState()/setState() for deterministic testing
 * without React rendering.
 */

import { PublicKey } from "@solana/web3.js";
import { useWalletStore } from "@/stores/wallet-store";

// Reset store between tests to avoid state leaking
beforeEach(() => {
  useWalletStore.setState({
    isConnected: false,
    publicKey: null,
    authToken: null,
    base64Address: null,
    walletUriBase: null,
    isLoading: false,
    error: null,
  });
});

describe("wallet-store", () => {
  const mockPublicKey = new PublicKey(
    "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  );
  const mockAuthToken = "test-auth-token-abc123";
  const mockBase64Address = Buffer.from(mockPublicKey.toBytes()).toString(
    "base64",
  );
  const mockWalletUriBase = "https://phantom.app";

  describe("setConnected", () => {
    it("should set all wallet fields and clear loading/error", () => {
      // Arrange — set some pre-existing loading state
      useWalletStore.getState().setLoading(true);
      useWalletStore.getState().setError("stale error");

      // Act
      useWalletStore.getState().setConnected({
        publicKey: mockPublicKey,
        authToken: mockAuthToken,
        base64Address: mockBase64Address,
        walletUriBase: mockWalletUriBase,
      });

      // Assert
      const state = useWalletStore.getState();
      expect(state.isConnected).toBe(true);
      expect(state.publicKey?.equals(mockPublicKey)).toBe(true);
      expect(state.authToken).toBe(mockAuthToken);
      expect(state.base64Address).toBe(mockBase64Address);
      expect(state.walletUriBase).toBe(mockWalletUriBase);
      expect(state.isLoading).toBe(false); // Should be cleared
      expect(state.error).toBeNull(); // Should be cleared
    });
  });

  describe("setDisconnected", () => {
    it("should clear all wallet fields", () => {
      // Arrange — start connected
      useWalletStore.getState().setConnected({
        publicKey: mockPublicKey,
        authToken: mockAuthToken,
        base64Address: mockBase64Address,
        walletUriBase: mockWalletUriBase,
      });

      // Act
      useWalletStore.getState().setDisconnected();

      // Assert
      const state = useWalletStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.publicKey).toBeNull();
      expect(state.authToken).toBeNull();
      expect(state.base64Address).toBeNull();
      expect(state.walletUriBase).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("setLoading", () => {
    it("should toggle loading state", () => {
      expect(useWalletStore.getState().isLoading).toBe(false);

      useWalletStore.getState().setLoading(true);
      expect(useWalletStore.getState().isLoading).toBe(true);

      useWalletStore.getState().setLoading(false);
      expect(useWalletStore.getState().isLoading).toBe(false);
    });
  });

  describe("setError", () => {
    it("should set error and clear loading", () => {
      useWalletStore.getState().setLoading(true);
      useWalletStore.getState().setError("Connection failed");

      const state = useWalletStore.getState();
      expect(state.error).toBe("Connection failed");
      expect(state.isLoading).toBe(false); // Loading cleared when error set
    });

    it("should clear error when set to null", () => {
      useWalletStore.getState().setError("Some error");
      useWalletStore.getState().setError(null);

      expect(useWalletStore.getState().error).toBeNull();
    });
  });

  describe("state isolation", () => {
    it("should not affect other fields when setting loading", () => {
      useWalletStore.getState().setConnected({
        publicKey: mockPublicKey,
        authToken: mockAuthToken,
        base64Address: mockBase64Address,
        walletUriBase: mockWalletUriBase,
      });

      useWalletStore.getState().setLoading(true);

      const state = useWalletStore.getState();
      expect(state.isConnected).toBe(true);
      expect(state.publicKey?.equals(mockPublicKey)).toBe(true);
      expect(state.isLoading).toBe(true);
    });
  });
});
