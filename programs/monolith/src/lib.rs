use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

pub mod error;
pub mod state;

use error::MonolithError;
use state::{BlockAccount, TowerState};

declare_id!("Fu76EqtVLqX2LKCW5ZW8zWBqdgsQTbkvQ9nBDyykgwDh");

/// Maximum number of blocks the tower can hold
pub const MAX_BLOCKS: u32 = 1000;

/// Minimum USDC stake required to claim a block (0.10 USDC = 100_000 in 6-decimal units)
pub const MIN_STAKE: u64 = 100_000;

#[program]
pub mod monolith {
    use super::*;

    /// Initializes the global tower state and creates the shared USDC vault.
    ///
    /// Called once by the deployer. The vault is an ATA owned by the tower PDA,
    /// holding all staked USDC from all blocks.
    pub fn initialize_tower(ctx: Context<InitializeTower>) -> Result<()> {
        let tower = &mut ctx.accounts.tower_state;
        tower.authority = ctx.accounts.authority.key();
        tower.usdc_mint = ctx.accounts.usdc_mint.key();
        tower.total_blocks_claimed = 0;
        tower.total_staked = 0;
        tower.bump = ctx.bumps.tower_state;

        msg!(
            "Tower initialized by {} with USDC mint {}",
            tower.authority,
            tower.usdc_mint
        );
        Ok(())
    }

    /// Deposits USDC to claim a new block on the tower.
    ///
    /// Creates a new BlockAccount PDA and transfers USDC from the player's
    /// associated token account to the shared vault.
    pub fn deposit_stake(
        ctx: Context<DepositStake>,
        block_id: u32,
        amount: u64,
        position_x: i16,
        position_y: i16,
        position_z: i16,
    ) -> Result<()> {
        require!(block_id < MAX_BLOCKS, MonolithError::InvalidBlockId);
        require!(amount >= MIN_STAKE, MonolithError::InsufficientStake);

        let decimals = ctx.accounts.usdc_mint.decimals;

        // Transfer USDC from player's ATA to the vault ATA
        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.player_token_account.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.player.to_account_info(),
                },
            ),
            amount,
            decimals,
        )?;

        // Initialize block data
        let block = &mut ctx.accounts.block_account;
        block.owner = ctx.accounts.player.key();
        block.block_id = block_id;
        block.stake_amount = amount;
        block.position_x = position_x;
        block.position_y = position_y;
        block.position_z = position_z;
        block.created_at = Clock::get()?.unix_timestamp;
        block.bump = ctx.bumps.block_account;

        // Update tower totals
        let tower = &mut ctx.accounts.tower_state;
        tower.total_blocks_claimed = tower.total_blocks_claimed.checked_add(1).unwrap();
        tower.total_staked = tower.total_staked.checked_add(amount).unwrap();

        msg!(
            "Block {} claimed by {} with {} USDC units",
            block_id,
            block.owner,
            amount
        );
        Ok(())
    }

    /// Adds more USDC stake to an already-owned block.
    pub fn add_stake(ctx: Context<AddStake>, _block_id: u32, amount: u64) -> Result<()> {
        require!(amount > 0, MonolithError::InsufficientStake);

        let decimals = ctx.accounts.usdc_mint.decimals;

        // Transfer additional USDC to the vault
        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.player_token_account.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.player.to_account_info(),
                },
            ),
            amount,
            decimals,
        )?;

        let block = &mut ctx.accounts.block_account;
        block.stake_amount = block.stake_amount.checked_add(amount).unwrap();

        let tower = &mut ctx.accounts.tower_state;
        tower.total_staked = tower.total_staked.checked_add(amount).unwrap();

        msg!(
            "Added {} USDC units to block {}. New total: {}",
            amount,
            block.block_id,
            block.stake_amount
        );
        Ok(())
    }

    /// Withdraws all USDC stake and releases the block (closes the account).
    ///
    /// USDC is transferred from the vault back to the player's ATA.
    /// The block PDA is closed and rent is returned to the owner.
    pub fn withdraw(ctx: Context<Withdraw>, _block_id: u32) -> Result<()> {
        let block = &ctx.accounts.block_account;
        let stake_returned = block.stake_amount;

        // Verify vault has enough balance
        require!(
            ctx.accounts.vault_token_account.amount >= stake_returned,
            MonolithError::InsufficientVaultBalance
        );

        let decimals = ctx.accounts.usdc_mint.decimals;

        // Transfer USDC from vault back to player using PDA signer seeds
        let tower_seeds: &[&[u8]] = &[b"tower", &[ctx.accounts.tower_state.bump]];
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.player_token_account.to_account_info(),
                    authority: ctx.accounts.tower_state.to_account_info(),
                },
                &[tower_seeds],
            ),
            stake_returned,
            decimals,
        )?;

        // Update tower totals before closing
        let tower = &mut ctx.accounts.tower_state;
        tower.total_blocks_claimed = tower.total_blocks_claimed.checked_sub(1).unwrap();
        tower.total_staked = tower.total_staked.checked_sub(stake_returned).unwrap();

        msg!(
            "Block {} released by {}. Returning {} USDC units",
            block.block_id,
            block.owner,
            stake_returned
        );

        // Account closure + rent refund handled by the `close` constraint
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Account validation structs
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeTower<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TowerState::INIT_SPACE,
        seeds = [b"tower"],
        bump,
    )]
    pub tower_state: Account<'info, TowerState>,

    /// The shared vault token account — ATA owned by the tower PDA.
    /// All staked USDC from all blocks is pooled here.
    #[account(
        init,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = tower_state,
        associated_token::token_program = token_program,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    /// The USDC mint address (validated at init, stored in tower state)
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
#[instruction(block_id: u32)]
pub struct DepositStake<'info> {
    #[account(
        mut,
        seeds = [b"tower"],
        bump = tower_state.bump,
    )]
    pub tower_state: Account<'info, TowerState>,

    /// The shared vault — receives USDC deposits
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = tower_state,
        associated_token::token_program = token_program,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = player,
        space = 8 + BlockAccount::INIT_SPACE,
        seeds = [b"block", block_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub block_account: Account<'info, BlockAccount>,

    /// USDC mint — must match tower's stored mint
    #[account(
        constraint = usdc_mint.key() == tower_state.usdc_mint @ MonolithError::InvalidMint
    )]
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    /// Player's USDC token account (source of funds)
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = player,
        associated_token::token_program = token_program,
    )]
    pub player_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
