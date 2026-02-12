use anchor_lang::prelude::*;

#[error_code]
pub enum MonolithError {
    #[msg("This block is already owned by another player")]
    BlockAlreadyOwned,

    #[msg("Stake amount must meet the minimum (0.10 USDC)")]
    InsufficientStake,

    #[msg("You are not the owner of this block")]
    Unauthorized,

    #[msg("Block ID must be between 0 and 999")]
    InvalidBlockId,

    #[msg("Block position coordinates are out of bounds")]
    InvalidPosition,

    #[msg("The provided mint does not match the tower's USDC mint")]
    InvalidMint,

    #[msg("Vault does not have sufficient balance for this withdrawal")]
    InsufficientVaultBalance,
}
