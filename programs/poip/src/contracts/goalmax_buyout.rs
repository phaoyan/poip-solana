use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{CIAccount, CPAccount, IPAccount, IP_OWNERSHIP_PRIVATE, IP_OWNERSHIP_PUBLIC, IP_OWNERSHIP_PUBLISHED};
use crate::state::ErrorCode;

#[derive(Accounts)]
#[instruction(ipid: Pubkey)]
pub struct Publish<'info> {
    #[account(
        init, payer = signer, space = 8 + CIAccount::INIT_SPACE,
        seeds = [b"ci", ipid.key().as_ref()], bump
    )]
    pub ci_account: Account<'info, CIAccount>,

    #[account(mut, seeds = [b"ip", ipid.key().as_ref()], bump)]
    pub ip_account: Account<'info, IPAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = token_mint,
        associated_token::authority = ci_account,
    )]
    pub ci_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn publish(ctx: Context<Publish>, ipid: Pubkey, price: u64, goalcount: u64, maxcount: u64) -> Result<()> {
    let ip_account = &mut ctx.accounts.ip_account;
    let ci_account = &mut ctx.accounts.ci_account;

    require!(ip_account.ownership.eq(&IP_OWNERSHIP_PRIVATE), ErrorCode::WrongIPOwnership);
    require!(price > 0, ErrorCode::InvalidPrice);
    require!(goalcount > 0, ErrorCode::InvalidGoalcount);
    require!(maxcount >= goalcount, ErrorCode::InvalidMaxcount);

    ip_account.ownership = IP_OWNERSHIP_PUBLISHED;
    ci_account.ipid = ipid;
    ci_account.token_mint = ctx.accounts.token_mint.key();
    ci_account.price = price;
    ci_account.goalcount = goalcount;
    ci_account.maxcount  = maxcount;
    ci_account.currcount = 0;
    ci_account.withdrawal_count = 0;

    Ok(())
}


#[derive(Accounts)]
#[instruction(ipid: Pubkey)]
pub struct  Pay<'info> {
    #[account(
        init, payer = signer, space = 8 + CPAccount::INIT_SPACE,
        seeds = [b"cp", signer.key().as_ref(), ci_account.key().as_ref()], bump
    )]
    pub cp_account: Account<'info, CPAccount>,

    #[account(mut, seeds = [b"ci", ipid.key().as_ref()], bump)]
    pub ci_account: Account<'info, CIAccount>,

    #[account(mut, seeds = [b"ip", ipid.key().as_ref()], bump)]
    pub ip_account: Account<'info, IPAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub payer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = ci_account.token_mint,
        associated_token::authority = ci_account,
    )]
    pub ci_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn pay(ctx: Context<Pay>, ipid: Pubkey) -> Result<()> {
    let ip_account   = &mut ctx.accounts.ip_account;
    let ci_account = &mut ctx.accounts.ci_account;
    let cp_account = &mut ctx.accounts.cp_account;

    // 实际付款 = price - withdrawable
    let withdrawable =
        if ci_account.currcount < ci_account.goalcount { 0 }
        else { (ci_account.currcount + 1 - ci_account.goalcount) * ci_account.price / (ci_account.currcount + 1) };

    require!(ip_account.ownership.eq(&IP_OWNERSHIP_PUBLISHED), ErrorCode::WrongIPOwnership);
    require!(ci_account.currcount < ci_account.maxcount, ErrorCode::GoalAlreadyAchieved);

    ci_account.currcount  += 1;
    cp_account.ipid        = ipid;
    cp_account.owner       = ctx.accounts.signer.key();
    cp_account.withdrawal += withdrawable;

    if ci_account.currcount == ci_account.maxcount {
        ip_account.ownership = IP_OWNERSHIP_PUBLIC;
    }

    let transfer_instruction = Transfer {
        from: ctx.accounts.payer_token_account.to_account_info(),
        to: ctx.accounts.ci_token_account.to_account_info(),
        authority: ctx.accounts.signer.to_account_info(),
    };
    let cpi_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        transfer_instruction,
    );
    token::transfer(cpi_context, ci_account.price - withdrawable)?;

    Ok(())
}