#[instruction(block_id: u32)]
pub struct AddStake<'info> {
    #[account(
        mut,
        seeds = [b"tower"],
        bump = tower_state.bump,
    )]
    pub tower_state: Account<'info, TowerState>,

    /// The shared vault — receives additional USDC
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = tower_state,
        associated_token::token_program = token_program,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"block", block_id.to_le_bytes().as_ref()],
        bump = block_account.bump,
        has_one = owner @ MonolithError::Unauthorized,
    )]
    pub block_account: Account<'info, BlockAccount>,

    /// USDC mint — must match tower's stored mint
    #[account(
        constraint = usdc_mint.key() == tower_state.usdc_mint @ MonolithError::InvalidMint
    )]
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    /// Player's USDC token account (source of additional funds)
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = player,
        associated_token::token_program = token_program,
    )]
    pub player_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Validated via has_one constraint on block_account
    pub owner: AccountInfo<'info>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(block_id: u32)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"tower"],
        bump = tower_state.bump,
    )]
    pub tower_state: Account<'info, TowerState>,

    /// The shared vault — USDC is returned from here to the player
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = tower_state,
        associated_token::token_program = token_program,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"block", block_id.to_le_bytes().as_ref()],
        bump = block_account.bump,
        has_one = owner @ MonolithError::Unauthorized,
        close = owner,
    )]
    pub block_account: Account<'info, BlockAccount>,

    /// USDC mint — must match tower's stored mint
    #[account(
        constraint = usdc_mint.key() == tower_state.usdc_mint @ MonolithError::InvalidMint
    )]
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    /// Player's USDC token account (receives returned funds)
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    pub player_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Validated via has_one constraint on block_account.
    /// Receives the rent when the block account is closed.
    #[account(mut)]
    pub owner: AccountInfo<'info>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
