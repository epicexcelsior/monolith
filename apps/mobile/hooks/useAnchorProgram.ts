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

import { connection } from "@/services/solana";
import { APP_IDENTITY, getMwaChain } from "@/services/mwa";
import {
    MONOLITH_PROGRAM_ID,
    DEVNET_USDC_MINT,
    IDL,
} from "@/services/monolith-program";
import { useWalletStore } from "@/stores/wallet-store";

const TAG = "[AnchorProgram]";

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
     * This handles the full MWA lifecycle:
     * 1. Opens a transact() session
     * 2. Reauthorizes with cached auth token (or authorizes fresh)
     * 3. Signs the provided transaction
     * 4. Sends the raw transaction to the network
     * 5. Confirms the transaction
     * 6. CHECKS for on-chain errors
     *
     * @returns Transaction signature string
     */
    const signAndSendTransaction = async (
        transaction: Transaction,
    ): Promise<string> => {
        if (!publicKey) {
            throw new Error("Wallet not connected");
        }

        console.log(TAG, "Starting MWA transact session...");
        console.log(TAG, "Wallet pubkey:", publicKey.toBase58());
        console.log(TAG, "Tx instructions:", transaction.instructions.length);

        // Log each instruction's program and keys for debugging
        transaction.instructions.forEach((ix, i) => {
            console.log(TAG, `  IX[${i}] program: ${ix.programId.toBase58()}`);
            console.log(TAG, `  IX[${i}] keys: ${ix.keys.map(k =>
                `${k.pubkey.toBase58().slice(0, 8)}...(${k.isSigner ? 'S' : ''}${k.isWritable ? 'W' : ''})`
            ).join(', ')}`);
            console.log(TAG, `  IX[${i}] data (${ix.data.length} bytes): ${ix.data.slice(0, 16).toString('hex')}...`);
        });

        const signedTx = await transact(
            async (wallet: Web3MobileWallet) => {
                console.log(TAG, "MWA session opened, authorizing...");

                // Re-authorize to refresh the session
                const authResult = authToken
                    ? await wallet.reauthorize({
                        auth_token: authToken,
                        identity: APP_IDENTITY,
                    })
                    : await wallet.authorize({
                        chain: getMwaChain(),
                        identity: APP_IDENTITY,
                    });

                const walletPubkey = new PublicKey(
                    Buffer.from(authResult.accounts[0].address, "base64"),
                );
                console.log(TAG, "Authorized. Wallet:", walletPubkey.toBase58());

                // Set the fee payer
                transaction.feePayer = walletPubkey;

                // Get latest blockhash
                const { blockhash, lastValidBlockHeight } =
                    await connection.getLatestBlockhash("confirmed");
                transaction.recentBlockhash = blockhash;
                console.log(TAG, "Blockhash:", blockhash.slice(0, 12) + "...");

                // Sign via MWA
                console.log(TAG, "Requesting MWA signature...");
                const signedTransactions = await wallet.signTransactions({
                    transactions: [transaction],
                });
                console.log(TAG, "MWA signature received ✓");

                return signedTransactions[0];
            },
            walletUriBase ? { baseUri: walletUriBase } : undefined,
        );

        // Send the signed transaction
        console.log(TAG, "Sending raw transaction...");
        const rawTransaction = signedTx.serialize();
        const signature = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: false,
            preflightCommitment: "confirmed",
        });
        console.log(TAG, "Sent! Signature:", signature);

        // Confirm with error checking
        console.log(TAG, "Confirming transaction...");
        const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash("confirmed");
        const confirmResult = await connection.confirmTransaction(
            {
                signature,
                blockhash,
                lastValidBlockHeight,
            },
            "confirmed",
        );

        // CRITICAL: Check if the transaction actually failed on-chain
        if (confirmResult.value.err) {
            console.error(TAG, "❌ Transaction FAILED on-chain:", JSON.stringify(confirmResult.value.err));
            throw new Error(
                `Transaction failed on-chain: ${JSON.stringify(confirmResult.value.err)}`
            );
        }

        console.log(TAG, "✅ Transaction confirmed successfully:", signature);
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
