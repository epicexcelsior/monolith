/**
 * useAnchorProgram — Anchor Program + MWA wallet integration hook.
 *
 * Creates an Anchor Program instance from the on-chain IDL.
 * Provides PDA derivation helpers and MWA-compatible transaction signing.
 *
 * @see https://docs.solanamobile.com/react-native/anchor_integration
 */

import { useMemo } from "react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
    transact,
    Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
    getAssociatedTokenAddress,
} from "@solana/spl-token";

import * as SecureStore from "expo-secure-store";

import { connection } from "@/services/solana";
import { APP_IDENTITY, getMwaChain, SECURE_STORE_KEYS } from "@/services/mwa";
import {
    MONOLITH_PROGRAM_ID,
    DEVNET_USDC_MINT,
    IDL,
} from "@/services/monolith-program";
import { useWalletStore } from "@/stores/wallet-store";

const TAG = "[AnchorProgram]";

/** Retry an async operation on transient RPC failures (429, 500, 502, 503, network errors). */
async function withRetry<T>(label: string, fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            const msg = err?.message?.toLowerCase() || "";
            const isTransient =
                msg.includes("500") || msg.includes("502") || msg.includes("503") ||
                msg.includes("429") || msg.includes("too many request") ||
                msg.includes("internal server error") || msg.includes("network") ||
                msg.includes("econnreset") || msg.includes("timeout") ||
                msg.includes("fetch failed");

            if (isTransient && attempt < maxAttempts) {
                const delay = 1000 * attempt;
                console.warn(TAG, `${label} attempt ${attempt} failed (${err?.message}), retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw err;
        }
    }
    throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// PDA derivation helpers
// ---------------------------------------------------------------------------

/** Derive the tower state PDA. Seeds: [b"tower"] */
export function getTowerPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("tower")],
        MONOLITH_PROGRAM_ID,
    );
}

/** Derive a user deposit PDA. Seeds: [b"deposit", user.key()] */
export function getUserDepositPda(user: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("deposit"), user.toBuffer()],
        MONOLITH_PROGRAM_ID,
    );
}

/** Get the vault ATA (USDC ATA owned by towerPda). */
export async function getVaultAta(): Promise<PublicKey> {
    const [towerPda] = getTowerPda();
    return getAssociatedTokenAddress(
        DEVNET_USDC_MINT,
        towerPda,
        true, // allowOwnerOffCurve — tower PDA is off-curve
    );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAnchorProgram() {
    const publicKey = useWalletStore((s) => s.publicKey);
    const authToken = useWalletStore((s) => s.authToken);
    const walletUriBase = useWalletStore((s) => s.walletUriBase);

    const program = useMemo(() => {
        // Create a read-only provider (no wallet needed for reads)
        const readOnlyProvider = new anchor.AnchorProvider(
            connection as any,
            {} as any, // dummy wallet — we sign manually via MWA
            { preflightCommitment: "confirmed" },
        );

        return new anchor.Program(IDL, readOnlyProvider);
    }, []);

    /**
     * Sign and send a transaction using MWA.
     *
     * Handles auth token expiration gracefully:
     * 1. Try reauthorize with cached token (fast, no user prompt)
     * 2. If that fails, fall back to fresh authorize (shows wallet approval)
     * 3. RPC calls retry on transient 500/429 errors
     *
     * @returns Transaction signature string
     */
    const signAndSendTransaction = async (
        transaction: Transaction,
    ): Promise<string> => {
        if (!publicKey) {
            throw new Error("Wallet not connected");
        }

        if (__DEV__) {
            console.log(TAG, "Starting MWA transact session...");
            console.log(TAG, "Wallet pubkey:", publicKey.toBase58());
            console.log(TAG, "Tx instructions:", transaction.instructions.length);
            transaction.instructions.forEach((ix, i) => {
                console.log(TAG, `  IX[${i}] program: ${ix.programId.toBase58()}`);
                console.log(TAG, `  IX[${i}] keys: ${ix.keys.map(k =>
                    `${k.pubkey.toBase58().slice(0, 8)}...(${k.isSigner ? 'S' : ''}${k.isWritable ? 'W' : ''})`
                ).join(', ')}`);
                console.log(TAG, `  IX[${i}] data (${ix.data.length} bytes): ${ix.data.slice(0, 16).toString('hex')}...`);
            });
        }

        const transactOptions = walletUriBase ? { baseUri: walletUriBase } : undefined;

        const signTransaction = async (wallet: Web3MobileWallet, useAuthToken: string | null) => {
            if (__DEV__) console.log(TAG, "MWA session opened, authorizing...", useAuthToken ? "(reauthorize)" : "(fresh authorize)");

            const authResult = useAuthToken
                ? await wallet.reauthorize({
                    auth_token: useAuthToken,
                    identity: APP_IDENTITY,
                })
                : await wallet.authorize({
                    chain: getMwaChain(),
                    identity: APP_IDENTITY,
                });

            // Update stored auth token for future calls
            if (authResult.auth_token && publicKey) {
                useWalletStore.getState().setConnected({
                    publicKey,
                    authToken: authResult.auth_token,
                    base64Address: authResult.accounts[0].address,
                    walletUriBase: authResult.wallet_uri_base ?? walletUriBase ?? "",
                });
            }

            const walletPubkey = new PublicKey(
                Buffer.from(authResult.accounts[0].address, "base64"),
            );
            if (__DEV__) console.log(TAG, "Authorized. Wallet:", walletPubkey.toBase58());

            // Set the fee payer
            transaction.feePayer = walletPubkey;

            // Get latest blockhash (retry on transient RPC failures)
            const { blockhash } = await withRetry("getLatestBlockhash",
                () => connection.getLatestBlockhash("confirmed"));
            transaction.recentBlockhash = blockhash;
            if (__DEV__) console.log(TAG, "Blockhash:", blockhash.slice(0, 12) + "...");

            // Sign via MWA
            if (__DEV__) console.log(TAG, "Requesting MWA signature...");
            const signedTransactions = await wallet.signTransactions({
                transactions: [transaction],
            });
            if (__DEV__) console.log(TAG, "MWA signature received ✓");

            return signedTransactions[0];
        };

        // Try reauthorize first, fall back to fresh authorize on auth errors
        let signedTx: Transaction;
        try {
            signedTx = await transact(
                (wallet) => signTransaction(wallet, authToken),
                transactOptions,
            );
        } catch (firstErr: any) {
            const msg = firstErr?.message?.toLowerCase() || "";
            const isAuthError = msg.includes("authorization") || msg.includes("reauthorize") || msg.includes("auth_token");

            if (authToken && isAuthError) {
                console.warn(TAG, "Reauthorize failed, retrying with fresh authorize:", firstErr?.message);

                // Clear stale auth token so future calls don't retry it
                await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.AUTH_TOKEN);
                if (publicKey) {
                    useWalletStore.getState().setConnected({
                        publicKey,
                        authToken: "",
                        base64Address: useWalletStore.getState().base64Address ?? "",
                        walletUriBase: walletUriBase ?? "",
                    });
                }

                // Brief delay to let MWA close the failed session cleanly
                await new Promise(r => setTimeout(r, 500));

                // Retry WITHOUT walletUriBase — stale deep-link may be the problem
                signedTx = await transact(
                    (wallet) => signTransaction(wallet, null),
                );
            } else {
                throw firstErr;
            }
        }

        // Send the signed transaction (retry on transient RPC failures)
        if (__DEV__) console.log(TAG, "Sending raw transaction...");
        const rawTransaction = signedTx.serialize();
        const signature = await withRetry("sendRawTransaction",
            () => connection.sendRawTransaction(rawTransaction, {
                skipPreflight: false,
                preflightCommitment: "confirmed",
            }));
        if (__DEV__) console.log(TAG, "Sent! Signature:", signature);

        // Confirm with error checking (retry on transient RPC failures)
        if (__DEV__) console.log(TAG, "Confirming transaction...");
        const { blockhash, lastValidBlockHeight } = await withRetry("getLatestBlockhash",
            () => connection.getLatestBlockhash("confirmed"));
        const confirmResult = await withRetry("confirmTransaction",
            () => connection.confirmTransaction(
                {
                    signature,
                    blockhash,
                    lastValidBlockHeight,
                },
                "confirmed",
            ));

        // CRITICAL: Check if the transaction actually failed on-chain
        if (confirmResult.value.err) {
            console.error(TAG, "❌ Transaction FAILED on-chain:", JSON.stringify(confirmResult.value.err));
            throw new Error(
                `Transaction failed on-chain: ${JSON.stringify(confirmResult.value.err)}`
            );
        }

        if (__DEV__) console.log(TAG, "✅ Transaction confirmed successfully:", signature);
        return signature;
    };

    return {
        program,
        signAndSendTransaction,
        getTowerPda,
        getUserDepositPda,
        getVaultAta,
    };
}
