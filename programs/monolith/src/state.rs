use anchor_lang::prelude::*;

/// Global tower state — singleton PDA tracking tower-level metadata.
/// Seeds: [b"tower"]
#[account]
#[derive(InitSpace)]
pub struct TowerState {
    /// Authority who initialized the tower (admin)
    pub authority: Pubkey,

    /// The USDC mint address this tower accepts for staking
    pub usdc_mint: Pubkey,

    /// Total number of blocks currently claimed
    pub total_blocks_claimed: u64,

    /// Total USDC staked across all blocks (in token smallest units, 6 decimals)
    pub total_staked: u64,

    /// Bump seed for PDA derivation
    pub bump: u8,
}

/// Individual block on the tower — one PDA per block.
/// Seeds: [b"block", block_id.to_le_bytes()]
#[account]
#[derive(InitSpace)]
pub struct BlockAccount {
    /// Owner of this block (the staker's wallet)
    pub owner: Pubkey,

    /// Unique block identifier (0–999)
    pub block_id: u32,

    /// Amount of USDC staked on this block (6 decimals, e.g. 100_000 = 0.10 USDC)
    pub stake_amount: u64,

    /// Block position on the tower — X coordinate
    pub position_x: i16,

    /// Block position on the tower — Y coordinate (layer/height)
    pub position_y: i16,

    /// Block position on the tower — Z coordinate
    pub position_z: i16,

    /// Unix timestamp when the block was claimed
    pub created_at: i64,

    /// Bump seed for PDA derivation
    pub bump: u8,
}
