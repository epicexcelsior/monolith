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
  getMwaChain,
  base64ToPublicKey,
  SECURE_STORE_KEYS,
} from "@/services/mwa";
import { useWalletStore } from "@/stores/wallet-store";
import { usePlayerStore } from "@/stores/player-store";
import { useTapestryStore } from "@/stores/tapestry-store";
import { findOrCreateProfile, searchProfiles, getSocialCounts } from "@/utils/tapestry";
import { buildPlayerInitTransactions, markPlayerInitialized } from "@/utils/soar";
import { PublicKey } from "@solana/web3.js";

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
// Tapestry — fire-and-forget profile bootstrap
// ---------------------------------------------------------------------------
function bootstrapTapestryProfile(walletAddress: string): void {
  (async () => {
    try {
      const username =
        usePlayerStore.getState().username || `player-${walletAddress.slice(0, 8)}`;

      // Check for cross-app Tapestry profiles (pre-fill username)
      let externalUsername: string | undefined;
      try {
        const search = await searchProfiles(walletAddress, true);
        externalUsername = search?.profiles?.[0]?.username;
      } catch {
        /* cross-app search is optional */
      }

      let result;
      try {
        result = await findOrCreateProfile(
          walletAddress,
          externalUsername || username,
          "Keeper on The Monolith",
        );
      } catch {
        // External username may collide with existing profile — retry with wallet-derived name
        result = await findOrCreateProfile(
          walletAddress,
          username,
          "Keeper on The Monolith",
        );
      }

      useTapestryStore.getState().setProfile(
        result.profile.id,
        result.profile,
      );

      // Social counts are a separate endpoint
      getSocialCounts(walletAddress)
        .then((counts) => useTapestryStore.getState().setSocialCounts(counts))
        .catch(console.warn);

      // Bootstrap bot profiles so social features work on bot blocks
      bootstrapBotProfiles(result.profile.id).catch(console.warn);
    } catch (e) {
      console.warn("Tapestry profile creation failed:", e);
    }
  })();
}

// ---------------------------------------------------------------------------
// Bot profile seeding — creates Tapestry profiles for bot personas
// ---------------------------------------------------------------------------
async function bootstrapBotProfiles(userProfileId: string): Promise<void> {
  const flag = await SecureStore.getItemAsync("TAPESTRY_BOTS_SEEDED");
  if (flag) return;

  const { BOT_PERSONAS } = await import("@/utils/seed-tower");
  const { getBotWalletAddress, ensureBlockContent, followProfile: followBot } = await import("@/utils/tapestry");

  // Create profiles for all bots (fire-and-forget each)
  const results = await Promise.allSettled(
    BOT_PERSONAS.map(async (p) => {
      const wallet = getBotWalletAddress(p.name);
      const result = await findOrCreateProfile(wallet, p.name, `Bot keeper on The Monolith`);
      // Create content for their first block so likes work
      await ensureBlockContent(result.profile.id, `bot-${p.name}`, `Claimed a block on The Monolith!`).catch(() => {});
      return result.profile.id;
    }),
  );

  // Auto-follow first 3 successful bots so Social tab has content
  const botIds = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value)
    .slice(0, 3);
  await Promise.allSettled(botIds.map((id) => followBot(userProfileId, id)));

  await SecureStore.setItemAsync("TAPESTRY_BOTS_SEEDED", "true");
}

