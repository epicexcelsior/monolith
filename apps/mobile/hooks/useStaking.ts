/**
 * useStaking — High-level staking operations hook.
 *
 * Provides deposit_stake, add_stake, and withdraw functions that build
 * Anchor instructions, sign via MWA, and send to the Solana network.
 *
 * Also provides read functions for fetching tower state and block data.
 */

import { useState, useCallback } from "react";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import {
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";

import { connection } from "@/services/solana";
import {
    DEVNET_USDC_MINT,
    usdcToUnits,
    unitsToUsdc,
    MIN_STAKE_UNITS,
} from "@/services/monolith-program";
import { useAnchorProgram, getTowerPda, getBlockPda, getVaultAta } from "./useAnchorProgram";
import { useWalletStore } from "@/stores/wallet-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlockInfo {
    blockId: number;
    owner: string;
    stakeAmount: number; // USDC display units
    positionX: number;
    positionY: number;
    positionZ: number;
    createdAt: number; // unix timestamp
}

export interface TowerInfo {
    authority: string;
    usdcMint: string;
    totalBlocksClaimed: number;
    totalStaked: number; // USDC display units
}

export interface StakingState {
    isLoading: boolean;
    error: string | null;
    lastTxSignature: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStaking() {
    const { program, signAndSendTransaction } = useAnchorProgram();
    const publicKey = useWalletStore((s) => s.publicKey);

    const [state, setState] = useState<StakingState>({
        isLoading: false,
        error: null,
        lastTxSignature: null,
    });

    const setLoading = () =>
        setState({ isLoading: true, error: null, lastTxSignature: null });
    const setError = (msg: string) =>
        setState({ isLoading: false, error: msg, lastTxSignature: null });
    const setSuccess = (sig: string) =>
        setState({ isLoading: false, error: null, lastTxSignature: sig });

    // -----------------------------------------------------------------------
    // DEPOSIT — Claim a new block by depositing USDC
    // -----------------------------------------------------------------------
    const depositStake = useCallback(
        async (
            blockId: number,
            amountUsdc: number,
            positionX: number,
            positionY: number,
            positionZ: number,
        ): Promise<string | null> => {
            if (!publicKey) {
                setError("Wallet not connected");
                return null;
            }

            const amountUnits = usdcToUnits(amountUsdc);
            if (amountUnits < MIN_STAKE_UNITS) {
                setError(`Minimum stake is 0.10 USDC`);
                return null;
            }

            setLoading();

            try {
                const [towerPda] = getTowerPda();
                const [blockPda] = getBlockPda(blockId);
                const vaultAta = await getVaultAta();
                const playerTokenAccount = await getAssociatedTokenAddress(
                    DEVNET_USDC_MINT,
                    publicKey,
                );

                // Build instruction via Anchor
                const ix = await program.methods
                    .depositStake(
                        blockId,
                        new anchor.BN(amountUnits),
                        positionX,
                        positionY,
                        positionZ,
                    )
                    .accounts({
                        towerState: towerPda,
                        vaultTokenAccount: vaultAta,
                        blockAccount: blockPda,
                        usdcMint: DEVNET_USDC_MINT,
                        playerTokenAccount: playerTokenAccount,
                        player: publicKey,
                        systemProgram: SystemProgram.programId,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    })
                    .instruction();

                // Sign and send via MWA
                const transaction = new Transaction().add(ix);
                const signature = await signAndSendTransaction(transaction);

                setSuccess(signature);
                return signature;
            } catch (err: any) {
                const errorMsg = classifyStakingError(err);
                setError(errorMsg);
                console.error("Deposit stake failed:", err);
                return null;
            }
        },
        [publicKey, program, signAndSendTransaction],
    );

    // -----------------------------------------------------------------------
    // ADD STAKE — Add more USDC to an existing block
    // -----------------------------------------------------------------------
    const addStake = useCallback(
        async (blockId: number, amountUsdc: number): Promise<string | null> => {
            if (!publicKey) {
                setError("Wallet not connected");
                return null;
            }

            const amountUnits = usdcToUnits(amountUsdc);
            if (amountUnits <= 0) {
                setError("Amount must be greater than 0");
                return null;
            }

            setLoading();

            try {
                const [towerPda] = getTowerPda();
                const [blockPda] = getBlockPda(blockId);
                const vaultAta = await getVaultAta();
                const playerTokenAccount = await getAssociatedTokenAddress(
                    DEVNET_USDC_MINT,
                    publicKey,
                );

                const ix = await program.methods
                    .addStake(blockId, new anchor.BN(amountUnits))
                    .accounts({
                        towerState: towerPda,
                        vaultTokenAccount: vaultAta,
                        blockAccount: blockPda,
                        usdcMint: DEVNET_USDC_MINT,
                        playerTokenAccount: playerTokenAccount,
                        owner: publicKey,
                        player: publicKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    })
                    .instruction();

                const transaction = new Transaction().add(ix);
                const signature = await signAndSendTransaction(transaction);

                setSuccess(signature);
                return signature;
            } catch (err: any) {
                const errorMsg = classifyStakingError(err);
                setError(errorMsg);
                console.error("Add stake failed:", err);
                return null;
            }
        },
        [publicKey, program, signAndSendTransaction],
    );

    // -----------------------------------------------------------------------
    // WITHDRAW — Return all USDC and release the block
    // -----------------------------------------------------------------------
    const withdraw = useCallback(
        async (blockId: number): Promise<string | null> => {
            if (!publicKey) {
                setError("Wallet not connected");
                return null;
            }

            setLoading();

            try {
                const [towerPda] = getTowerPda();
                const [blockPda] = getBlockPda(blockId);
                const vaultAta = await getVaultAta();
                const playerTokenAccount = await getAssociatedTokenAddress(
                    DEVNET_USDC_MINT,
                    publicKey,
                );

                const ix = await program.methods
                    .withdraw(blockId)
                    .accounts({
                        towerState: towerPda,
                        vaultTokenAccount: vaultAta,
                        blockAccount: blockPda,
                        usdcMint: DEVNET_USDC_MINT,
                        playerTokenAccount: playerTokenAccount,
                        owner: publicKey,
                        player: publicKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    })
                    .instruction();

                const transaction = new Transaction().add(ix);
                const signature = await signAndSendTransaction(transaction);

                setSuccess(signature);
                return signature;
            } catch (err: any) {
                const errorMsg = classifyStakingError(err);
                setError(errorMsg);
                console.error("Withdraw failed:", err);
                return null;
            }
        },
        [publicKey, program, signAndSendTransaction],
    );

    // -----------------------------------------------------------------------
    // READ — Fetch tower state (no wallet needed)
    // -----------------------------------------------------------------------
    const fetchTowerState = useCallback(async (): Promise<TowerInfo | null> => {
        try {
            const [towerPda] = getTowerPda();
            const tower = await (program.account as any).towerState.fetch(towerPda);
            return {
                authority: tower.authority.toBase58(),
                usdcMint: tower.usdcMint.toBase58(),
                totalBlocksClaimed: (tower.totalBlocksClaimed as any).toNumber(),
                totalStaked: unitsToUsdc((tower.totalStaked as any).toNumber()),
            };
        } catch {
            return null; // Tower might not be initialized yet
        }
    }, [program]);

    // -----------------------------------------------------------------------
    // READ — Fetch a specific block
    // -----------------------------------------------------------------------
    const fetchBlock = useCallback(
        async (blockId: number): Promise<BlockInfo | null> => {
            try {
                const [blockPda] = getBlockPda(blockId);
                const block = await (program.account as any).blockAccount.fetch(blockPda);
                return {
                    blockId: block.blockId,
                    owner: block.owner.toBase58(),
                    stakeAmount: unitsToUsdc((block.stakeAmount as any).toNumber()),
                    positionX: block.positionX,
                    positionY: block.positionY,
                    positionZ: block.positionZ,
                    createdAt: (block.createdAt as any).toNumber(),
                };
            } catch {
                return null; // Block doesn't exist
            }
        },
        [program],
    );

    // -----------------------------------------------------------------------
    // READ — Fetch all blocks owned by a specific wallet
    // -----------------------------------------------------------------------
    const fetchOwnedBlocks = useCallback(
        async (owner?: PublicKey): Promise<BlockInfo[]> => {
            const ownerKey = owner || publicKey;
            if (!ownerKey) return [];

            try {
                const allBlocks = await (program.account as any).blockAccount.all([
                    {
                        memcmp: {
                            offset: 8, // after discriminator
                            bytes: ownerKey.toBase58(),
                        },
                    },
                ]);

                return allBlocks.map((a: any) => ({
                    blockId: a.account.blockId,
                    owner: a.account.owner.toBase58(),
                    stakeAmount: unitsToUsdc(
                        (a.account.stakeAmount as any).toNumber(),
                    ),
                    positionX: a.account.positionX,
                    positionY: a.account.positionY,
                    positionZ: a.account.positionZ,
                    createdAt: (a.account.createdAt as any).toNumber(),
                }));
            } catch (err) {
                console.error("Failed to fetch owned blocks:", err);
                return [];
            }
        },
        [publicKey, program],
    );

    return {
        // State
        ...state,

        // Write operations (require MWA)
        depositStake,
        addStake,
        withdraw,

        // Read operations (no MWA needed)
        fetchTowerState,
        fetchBlock,
        fetchOwnedBlocks,
    };
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function classifyStakingError(error: any): string {
    const message = error?.message || error?.toString() || "Unknown error";
    const code = error?.error?.errorCode?.code;

    // Anchor program errors
    if (code === "InsufficientStake") return "Minimum stake is 0.10 USDC";
    if (code === "InvalidBlockId") return "Invalid block position (0-999)";
    if (code === "Unauthorized") return "You don't own this block";
    if (code === "InvalidMint") return "Invalid token — only USDC accepted";
    if (code === "InsufficientVaultBalance") return "Vault has insufficient funds";
    if (code === "BlockAlreadyOwned") return "This block is already claimed";

    // MWA / wallet errors
    if (message.includes("User rejected")) return "Transaction rejected by user";
    if (message.includes("not connected")) return "Please connect your wallet first";
    if (message.includes("insufficient funds")) return "Insufficient USDC balance";

    // Network errors
    if (message.includes("blockhash")) return "Network timeout — please try again";

    return `Transaction failed: ${message.substring(0, 100)}`;
}
