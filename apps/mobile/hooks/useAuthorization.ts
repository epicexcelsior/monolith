/**
 * useAuthorization — Core MWA authorization hook.
 *
 * Provides connect(), disconnect(), and hydrateCachedAuth() functions
 * for wallet connection lifecycle management.
 *
 * Follows the official Solana Mobile patterns:
 * - Authorization: https://docs.solanamobile.com/react-native/using_mobile_wallet_adapter#connecting-to-a-wallet
 * - Auth caching: https://docs.solanamobile.com/react-native/storing_mwa_auth
 * - Deauthorize: https://docs.solanamobile.com/react-native/using_mobile_wallet_adapter#deauthorizing-a-wallet
 *
 * Design decisions:
 * - Uses expo-secure-store (encrypted) instead of AsyncStorage for auth token storage
 * - Stores walletUriBase for deep-linking to the same wallet on subsequent connects
 * - Handles auth_token expiration gracefully (falls through to fresh authorize)
 */

import { useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

import {
  APP_IDENTITY,
  getMwaCluster,
  base64ToPublicKey,
  SECURE_STORE_KEYS,
} from "@/services/mwa";
import { useWalletStore } from "@/stores/wallet-store";

// ---------------------------------------------------------------------------
// Error messages — user-friendly strings for known MWA failure modes
// ---------------------------------------------------------------------------
const ERROR_MESSAGES = {
  NO_WALLET:
    "No compatible wallet found on this device. Please install a Solana wallet app.",
  USER_REJECTED: "Connection was cancelled.",
  AUTHORIZATION_FAILED: "Wallet authorization failed. Please try again.",
  UNEXPECTED: "Something went wrong. Please try again.",
} as const;

/**
 * Classifies an MWA error into a user-friendly message.
 */
function classifyError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    // User declined the authorization request
    if (
      msg.includes("declined") ||
      msg.includes("cancelled") ||
      msg.includes("canceled")
    ) {
      return ERROR_MESSAGES.USER_REJECTED;
    }

    // No MWA-compatible wallet found on device
    if (
      msg.includes("no compatible wallet") ||
      msg.includes("found no installed")
    ) {
      return ERROR_MESSAGES.NO_WALLET;
    }

    // IllegalStateException — device has no PIN/biometric set up
    if (msg.includes("illegalstateexception")) {
      return "Device security (PIN or biometric) is required. Please set it up in Settings.";
    }

    // Authorization-specific failures
    if (msg.includes("authorization") || msg.includes("authorize")) {
      return ERROR_MESSAGES.AUTHORIZATION_FAILED;
    }
  }

  return ERROR_MESSAGES.UNEXPECTED;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useAuthorization() {
  const { setConnected, setDisconnected, setLoading, setError } =
    useWalletStore();

  /**
   * Connect to a wallet via MWA.
   *
   * Flow:
   * 1. Check for cached auth token (for seamless re-auth)
   * 2. Open MWA transact session → wallet.authorize()
   * 3. If auth_token is valid, user skips approval dialog
   * 4. Cache new auth details in expo-secure-store
   * 5. Update Zustand store
   *
   * If the cached auth_token is invalid/expired, the wallet will
   * show the full approval dialog — this is handled transparently
   * by the MWA protocol.
   */
  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Retrieve cached auth token for seamless re-authorization
      const cachedAuthToken = await SecureStore.getItemAsync(
        SECURE_STORE_KEYS.AUTH_TOKEN,
      );

      // Retrieve cached wallet URI base to deep-link to the same wallet
      const cachedWalletUriBase = await SecureStore.getItemAsync(
        SECURE_STORE_KEYS.WALLET_URI_BASE,
      );

      const result = await transact(
        async (wallet: Web3MobileWallet) => {
          const authResult = await wallet.authorize({
            identity: APP_IDENTITY,
            chain: getMwaCluster(),
            auth_token: cachedAuthToken ?? undefined,
          });
          return authResult;
        },
        // If we have a cached wallet URI base, pass it to transact()
        // so it deep-links directly to that wallet instead of showing picker
        cachedWalletUriBase ? { baseUri: cachedWalletUriBase } : undefined,
      );

      // MWA returns accounts as base64 — convert to PublicKey
      const account = result.accounts[0];
      const pubkey = base64ToPublicKey(account.address);

      // Cache authorization details for next session
      await Promise.all([
        SecureStore.setItemAsync(
          SECURE_STORE_KEYS.AUTH_TOKEN,
          result.auth_token,
        ),
        SecureStore.setItemAsync(
          SECURE_STORE_KEYS.BASE64_ADDRESS,
          account.address,
        ),
        SecureStore.setItemAsync(
          SECURE_STORE_KEYS.WALLET_URI_BASE,
          result.wallet_uri_base,
        ),
      ]);

      // Update global state
      setConnected({
        publicKey: pubkey,
        authToken: result.auth_token,
        base64Address: account.address,
        walletUriBase: result.wallet_uri_base,
      });

      return pubkey;
    } catch (err) {
      const userMessage = classifyError(err);
      setError(userMessage);
      console.error("MWA connect failed:", err);
      throw err;
    }
  }, [setConnected, setLoading, setError]);

  /**
   * Disconnect the current wallet via MWA deauthorize.
   *
   * Always clears local state even if deauthorize fails (wallet
   * might not be available). This follows the official pattern:
   * https://docs.solanamobile.com/react-native/storing_mwa_auth#clear-cache-on-deauthorize
   */
  const disconnect = useCallback(async () => {
    setLoading(true);

    const cachedAuthToken = await SecureStore.getItemAsync(
      SECURE_STORE_KEYS.AUTH_TOKEN,
    );

    // Try to deauthorize with the wallet (best-effort)
    if (cachedAuthToken) {
      try {
        await transact(async (wallet: Web3MobileWallet) => {
          await wallet.deauthorize({ auth_token: cachedAuthToken });
        });
      } catch (err) {
        // Wallet might be uninstalled or unavailable — that's OK.
        // We still want to clear local state.
        console.warn(
          "MWA deauthorize failed (wallet may be unavailable):",
          err,
        );
      }
    }

    // Always clear local cache and state
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_STORE_KEYS.AUTH_TOKEN),
      SecureStore.deleteItemAsync(SECURE_STORE_KEYS.BASE64_ADDRESS),
      SecureStore.deleteItemAsync(SECURE_STORE_KEYS.WALLET_URI_BASE),
    ]);

    setDisconnected();
  }, [setDisconnected, setLoading]);

  /**
   * Hydrate wallet state from cached auth on app boot.
   *
   * This is called once from _layout.tsx on mount. If we have a
   * cached auth token and address, the user appears "connected"
   * immediately without being prompted.
   *
   * The cached auth_token will be validated the next time we need
   * to sign something — if it's expired, the wallet will show
   * the approval dialog at that point.
   *
   * @param skipIfFirstLaunch If true, won't hydrate for users who haven't
   *   completed onboarding yet. Those users should go through the full
   *   onboarding flow before being prompted to connect.
   */
  const hydrateCachedAuth = useCallback(
    async (skipIfFirstLaunch = true) => {
      // Check if user has completed onboarding
      if (skipIfFirstLaunch) {
        const hasOnboarded = await SecureStore.getItemAsync(
          SECURE_STORE_KEYS.HAS_COMPLETED_ONBOARDING,
        );
        if (!hasOnboarded) {
          // First-time user — skip hydration, let onboarding handle it
          return;
        }
      }

      const [cachedAuthToken, cachedBase64Address, cachedWalletUriBase] =
        await Promise.all([
          SecureStore.getItemAsync(SECURE_STORE_KEYS.AUTH_TOKEN),
          SecureStore.getItemAsync(SECURE_STORE_KEYS.BASE64_ADDRESS),
          SecureStore.getItemAsync(SECURE_STORE_KEYS.WALLET_URI_BASE),
        ]);

      if (cachedAuthToken && cachedBase64Address) {
        const pubkey = base64ToPublicKey(cachedBase64Address);
        setConnected({
          publicKey: pubkey,
          authToken: cachedAuthToken,
          base64Address: cachedBase64Address,
          walletUriBase: cachedWalletUriBase ?? "",
        });
      }
    },
    [setConnected],
  );

  /**
   * Mark onboarding as complete. Should be called after the user
   * finishes the tutorial/onboarding flow.
   */
  const completeOnboarding = useCallback(async () => {
    await SecureStore.setItemAsync(
      SECURE_STORE_KEYS.HAS_COMPLETED_ONBOARDING,
      "true",
    );
  }, []);

  /**
   * Check if the user has completed onboarding.
   */
  const hasCompletedOnboarding = useCallback(async (): Promise<boolean> => {
    const val = await SecureStore.getItemAsync(
      SECURE_STORE_KEYS.HAS_COMPLETED_ONBOARDING,
    );
    return val === "true";
  }, []);

  return {
    connect,
    disconnect,
    hydrateCachedAuth,
    completeOnboarding,
    hasCompletedOnboarding,
  };
}