#[derive(Accounts)]
#[instruction(ipid: Pubkey)]
pub struct Withdraw<'info> {
    #[account(mut, seeds = [b"ci", ipid.key().as_ref()], bump)]
    pub ci_account: Account<'info, CIAccount>,

    #[account(mut, seeds = [b"ip", ipid.key().as_ref()], bump)]
    pub ip_account: Account<'info, IPAccount>,

    #[account(mut, constraint = signer.key().eq(&ip_account.owner))]
    pub signer: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = ci_account.token_mint,
        associated_token::authority = ci_account,
    )]
    pub ci_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn withdraw(ctx: Context<Withdraw>, _ipid: Pubkey) -> Result<()> {
    let ci_account = &mut ctx.accounts.ci_account;
    let withdrawable_count = std::cmp::min(ci_account.currcount, ci_account.goalcount) - ci_account.withdrawal_count;

    require!(withdrawable_count > 0, ErrorCode::ContractHasNoLamports);

    let withdrawable_amount = withdrawable_count * ci_account.price;
    ci_account.withdrawal_count += withdrawable_count;

    let transfer_instruction = Transfer {
        from: ctx.accounts.ci_token_account.to_account_info(),
        to: ctx.accounts.owner_token_account.to_account_info(),
        authority: ctx.accounts.ci_account.to_account_info(), // Program as authority
    };
    let bump_seed = ctx.bumps.ci_account;
    let seeds = &[b"ci", ctx.accounts.ci_account.ipid.as_ref(), &[bump_seed]]; // Ensure bump is correctly passed if needed
    let signer_seeds = &[&seeds[..]];
    let cpi_context: CpiContext<'_, '_, '_, '_, Transfer<'_>> = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_instruction,
        signer_seeds,
    );
    token::transfer(cpi_context, withdrawable_amount)?;

    Ok(())
}



#[derive(Accounts)]
#[instruction(ipid: Pubkey)]
pub struct  Bonus<'info> {
    #[account(mut, seeds = [b"ci", ipid.key().as_ref()], bump)]
    pub ci_account: Account<'info, CIAccount>,

    #[account(mut, seeds = [b"cp", signer.key().as_ref(), ci_account.key().as_ref()], bump)]
    pub cp_account: Account<'info, CPAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = ci_account.token_mint,
        associated_token::authority = ci_account,
    )]
    pub ci_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn bonus(ctx: Context<Bonus>, _ipid: Pubkey) -> Result<()> {
    let ci_account = &mut ctx.accounts.ci_account;
    let cp_account = &mut ctx.accounts.cp_account;

    let diff = ci_account.currcount.saturating_sub(ci_account.goalcount);
    let numerator = diff.checked_mul(ci_account.price).ok_or(ErrorCode::MathFailure)?;
    let denominator = ci_account.currcount;
    let withdrawable_unprocessed = if denominator == 0 { 0 } else { numerator.checked_div(denominator).ok_or(ErrorCode::MathFailure)? };

    let withdrawable = withdrawable_unprocessed.saturating_sub(cp_account.withdrawal);

    require!(withdrawable > 0, ErrorCode::ContractHasNoLamports);

    cp_account.withdrawal += withdrawable;

    let transfer_instruction = Transfer {
        from: ctx.accounts.ci_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.ci_account.to_account_info(), // Program as authority
    };
    let bump_seed = ctx.bumps.ci_account;
    let seeds = &[b"ci", ctx.accounts.ci_account.ipid.as_ref(), &[bump_seed]]; // Ensure bump is correctly passed if needed
    let signer_seeds = &[&seeds[..]];
    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_instruction,
        signer_seeds,
    );
    token::transfer(cpi_context, withdrawable)?;

    Ok(())
}