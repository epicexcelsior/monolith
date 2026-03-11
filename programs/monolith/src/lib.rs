use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

pub mod error;
pub mod state;

use error::MonolithError;
use state::{TowerState, UserDeposit};

declare_id!("Fu76EqtVLqX2LKCW5ZW8zWBqdgsQTbkvQ9nBDyykgwDh");

#[program]
pub mod monolith {
    use super::*;

    /// Initialize the tower — creates global state PDA + USDC vault ATA.
    /// Called once by the program authority.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let tower = &mut ctx.accounts.tower_state;
        tower.authority = ctx.accounts.authority.key();
        tower.usdc_mint = ctx.accounts.usdc_mint.key();
        tower.vault = ctx.accounts.vault.key();
        tower.total_deposited = 0;
        tower.total_users = 0;
        tower.bump = ctx.bumps.tower_state;
        Ok(())
    }

    /// Deposit USDC into the vault.
    /// Creates a UserDeposit PDA on first call (init_if_needed).
    /// Subsequent deposits add to the existing balance.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, MonolithError::InsufficientDeposit);

        // Transfer USDC from user → vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // Check if this is a new depositor (owner defaults to Pubkey::default)
        let user_deposit = &mut ctx.accounts.user_deposit;
        let is_new_user = user_deposit.owner == Pubkey::default();

        if is_new_user {
            user_deposit.owner = ctx.accounts.user.key();
            user_deposit.bump = ctx.bumps.user_deposit;
        }

        user_deposit.amount = user_deposit
            .amount
            .checked_add(amount)
            .ok_or(MonolithError::ArithmeticOverflow)?;
        user_deposit.last_deposit_at = Clock::get()?.unix_timestamp;

        // Update tower totals
        let tower = &mut ctx.accounts.tower_state;
        if is_new_user {
            tower.total_users = tower.total_users.checked_add(1)
                .ok_or(MonolithError::ArithmeticOverflow)?;
        }
        tower.total_deposited = tower
            .total_deposited
            .checked_add(amount)
            .ok_or(MonolithError::ArithmeticOverflow)?;

        Ok(())
    }

    /// Withdraw USDC from the vault back to the user.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, MonolithError::InsufficientDeposit);
        require!(
            ctx.accounts.user_deposit.amount >= amount,
            MonolithError::InsufficientBalance
        );

        // Sign with tower PDA seeds for vault authority
        let seeds = &[b"tower".as_ref(), &[ctx.accounts.tower_state.bump]];
        let signer_seeds = &[&seeds[..]];

        // Transfer USDC from vault → user
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.tower_state.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        // Update user deposit
        let user_deposit = &mut ctx.accounts.user_deposit;
        user_deposit.amount = user_deposit
            .amount
            .checked_sub(amount)
            .ok_or(MonolithError::InsufficientBalance)?;

        // Update tower totals
        let tower = &mut ctx.accounts.tower_state;
        tower.total_deposited = tower
            .total_deposited
            .checked_sub(amount)
            .ok_or(MonolithError::ArithmeticOverflow)?;

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Account validation structs
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TowerState::INIT_SPACE,
        seeds = [b"tower"],
        bump,
    )]
    pub tower_state: Account<'info, TowerState>,

    /// The USDC mint this vault will accept
    pub usdc_mint: Account<'info, Mint>,

    /// Vault token account — ATA owned by the tower PDA
    #[account(
        init,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = tower_state,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"tower"],
        bump = tower_state.bump,
    )]
    pub tower_state: Account<'info, TowerState>,

    /// User's deposit record — created on first deposit via init_if_needed
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserDeposit::INIT_SPACE,
        seeds = [b"deposit", user.key().as_ref()],
        bump,
    )]
    pub user_deposit: Account<'info, UserDeposit>,

    /// The vault token account (USDC ATA owned by tower PDA)
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = tower_state,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// User's USDC token account
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        constraint = usdc_mint.key() == tower_state.usdc_mint @ MonolithError::InvalidMint
    )]
    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"tower"],
        bump = tower_state.bump,
    )]
    pub tower_state: Account<'info, TowerState>,

    /// User's deposit record — must exist (they deposited before)
    #[account(
        mut,
        seeds = [b"deposit", user.key().as_ref()],
        bump = user_deposit.bump,
        constraint = user_deposit.owner == user.key() @ MonolithError::InsufficientBalance,
    )]
    pub user_deposit: Account<'info, UserDeposit>,

    /// The vault token account
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = tower_state,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// User's USDC token account — receives the withdrawal
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        constraint = usdc_mint.key() == tower_state.usdc_mint @ MonolithError::InvalidMint
    )]
    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}
