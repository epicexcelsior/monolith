/**
 * Monolith Program IDL & Constants
 *
 * Auto-generated IDL from `anchor build` — do not edit manually.
 * To regenerate: `anchor build` then copy target/idl/monolith.json here.
 *
 * @see /programs/monolith/src/lib.rs
 */

import { PublicKey } from "@solana/web3.js";

// Program ID — must match declare_id!() in lib.rs
export const MONOLITH_PROGRAM_ID = new PublicKey(
    "Fu76EqtVLqX2LKCW5ZW8zWBqdgsQTbkvQ9nBDyykgwDh",
);

// Devnet USDC mint (Circle's official devnet USDC)
export const DEVNET_USDC_MINT = new PublicKey(
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

// USDC has 6 decimals
export const USDC_DECIMALS = 6;

// Minimum stake in USDC smallest units (0.10 USDC = 100_000)
export const MIN_STAKE_UNITS = 100_000;

/**
 * Convert USDC display amount to on-chain units.
 * e.g. 5.50 USDC → 5_500_000
 */
export function usdcToUnits(amount: number): number {
    return Math.round(amount * 10 ** USDC_DECIMALS);
}

/**
 * Convert on-chain USDC units to display amount.
 * e.g., 5_500_000 → 5.50
 */
export function unitsToUsdc(units: number): number {
    return units / 10 ** USDC_DECIMALS;
}

// Re-export IDL as typed module
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const IDL = require("./monolith-idl.json");
