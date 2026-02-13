use anchor_lang::prelude::*;

/// Global tower state — single PDA tracking the vault and aggregate stats.
/// Seeds: [b"tower"]
#[account]
#[derive(InitSpace)]
pub struct TowerState {
    /// Authority who initialized the tower
    pub authority: Pubkey,
    /// The USDC mint this vault accepts
    pub usdc_mint: Pubkey,
    /// The vault token account address (ATA owned by this PDA)
    pub vault: Pubkey,
    /// Total USDC deposited across all users (in smallest units)
    pub total_deposited: u64,
    /// Number of unique depositors
    pub total_users: u32,
    /// PDA bump seed
    pub bump: u8,
}

/// Per-user deposit record — tracks how much each user has in the vault.
/// Seeds: [b"deposit", user.key()]
#[account]
#[derive(InitSpace)]
pub struct UserDeposit {
    /// The user who owns this deposit
    pub owner: Pubkey,
    /// Amount of USDC deposited (in smallest units, 6 decimals)
    pub amount: u64,
    /// Timestamp of last deposit
    pub last_deposit_at: i64,
    /// PDA bump seed
    pub bump: u8,
}
