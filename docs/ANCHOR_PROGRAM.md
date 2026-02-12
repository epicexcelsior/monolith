# Anchor Program — USDC Vault Staking System

**Program ID (Devnet)**: `Fu76EqtVLqX2LKCW5ZW8zWBqdgsQTbkvQ9nBDyykgwDh`  
**Last Updated**: 2026-02-12

## Overview

The Monolith Anchor program implements a **shared USDC vault** for staking. All block stakes are pooled in a single vault token account (ATA owned by the tower PDA). This simplifies on-chain accounting and enables future yield distribution.

## Architecture

- **Shared vault**: One USDC ATA for all staked funds
- **SPL Token2022 compatible**: Uses `InterfaceAccount` + `transfer_checked`
- **4 instructions**: `initialize_tower`, `deposit_stake`, `add_stake`, `withdraw`
- **PDA-based ownership**: Tower state + per-block accounts

## PDAs

| PDA | Seeds | Purpose |
|-----|-------|---------|
| `TowerState` | `[b"tower"]` | Global config (authority, USDC mint, totals, bump) |
| `BlockAccount` | `[b"block", u32]` | Per-block data (owner, stake, position, created_at, bump) |
| `vault_token_account` | ATA of `TowerState` | Holds all staked USDC (owned by tower PDA) |

## Instructions

### 1. `initialize_tower`
- **Called once** by deployer
- Creates `TowerState` PDA and vault ATA
- Sets USDC mint (devnet: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`)

### 2. `deposit_stake`
- Claims a new block (creates `BlockAccount` PDA)
- Transfers USDC from player's ATA → vault ATA
- Stores block position (x, y, z) on-chain
- Minimum stake: **0.10 USDC** (100_000 units)

### 3. `add_stake`
- Increases stake on an owned block
- Requires `has_one = owner` constraint (auth check)
- Updates `block.stake_amount` and `tower.total_staked`

### 4. `withdraw`
- Releases the block + returns USDC to owner
- Transfers USDC from vault → player (using tower PDA as signer)
- Closes `BlockAccount` (rent refund to owner)
- Decrements `tower.total_blocks_claimed` and `tower.total_staked`

## Error Codes

| Code | Error | Meaning |
|------|-------|---------|
| `6000` | `BlockAlreadyOwned` | Block PDA already exists |
| `6001` | `InsufficientStake` | Below minimum (0.10 USDC) |
| `6002` | `Unauthorized` | Not the block owner |
| `6003` | `InvalidBlockId` | Block ID ≥ 1000 |
| `6004` | `InvalidPosition` | Position out of bounds |
| `6005` | `InvalidMint` | Mint doesn't match tower's USDC mint |
| `6006` | `InsufficientVaultBalance` | Vault balance < withdrawal amount |

## State Structs

### `TowerState`
```rust
pub struct TowerState {
    pub authority: Pubkey,        // Deployer
    pub usdc_mint: Pubkey,         // USDC mint address
    pub total_blocks_claimed: u64, // Count of active blocks
    pub total_staked: u64,         // Total USDC in vault (6 decimals)
    pub bump: u8,                  // PDA bump
}
```

### `BlockAccount`
```rust
pub struct BlockAccount {
    pub owner: Pubkey,       // Staker's wallet
    pub block_id: u32,       // 0-999
    pub stake_amount: u64,   // USDC units (6 decimals)
    pub position_x: i16,     // 3D position
    pub position_y: i16,
    pub position_z: i16,
    pub created_at: i64,     // Unix timestamp
    pub bump: u8,            // PDA bump
}
```

## Testing

**Test suite**: `tests/monolith.ts` — 9 comprehensive tests covering:
- Tower initialization
- USDC deposits (success + min stake validation)
- Adding stake (ownership auth checks)
- Withdrawals (balance validation, rent refund)
- Multi-player scenarios

**Run**: `anchor test` (builds + deploys to localnet + runs tests)

## Mobile Integration

See [SOLANA_MOBILE.md](SOLANA_MOBILE.md) for MWA integration.

Key files:
- `apps/mobile/services/monolith-program.ts` — IDL + constants
- `apps/mobile/hooks/useAnchorProgram.ts` — Anchor + MWA wrapper
- `apps/mobile/hooks/useStaking.ts` — High-level deposit/withdraw/add ops
- `apps/mobile/app/deposit.tsx` — Deposit UI with MWA confirmation

## Devnet Deployment

```bash
# 1. Sync program IDs
anchor keys sync

# 2. Build
anchor build

# 3. Deploy
anchor deploy --provider.cluster devnet

# 4. Initialize tower (one-time)
# Use the mobile app or write a script to call initialize_tower
# with devnet USDC mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

## Future Enhancements

- **Yield distribution**: Integrate with Drift Protocol for real yield
- **Seniority tracking**: Reward early stakers
- **Tiered staking**: Higher minimums unlock premium block positions
- **Governance**: Allow stakers to vote on tower parameters
