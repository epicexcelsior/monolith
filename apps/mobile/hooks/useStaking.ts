/**
 * useStaking — High-level USDC vault operations hook.
 *
 * Provides deposit and withdraw functions that build Anchor instructions,
 * sign via MWA, and send to the Solana network.
 *
 * Read functions use direct RPC + manual byte decoding (React Native compatible).
 */

import { useState, useCallback } from "react";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import {
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";

import { connection } from "@/services/solana";
import {
    DEVNET_USDC_MINT,
    usdcToUnits,
    unitsToUsdc,
    MIN_STAKE_UNITS,
} from "@/services/monolith-program";
import { useAnchorProgram, getTowerPda, getUserDepositPda, getVaultAta } from "./useAnchorProgram";
import { useWalletStore } from "@/stores/wallet-store";

const TAG = "[Staking]";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserDepositInfo {
    owner: string;
    amount: number; // USDC display units
    lastDepositAt: number; // unix timestamp
}

export interface TowerInfo {
    authority: string;
    usdcMint: string;
    totalDeposited: number; // USDC display units
    totalUsers: number;
}

export interface StakingState {
    isLoading: boolean;
    error: string | null;
    lastTxSignature: string | null;
}

// ---------------------------------------------------------------------------
// Manual account decoders (React Native compatible)
//
// BorshAccountsCoder uses Buffer.readUIntLE which doesn't exist in RN.
// We decode manually using DataView which works everywhere.
//
// Struct layouts from programs/monolith/src/state.rs:
//
// TowerState (117 bytes):
//   [0..8)    discriminator
//   [8..40)   authority: Pubkey
//   [40..72)  usdc_mint: Pubkey
//   [72..104) vault: Pubkey
//   [104..112) total_deposited: u64 (LE)
//   [112..116) total_users: u32 (LE)
//   [116..117) bump: u8
//
// UserDeposit (57 bytes):
//   [0..8)    discriminator
//   [8..40)   owner: Pubkey
//   [40..48)  amount: u64 (LE)
//   [48..56)  last_deposit_at: i64 (LE)
//   [56..57)  bump: u8
// ---------------------------------------------------------------------------

function readPubkey(data: Uint8Array, offset: number): PublicKey {
    return new PublicKey(data.slice(offset, offset + 32));
}

function readU64(data: Uint8Array, offset: number): number {
    // Read as two u32s (little-endian) since DataView.getBigUint64 may not exist
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const lo = view.getUint32(offset, true);
    const hi = view.getUint32(offset + 4, true);
    return hi * 0x100000000 + lo;
}

function readI64(data: Uint8Array, offset: number): number {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const lo = view.getUint32(offset, true);
    const hi = view.getInt32(offset + 4, true); // signed high word
    return hi * 0x100000000 + lo;
}

function readU32(data: Uint8Array, offset: number): number {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return view.getUint32(offset, true);
}

interface RawTowerState {
    authority: PublicKey;
    usdcMint: PublicKey;
    vault: PublicKey;
    totalDeposited: number;
    totalUsers: number;
    bump: number;
}

interface RawUserDeposit {
    owner: PublicKey;
    amount: number;
    lastDepositAt: number;
    bump: number;
}

function decodeTowerState(data: Uint8Array): RawTowerState {
    if (data.length < 117) throw new Error(`TowerState too short: ${data.length} bytes`);
    return {
        authority: readPubkey(data, 8),
        usdcMint: readPubkey(data, 40),
        vault: readPubkey(data, 72),
        totalDeposited: readU64(data, 104),
        totalUsers: readU32(data, 112),
        bump: data[116],
    };
}

function decodeUserDeposit(data: Uint8Array): RawUserDeposit {
    if (data.length < 57) throw new Error(`UserDeposit too short: ${data.length} bytes`);
    return {
        owner: readPubkey(data, 8),
        amount: readU64(data, 40),
        lastDepositAt: readI64(data, 48),
        bump: data[56],
    };
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
    // DEPOSIT — Add USDC to the vault
    // -----------------------------------------------------------------------
    const deposit = useCallback(
        async (amountUsdc: number): Promise<string | null> => {
            if (!publicKey) {
                setError("Wallet not connected");
                return null;
            }

            const amountUnits = usdcToUnits(amountUsdc);
            if (amountUnits < MIN_STAKE_UNITS) {
                setError(`Minimum deposit is 0.10 USDC`);
                return null;
            }

            setLoading();

            try {
                const [towerPda] = getTowerPda();
                const [userDepositPda] = getUserDepositPda(publicKey);
                const vaultAta = await getVaultAta();
                const userTokenAccount = await getAssociatedTokenAddress(
                    DEVNET_USDC_MINT,
                    publicKey,
                );

                console.log(TAG, "=== DEPOSIT ===");
                console.log(TAG, "Amount:", amountUsdc, "USDC (", amountUnits, "units)");
                console.log(TAG, "User:", publicKey.toBase58());

                const ix = await program.methods
                    .deposit(new anchor.BN(amountUnits))
                    .accounts({
                        towerState: towerPda,
                        userDeposit: userDepositPda,
                        vault: vaultAta,
                        userTokenAccount: userTokenAccount,
                        usdcMint: DEVNET_USDC_MINT,
                        user: publicKey,
                        systemProgram: SystemProgram.programId,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .instruction();

                const transaction = new Transaction().add(ix);
                const signature = await signAndSendTransaction(transaction);

                console.log(TAG, "✅ DEPOSIT SUCCESS:", signature);
                setSuccess(signature);
                return signature;
            } catch (err: any) {
                const errorMsg = classifyStakingError(err);
                setError(errorMsg);
                console.error(TAG, "❌ DEPOSIT FAILED:", err?.message);
                return null;
            }
        },
        [publicKey, program, signAndSendTransaction],
    );

    // -----------------------------------------------------------------------
    // WITHDRAW — Remove USDC from the vault
    // -----------------------------------------------------------------------
    const withdraw = useCallback(
        async (amountUsdc: number): Promise<string | null> => {
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
                const [userDepositPda] = getUserDepositPda(publicKey);
                const vaultAta = await getVaultAta();
                const userTokenAccount = await getAssociatedTokenAddress(
                    DEVNET_USDC_MINT,
                    publicKey,
                );

                console.log(TAG, "=== WITHDRAW ===");
                console.log(TAG, "Amount:", amountUsdc, "USDC (", amountUnits, "units)");

                const ix = await program.methods
                    .withdraw(new anchor.BN(amountUnits))
                    .accounts({
                        towerState: towerPda,
                        userDeposit: userDepositPda,
                        vault: vaultAta,
                        userTokenAccount: userTokenAccount,
                        usdcMint: DEVNET_USDC_MINT,
                        user: publicKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .instruction();

                const transaction = new Transaction().add(ix);
                const signature = await signAndSendTransaction(transaction);

                console.log(TAG, "✅ WITHDRAW SUCCESS:", signature);
                setSuccess(signature);
                return signature;
            } catch (err: any) {
                const errorMsg = classifyStakingError(err);
                setError(errorMsg);
                console.error(TAG, "❌ WITHDRAW FAILED:", err?.message);
                return null;
            }
        },
        [publicKey, program, signAndSendTransaction],
    );

    // -----------------------------------------------------------------------
    // READ — Fetch tower state (manual decode, RN-compatible)
    // -----------------------------------------------------------------------
    const fetchTowerState = useCallback(async (): Promise<TowerInfo | null> => {
        try {
            const [towerPda] = getTowerPda();
            const accountInfo = await connection.getAccountInfo(towerPda, "confirmed");
            if (!accountInfo) {
                console.log(TAG, "TowerState account not found");
                return null;
            }

            const raw = decodeTowerState(accountInfo.data as Uint8Array);
            const info: TowerInfo = {
                authority: raw.authority.toBase58(),
                usdcMint: raw.usdcMint.toBase58(),
                totalDeposited: unitsToUsdc(raw.totalDeposited),
                totalUsers: raw.totalUsers,
            };
            console.log(TAG, "✅ TowerState:", JSON.stringify(info));
            return info;
        } catch (err: any) {
            console.error(TAG, "❌ fetchTowerState error:", err?.message);
            return null;
        }
    }, []);

    // -----------------------------------------------------------------------
    // READ — Fetch current user's deposit (manual decode, RN-compatible)
    // -----------------------------------------------------------------------
    const fetchUserDeposit = useCallback(
        async (user?: PublicKey): Promise<UserDepositInfo | null> => {
            const userKey = user || publicKey;
            if (!userKey) return null;

            try {
                const [userDepositPda] = getUserDepositPda(userKey);
                const accountInfo = await connection.getAccountInfo(userDepositPda, "confirmed");
                if (!accountInfo) {
                    console.log(TAG, "UserDeposit not found — user hasn't deposited yet");
                    return null;
                }

                const raw = decodeUserDeposit(accountInfo.data as Uint8Array);
                const info: UserDepositInfo = {
                    owner: raw.owner.toBase58(),
                    amount: unitsToUsdc(raw.amount),
                    lastDepositAt: raw.lastDepositAt,
                };
                console.log(TAG, "✅ UserDeposit:", JSON.stringify(info));
                return info;
            } catch (err: any) {
                console.error(TAG, "❌ fetchUserDeposit error:", err?.message);
                return null;
            }
        },
        [publicKey],
    );

    return {
        // State
        ...state,

        // Write operations (require MWA)
        deposit,
        withdraw,

        // Read operations (no MWA needed)
        fetchTowerState,
        fetchUserDeposit,
    };
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function classifyStakingError(error: any): string {
    const message = error?.message || error?.toString() || "Unknown error";
    const code = error?.error?.errorCode?.code;

    if (code === "InsufficientDeposit") return "Deposit amount must be greater than zero";
    if (code === "InsufficientBalance") return "Insufficient balance for withdrawal";
    if (code === "InvalidMint") return "Invalid token — only USDC accepted";
    if (message.includes("failed on-chain")) return message;
    if (message.includes("User rejected")) return "Transaction rejected by user";
    if (message.includes("not connected")) return "Please connect your wallet first";
    if (message.includes("insufficient funds") || message.includes("Insufficient"))
        return "Insufficient USDC balance — make sure you have devnet USDC";
    if (message.includes("custom program error")) {
        const match = message.match(/custom program error: 0x([0-9a-f]+)/i);
        if (match) {
            const errCode = parseInt(match[1], 16);
            if (errCode === 6000) return "Deposit amount must be greater than zero";
            if (errCode === 6001) return "Insufficient vault balance for withdrawal";
            if (errCode === 6002) return "Invalid USDC mint address";
            return `Program error code: ${errCode}`;
        }
    }
    if (message.includes("Account does not exist"))
        return "Account not found — tower may not be initialized on this network";
    if (message.includes("blockhash")) return "Network timeout — please try again";

    return `Transaction failed: ${message.substring(0, 100)}`;
}
