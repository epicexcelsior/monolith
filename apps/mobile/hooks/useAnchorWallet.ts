/**
 * useAnchorWallet — MWA-backed Anchor wallet adapter.
 *
 * Wraps MWA transact() to implement the Anchor Wallet interface
 * (signTransaction, signAllTransactions, publicKey).
 *
 * Each signing operation opens a new MWA session and re-authorizes
 * with the cached auth token. This is the official pattern from:
 * https://docs.solanamobile.com/react-native/anchor_integration#create-an-anchor-wallet-with-mobile-wallet-adapter
 *
 * Usage:
 *   const anchorWallet = useAnchorWallet();
 *   if (anchorWallet) {
 *     const provider = new AnchorProvider(connection, anchorWallet, {});
 *     const program = new Program(idl, programId, provider);
 *   }
 */

import { useMemo } from "react";
import * as SecureStore from "expo-secure-store";
import * as anchor from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

import { APP_IDENTITY, getMwaChain, SECURE_STORE_KEYS } from "@/services/mwa";
import { useWalletStore } from "@/stores/wallet-store";

export function useAnchorWallet(): anchor.Wallet | null {
  const publicKey = useWalletStore((s) => s.publicKey);

  return useMemo(() => {
    if (!publicKey) return null;

    return {
      signTransaction: async (tx: Transaction): Promise<Transaction> => {
        return transact(async (wallet: Web3MobileWallet) => {
          // Re-authorize with cached token (skips approval dialog)
          const cachedToken = await SecureStore.getItemAsync(
            SECURE_STORE_KEYS.AUTH_TOKEN,
          );
          await wallet.authorize({
            identity: APP_IDENTITY,
            chain: getMwaChain(),
            auth_token: cachedToken ?? undefined,
          });

          const signedTxs = await wallet.signTransactions({
            transactions: [tx],
          });
          return signedTxs[0];
        });
      },

      signAllTransactions: async (
        txs: Transaction[],
      ): Promise<Transaction[]> => {
        return transact(async (wallet: Web3MobileWallet) => {
          const cachedToken = await SecureStore.getItemAsync(
            SECURE_STORE_KEYS.AUTH_TOKEN,
          );
          await wallet.authorize({
            identity: APP_IDENTITY,
            chain: getMwaChain(),
            auth_token: cachedToken ?? undefined,
          });

          return await wallet.signTransactions({
            transactions: txs,
          });
        });
      },

      get publicKey() {
        return publicKey;
      },
    } as anchor.Wallet;
  }, [publicKey]);
}
