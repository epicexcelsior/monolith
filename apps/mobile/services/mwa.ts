/**
 * MWA (Mobile Wallet Adapter) configuration and utilities.
 *
 * Centralizes app identity, cluster config, and base64 conversion
 * so every MWA `transact()` call uses consistent settings.
 *
 * @see https://docs.solanamobile.com/react-native/using_mobile_wallet_adapter
 */

import { PublicKey } from "@solana/web3.js";
import type { Cluster } from "@solana-mobile/mobile-wallet-adapter-protocol";

// ---------------------------------------------------------------------------
// App Identity — shown to the user in the wallet approval dialog
// ---------------------------------------------------------------------------
export const APP_IDENTITY = {
  name: "The Monolith",
  uri: "https://themonolith.app",
  icon: "favicon.ico", // relative to `uri` per MWA spec
};

// ---------------------------------------------------------------------------
// Cluster / Network configuration
// ---------------------------------------------------------------------------
// MWA 2.0 uses the `chain` param in authorize() which accepts `Cluster` type.
// Cluster is "devnet" | "testnet" | "mainnet-beta" — matches web3.js names.
// The MWA protocol handles the "solana:" prefix internally.
// See: https://docs.solanamobile.com/react-native/using_mobile_wallet_adapter#connecting-to-a-wallet

const NETWORK = (process.env.EXPO_PUBLIC_SOLANA_NETWORK || "devnet") as Cluster;

/**
 * Returns the MWA Cluster for use in wallet.authorize({ chain }).
 * Uses the Cluster type from MWA protocol for type safety.
 */
export function getMwaCluster(): Cluster {
  return NETWORK;
}

/**
 * Returns the raw cluster name for web3.js usage (e.g. "devnet").
 */
export function getClusterName(): Cluster {
  return NETWORK;
}

// ---------------------------------------------------------------------------
// Address conversion
// ---------------------------------------------------------------------------
/**
 * Converts MWA's base64-encoded address to a web3.js PublicKey.
 *
 * MWA returns wallet addresses as base64 strings. We need PublicKey
 * for all web3.js operations.
 *
 * Uses the already-polyfilled global Buffer (from index.js) so we
 * don't need an additional dependency like react-native-quick-base64.
 *
 * @see https://docs.solanamobile.com/react-native/storing_mwa_auth#check-for-cached-authorization
 */
export function base64ToPublicKey(base64Address: string): PublicKey {
  const bytes = Buffer.from(base64Address, "base64");
  return new PublicKey(bytes);
}

// ---------------------------------------------------------------------------
// Secure Store keys — consistent key names for expo-secure-store
// ---------------------------------------------------------------------------
export const SECURE_STORE_KEYS = {
  AUTH_TOKEN: "mwa_auth_token",
  BASE64_ADDRESS: "mwa_base64_address",
  WALLET_URI_BASE: "mwa_wallet_uri_base",
  HAS_COMPLETED_ONBOARDING: "monolith_onboarding_complete",
} as const;
