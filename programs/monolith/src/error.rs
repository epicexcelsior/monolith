use anchor_lang::prelude::*;

#[error_code]
pub enum MonolithError {
    #[msg("Deposit amount must be greater than zero")]
    InsufficientDeposit,

    #[msg("Insufficient balance for withdrawal")]
    InsufficientBalance,

    #[msg("Invalid USDC mint address")]
    InvalidMint,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