// ---------------------------------------------------------------------------
// SOAR — fire-and-forget on-chain registration
// ---------------------------------------------------------------------------
function bootstrapSoarRegistration(walletAddress: string, walletUriBase?: string): void {
  (async () => {
    try {
      const pubkey = new PublicKey(walletAddress);
      const username = usePlayerStore.getState().username || walletAddress.slice(0, 8);
      const txs = await buildPlayerInitTransactions(pubkey, username);

      if (txs.length === 0) {
        // Already registered
        markPlayerInitialized(pubkey);
        if (__DEV__) console.log("[SOAR] Player already registered on-chain");
        return;
      }

      if (__DEV__) console.log("[SOAR] Registering player on-chain:", txs.length, "txs");

      // Sign via MWA (opens wallet again — user approves)
      const transactOptions = walletUriBase ? { baseUri: walletUriBase } : undefined;
      const authToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.AUTH_TOKEN);

      // Send each tx in its own MWA session to avoid multi-sig batch issues
      const { Connection } = await import("@solana/web3.js");
      const connection = new Connection("https://api.devnet.solana.com", "confirmed");

      for (let i = 0; i < txs.length; i++) {
        const tx = txs[i];
        const { blockhash } = await connection.getLatestBlockhash();
        tx.feePayer = pubkey;
        tx.recentBlockhash = blockhash;

        await transact(async (wallet: Web3MobileWallet) => {
          authToken
            ? await wallet.reauthorize({ auth_token: authToken, identity: APP_IDENTITY })
            : await wallet.authorize({ chain: getMwaChain(), identity: APP_IDENTITY });

          await wallet.signAndSendTransactions({ transactions: [tx] });
          if (__DEV__) console.log(`[SOAR] Registration tx ${i + 1}/${txs.length} sent`);
        }, transactOptions);
      }

      if (__DEV__) console.log("[SOAR] Player registered on-chain successfully");
      markPlayerInitialized(pubkey);
    } catch (e) {
      // Graceful degradation — scores just won't be submitted on-chain
      console.warn("[SOAR] Registration failed (scores will be local-only):", e);
    }
  })();
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

      const authorizeWithWallet = async (wallet: Web3MobileWallet, authToken?: string) => {
        return wallet.authorize({
          identity: APP_IDENTITY,
          chain: getMwaChain(),
          ...(authToken ? { auth_token: authToken } : {}),
        });
      };

      const transactOptions = cachedWalletUriBase
        ? { baseUri: cachedWalletUriBase }
        : undefined;

      let result;
      try {
        // First attempt: use cached auth token if available (skip approval dialog)
        result = await transact(
          async (wallet: Web3MobileWallet) =>
            authorizeWithWallet(wallet, cachedAuthToken ?? undefined),
          transactOptions,
        );
      } catch (firstErr) {
        // If we had a cached token and it was rejected, retry without it
        // so the wallet shows a fresh approval dialog
        if (cachedAuthToken) {
          console.warn("MWA auth with cached token failed, retrying fresh:", firstErr);
          // Clear the stale token from secure store
          await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.AUTH_TOKEN);
          result = await transact(
            async (wallet: Web3MobileWallet) => authorizeWithWallet(wallet),
            transactOptions,
          );
        } else {
          throw firstErr;
        }
      }

      // MWA returns accounts as base64 — convert to PublicKey
      const account = result.accounts[0];
      const pubkey = base64ToPublicKey(account.address);

      // Cache authorization details for next session
      // NOTE: wallet_uri_base can be undefined on some devices (e.g. Seeker)
      // despite the MWA type declaring it as `string`. Guard before storing
      // since SecureStore only accepts string values.
      const walletUriBase = result.wallet_uri_base ?? "";
      await Promise.all([
        SecureStore.setItemAsync(
          SECURE_STORE_KEYS.AUTH_TOKEN,
          result.auth_token,
        ),
        SecureStore.setItemAsync(
          SECURE_STORE_KEYS.BASE64_ADDRESS,
          account.address,
        ),
        walletUriBase
          ? SecureStore.setItemAsync(
            SECURE_STORE_KEYS.WALLET_URI_BASE,
            walletUriBase,
          )
          : Promise.resolve(),
      ]);

      // Update global state
      setConnected({
        publicKey: pubkey,
        authToken: result.auth_token,
        base64Address: account.address,
        walletUriBase,
      });

      // Tapestry profile — fire-and-forget, never blocks wallet connect
      bootstrapTapestryProfile(pubkey.toBase58());

      // SOAR on-chain registration — fire-and-forget, opens second MWA popup
      bootstrapSoarRegistration(pubkey.toBase58(), walletUriBase);

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

        // Tapestry profile — fire-and-forget on hydration too
        bootstrapTapestryProfile(pubkey.toBase58());

        // SOAR: register on-chain if needed (opens MWA if not registered)
        bootstrapSoarRegistration(pubkey.toBase58(), cachedWalletUriBase ?? undefined);
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
