use anchor_lang::{prelude::*, system_program};

use crate::{IPAccount, IPOwnership, UserAccount};
use crate::general::ErrorCode;

pub fn publish(ctx: Context<CBPublish>, price: u64, goalcount: u64, _ipid: String) -> Result<()> {
    let ip_account = &mut ctx.accounts.ip_account;
    let contract= &mut ctx.accounts.cbci_account;

    require!(ip_account.ownership.eq(&IPOwnership::PRIVATE), ErrorCode::WrongIPOwnership);
    require!(price > 0, ErrorCode::InvalidPrice);

    ip_account.ownership = IPOwnership::PUBLISHED;
    contract.ip_account = ctx.accounts.ip_account.key();
    contract.price = price;
    contract.goalcount = goalcount;
    contract.currcount = 0;
    contract.withdrawal_count = 0;

    Ok(())
}

pub fn pay(ctx: Context<CBPay>, _ipid: String) -> Result<()> {
    let cbci = &mut ctx.accounts.cbci_account;
    let cbcp = &mut ctx.accounts.cbcp_account;
    let ip_account = &mut ctx.accounts.ip_account;
    // 实际付款 = price - withdrawable
    let withdrawable = 
        if cbci.currcount <= cbci.goalcount { 0 } 
        else { (cbci.currcount - cbci.goalcount) * cbci.price / cbci.currcount - cbcp.withdrawal }; 
    require!(ctx.accounts.signer.get_lamports() >= cbci.price - withdrawable, ErrorCode::LamportsNotEnough);
    require!(ip_account.ownership.eq(&IPOwnership::PUBLISHED), ErrorCode::WrongIPOwnership);

    cbci.currcount += 1;
    cbcp.withdrawal = withdrawable;

    let transfer = system_program::Transfer {
        from: ctx.accounts.signer.to_account_info(),
        to: cbci.to_account_info(),
    };
    let cpi = CpiContext::new(
        ctx.accounts.system_program.to_account_info(), 
        transfer);
    system_program::transfer(cpi, cbci.price - withdrawable)
}

pub fn withdraw(ctx: Context<CBWithdraw>, _ipid: String) -> Result<()> {
    let cbci = &mut ctx.accounts.cbci_account;
    let owner = &mut ctx.accounts.owner_account;
    let withdrawable = std::cmp::min(cbci.currcount, cbci.goalcount) - cbci.withdrawal_count;
    require!(std::cmp::min(cbci.currcount, cbci.goalcount) > cbci.withdrawal_count, ErrorCode::ContractHasNoLamports);

    cbci.withdrawal_count += withdrawable;
    **cbci.to_account_info().try_borrow_mut_lamports()? -= withdrawable * cbci.price;
    **owner.to_account_info().try_borrow_mut_lamports()? += withdrawable * cbci.price;

    Ok(())
}

pub fn bonus(ctx: Context<CBBonus>, _ipid: String) -> Result<()> {
    let cbci = &mut ctx.accounts.cbci_account;
    let cbcp = &mut ctx.accounts.cbcp_account;
    let payer = &mut ctx.accounts.user_account;
    let withdrawable = 
        if cbci.currcount <= cbci.goalcount { 0 } 
        else { (cbci.currcount - cbci.goalcount) * cbci.price / cbci.currcount - cbcp.withdrawal };
    require!(withdrawable > 0, ErrorCode::ContractHasNoLamports);

    cbcp.withdrawal += withdrawable;
    **cbci.to_account_info().try_borrow_mut_lamports()? -= withdrawable;
    **payer.to_account_info().try_borrow_mut_lamports()? += withdrawable;

    Ok(())
}

#[derive(Accounts)]
#[instruction(price: u64, goalcount: u64, ipid: String)]
pub struct CBPublish<'info> {
    #[account(
        init, payer = signer, space = 8 + CBCIAccount::INIT_SPACE,
        seeds = [b"cbci", ipid.as_bytes().as_ref()], bump
    )]
    cbci_account: Account<'info, CBCIAccount>,

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
pub struct CBPay<'info> {
    #[account(
        init, payer = signer, space = 8 + CBCPAccount::INIT_SPACE,
        seeds = [b"cbcp", user_account.key().as_ref(), cbci_account.key().as_ref()], bump
    )]
    cbcp_account: Account<'info, CBCPAccount>,

    #[account(mut, seeds = [b"cbci", ipid.as_bytes().as_ref()], bump)]
    cbci_account: Account<'info, CBCIAccount>,

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
pub struct CBWithdraw<'info> {
    #[account(mut, seeds = [b"cbci", ipid.as_bytes().as_ref()], bump)]
    cbci_account: Account<'info, CBCIAccount>,
    
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
pub struct CBBonus<'info> {
    #[account(mut, seeds = [b"cbci", ipid.as_bytes().as_ref()], bump)]
    cbci_account: Account<'info, CBCIAccount>,

    #[account(mut, seeds = [b"cbcp", user_account.key().as_ref(), cbci_account.key().as_ref()], bump)]
    cbcp_account: Account<'info, CBCPAccount>,

    #[account(mut, seeds = [b"user", signer.key().as_ref()], bump)]
    user_account: Account<'info, UserAccount>,

    #[account(mut)]
    signer: Signer<'info>,

    system_program: Program<'info, System>
}

#[account]
#[derive(InitSpace)]
pub struct CBCIAccount {
    ip_account: Pubkey,
    price: u64,
    goalcount: u64,
    currcount: u64,
    withdrawal_count: u64, // owner提钱（按headcount算）
}

#[account]
#[derive(InitSpace)]
pub struct CBCPAccount {
    withdrawal: u64  // payer提钱（按钱实际值lamports算）
}