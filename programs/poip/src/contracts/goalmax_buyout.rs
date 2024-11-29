use anchor_lang::{prelude::*, system_program};

use crate::{IPAccount, IPOwnership, UserAccount};
use crate::general::ErrorCode;

pub fn publish(ctx: Context<GMPublish>, price: u64, goalcount: u64, maxcount: u64, _ipid: String) -> Result<()> {
    let ip_account = &mut ctx.accounts.ip_account;
    let ci_account = &mut ctx.accounts.ci_account;

    require!(ip_account.ownership.eq(&IPOwnership::PRIVATE), ErrorCode::WrongIPOwnership);
    require!(price > 0, ErrorCode::InvalidPrice);

    ip_account.ownership = IPOwnership::PUBLISHED;
    ci_account.ip_account = ip_account.key();
    ci_account.price = price;
    ci_account.goalcount = goalcount;
    ci_account.maxcount  = maxcount;
    ci_account.currcount = 0;
    ci_account.withdrawal_count = 0;

    Ok(())
}

pub fn pay(ctx: Context<GMPay>, _ipid: String) -> Result<()> {
    let ip_account   = &mut ctx.accounts.ip_account;
    let ci_account = &mut ctx.accounts.ci_account;
    let cp_account = &mut ctx.accounts.cp_account;
        // 实际付款 = price - withdrawable
        let withdrawable = 
        if ci_account.currcount <= ci_account.goalcount { 0 } 
        else { (ci_account.currcount - ci_account.goalcount) * ci_account.price / ci_account.currcount - cp_account.withdrawal }; 
    
    require!(ip_account.ownership.eq(&IPOwnership::PUBLISHED), ErrorCode::WrongIPOwnership);
    require!(ci_account.currcount < ci_account.maxcount, ErrorCode::WrongIPOwnership);

    ci_account.currcount += 1;
    cp_account.withdrawal += withdrawable;

    if ci_account.currcount == ci_account.maxcount {
        ip_account.ownership = IPOwnership::PUBLIC;
    }

    let transfer = system_program::Transfer {
        from: ctx.accounts.signer.to_account_info(),
        to: ci_account.to_account_info(),
    };
    let cpi = CpiContext::new(
        ctx.accounts.system_program.to_account_info(), 
        transfer);
    system_program::transfer(cpi, ci_account.price - withdrawable)
}

pub fn withdraw(ctx: Context<GMWithdraw>, _ipid: String) -> Result<()> {
    let ci_account = &mut ctx.accounts.ci_account;
    let owner = &mut ctx.accounts.owner_account;
    let withdrawable = std::cmp::min(ci_account.currcount, ci_account.goalcount) - ci_account.withdrawal_count;
    require!(std::cmp::min(ci_account.currcount, ci_account.goalcount) > ci_account.withdrawal_count, ErrorCode::ContractHasNoLamports);

    ci_account.withdrawal_count += withdrawable;
    **ci_account.to_account_info().try_borrow_mut_lamports()? -= withdrawable * ci_account.price;
    **owner.to_account_info().try_borrow_mut_lamports()? += withdrawable * ci_account.price;

    Ok(())
}

pub fn bonus(ctx: Context<GMBonus>, _ipid: String) -> Result<()> {
    let ci_account = &mut ctx.accounts.ci_account;
    let cp_account = &mut ctx.accounts.cp_account;
    let payer = &mut ctx.accounts.user_account;
    let withdrawable = 
        if ci_account.currcount <= ci_account.goalcount { 0 } 
        else { (ci_account.currcount - ci_account.goalcount) * ci_account.price / ci_account.currcount - cp_account.withdrawal };
    require!(withdrawable > 0, ErrorCode::ContractHasNoLamports);

    cp_account.withdrawal += withdrawable;
    **ci_account.to_account_info().try_borrow_mut_lamports()? -= withdrawable;
    **payer.to_account_info().try_borrow_mut_lamports()? += withdrawable;

    Ok(())
}

#[derive(Accounts)]
#[instruction(price: u64, goalcount: u64, maxcount: u64, ipid: String)]
pub struct GMPublish<'info> {
    #[account(
        init, payer = signer, space = 8 + GMCIAccount::INIT_SPACE,
        seeds = [b"gmci", ipid.as_bytes().as_ref()], bump
    )]
    ci_account: Account<'info, GMCIAccount>,
    
    #[account(mut, seeds = [b"ip", ipid.as_bytes().as_ref()], bump)]
    ip_account: Account<'info, IPAccount>,
    
    #[account(mut, constraint = ip_account.owner.eq(&owner_account.key()))]
    owner_account: Account<'info, UserAccount>,

    #[account(mut, constraint = signer.key().eq(&owner_account.useraddr))]
    signer: Signer<'info>,

    system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: String)]
pub struct  GMPay<'info> {
    #[account(
        init, payer = signer, space = 8 + GMCPAccount::INIT_SPACE,
        seeds = [b"gmcp", user_account.key().as_ref(), ci_account.key().as_ref()], bump
    )]
    cp_account: Account<'info, GMCPAccount>,

    #[account(mut, seeds = [b"gmci", ipid.as_bytes().as_ref()], bump)]
    ci_account: Account<'info, GMCIAccount>,

    #[account(
        mut, seeds = [b"ip", ipid.as_bytes().as_ref()], bump,
        constraint = ip_account.ownership.eq(&IPOwnership::PUBLISHED)
    )]
    ip_account: Account<'info, IPAccount>,

    #[account(seeds = [b"user", signer.key().as_ref()], bump)]
    user_account: Account<'info, UserAccount>,

    #[account(mut)]
    signer: Signer<'info>,

    system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: String)]
pub struct GMWithdraw<'info> {
    #[account(mut, seeds = [b"gmci", ipid.as_bytes().as_ref()], bump)]
    ci_account: Account<'info, GMCIAccount>,

    #[account(mut, seeds = [b"ip", ipid.as_bytes().as_ref()], bump)]
    ip_account: Account<'info, IPAccount>,

    #[account(mut, constraint = ip_account.owner.eq(&owner_account.key()))]
    owner_account: Account<'info, UserAccount>,

    #[account(mut, constraint = signer.key().eq(&owner_account.useraddr))]
    signer: Signer<'info>,

    system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: String)]
pub struct  GMBonus<'info> {
    #[account(mut, seeds = [b"gmci", ipid.as_bytes().as_ref()], bump)]
    ci_account: Account<'info, GMCIAccount>,

    #[account(mut, seeds = [b"gmcp", user_account.key().as_ref(), ci_account.key().as_ref()], bump)]
    cp_account: Account<'info, GMCPAccount>,

    #[account(mut, seeds = [b"user", signer.key().as_ref()], bump)]
    user_account: Account<'info, UserAccount>,

    #[account(mut)]
    signer: Signer<'info>,

    system_program: Program<'info, System>
}

#[account]
#[derive(InitSpace)]
pub struct GMCIAccount {
    ip_account: Pubkey,
    price: u64,
    goalcount: u64,
    maxcount: u64,
    currcount: u64,
    withdrawal_count: u64, // owner提钱（按headcount算）
}

#[account]
#[derive(InitSpace)]
pub struct GMCPAccount {
    withdrawal: u64
}

