/**
 * useAnchorProgram — Anchor Program + MWA wallet integration hook.
 *
 * Creates an Anchor Program instance that can generate instructions from
 * the on-chain IDL. Also provides an MWA-compatible AnchorWallet wrapper
 * for signing transactions inside `transact()` sessions.
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
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { connection } from "@/services/solana";
import { APP_IDENTITY, getMwaCluster } from "@/services/mwa";
import {
    MONOLITH_PROGRAM_ID,
    DEVNET_USDC_MINT,
    IDL,
} from "@/services/monolith-program";
import { useWalletStore } from "@/stores/wallet-store";

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

/** Derive a block account PDA. Seeds: [b"block", blockId (LE u32)] */
export function getBlockPda(blockId: number): [PublicKey, number] {
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE(blockId);
    return PublicKey.findProgramAddressSync(
        [Buffer.from("block"), buf],
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
     *
     * @returns Transaction signature string
     */
    const signAndSendTransaction = async (
        transaction: Transaction,
    ): Promise<string> => {
        if (!publicKey) {
            throw new Error("Wallet not connected");
        }

        const signedTx = await transact(
            async (wallet: Web3MobileWallet) => {
                // Re-authorize to refresh the session
                const authResult = authToken
                    ? await wallet.reauthorize({
                        auth_token: authToken,
                        identity: APP_IDENTITY,
                    })
                    : await wallet.authorize({
                        chain: getMwaCluster(),
                        identity: APP_IDENTITY,
                    });

                // Set the fee payer
                transaction.feePayer = new PublicKey(
                    Buffer.from(authResult.accounts[0].address, "base64"),
                );

                // Get latest blockhash
                const { blockhash, lastValidBlockHeight } =
                    await connection.getLatestBlockhash("confirmed");
                transaction.recentBlockhash = blockhash;

                // Sign via MWA
                const signedTransactions = await wallet.signTransactions({
                    transactions: [transaction],
                });

                return signedTransactions[0];
            },
            walletUriBase ? { baseUri: walletUriBase } : undefined,
        );

        // Send the signed transaction
        const rawTransaction = signedTx.serialize();
        const signature = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: false,
            preflightCommitment: "confirmed",
        });

        // Confirm
        const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction(
            {
                signature,
                blockhash,
                lastValidBlockHeight,
            },
            "confirmed",
        );

        return signature;
    };

    return {
        program,
        signAndSendTransaction,
        getTowerPda,
        getBlockPda,
        getVaultAta,
    };
}
