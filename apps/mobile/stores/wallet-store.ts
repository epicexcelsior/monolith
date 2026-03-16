/**
 * Wallet state store (Zustand).
 *
 * Holds the current wallet connection state. All UI components
 * read from here — the `useAuthorization` hook writes to it.
 *
 * We use Zustand (not React Context) per project conventions:
 * one store per domain, directly importable without wrapping providers.
 */

import { create } from "zustand";
import { PublicKey } from "@solana/web3.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface WalletState {
  /** Whether a wallet is actively connected */
  isConnected: boolean;

  /** The connected wallet's public key (null when disconnected) */
  publicKey: PublicKey | null;

  /** MWA auth token for re-authorization without user approval */
  authToken: string | null;

  /** MWA base64-encoded wallet address (needed for signing APIs) */
  base64Address: string | null;

  /**
   * Wallet URI base — used to deep-link directly to the same wallet
   * app on subsequent connections, skipping the wallet picker.
   * @see https://docs.solanamobile.com/react-native/using_mobile_wallet_adapter#connecting-to-a-wallet
   */
  walletUriBase: string | null;

  /** True while an MWA transaction is in progress */
  isLoading: boolean;

  /** User-facing error message from the last failed MWA operation */
  error: string | null;

  /** Whether the connect sheet is visible */
  showConnectSheet: boolean;
}

interface WalletActions {
  /** Set wallet as connected with all MWA authorization details */
  setConnected: (params: {
    publicKey: PublicKey;
    authToken: string;
    base64Address: string;
    walletUriBase: string;
  }) => void;

  /** Clear all wallet state (disconnect) */
  setDisconnected: () => void;

  /** Toggle loading indicator */
  setLoading: (loading: boolean) => void;

  /** Set a user-facing error message */
  setError: (error: string | null) => void;

  /** Show/hide the wallet connect sheet */
  setShowConnectSheet: (show: boolean) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useWalletStore = create<WalletState & WalletActions>((set) => ({
  // Initial state
  isConnected: false,
  publicKey: null,
  authToken: null,
  base64Address: null,
  walletUriBase: null,
  isLoading: false,
  error: null,
  showConnectSheet: false,

  // Actions
  setConnected: ({ publicKey, authToken, base64Address, walletUriBase }) =>
    set({
      isConnected: true,
      publicKey,
      authToken,
      base64Address,
      walletUriBase,
      isLoading: false,
      error: null,
    }),

  setDisconnected: () =>
    set({
      isConnected: false,
      publicKey: null,
      authToken: null,
      base64Address: null,
      walletUriBase: null,
      isLoading: false,
      error: null,
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  setShowConnectSheet: (show) => set({ showConnectSheet: show }),
}));

// ---------------------------------------------------------------------------
// Selectors — for ergonomic access in components
// ---------------------------------------------------------------------------

/** Get a truncated address string like "7xKX...3nFd" for display */
export function useTruncatedAddress(): string | null {
  const publicKey = useWalletStore((s) => s.publicKey);
  if (!publicKey) return null;
  const base58 = publicKey.toBase58();
  return `${base58.slice(0, 4)}...${base58.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Auth Message Signing — used for server wallet verification
// ---------------------------------------------------------------------------

/**
 * Sign a message with the connected wallet via MWA.
 * Uses cached auth token for seamless re-authorization (no user prompt).
 *
 * @param message - The string to sign (typically a nonce from the server)
 * @returns The Ed25519 signature as Uint8Array, or null if signing fails
 */
export async function signAuthMessage(message: string): Promise<Uint8Array | null> {
  const state = useWalletStore.getState();
  if (!state.isConnected || !state.base64Address || !state.authToken) return null;

  try {
    const { transact } = await import(
      "@solana-mobile/mobile-wallet-adapter-protocol-web3js"
    );
    const { APP_IDENTITY } = await import("@/services/mwa");

    const messageBytes = new TextEncoder().encode(message);
    const transactOptions = state.walletUriBase
      ? { baseUri: state.walletUriBase }
      : undefined;

    const signedPayloads = await transact(async (wallet: any) => {
      // Reauthorize with cached token (seamless, no user approval)
      await wallet.reauthorize({
        auth_token: state.authToken,
        identity: APP_IDENTITY,
      });

      // Sign the auth message
      const result = await wallet.signMessages({
        addresses: [state.base64Address],
        payloads: [messageBytes],
      });

      return result;
    }, transactOptions);

    // signMessages returns Uint8Array[]
    return signedPayloads?.[0] ?? null;
  } catch (err) {
    console.warn("[WalletStore] signAuthMessage failed:", err);
    return null;
  }
}
