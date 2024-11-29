use anchor_lang::{prelude::*, system_program};

use crate::{IPAccount, IPOwnership, UserAccount};
use crate::general::ErrorCode;

pub fn publish(ctx: Context<FBPublish>, price: u64, goalcount: u64, _ipid: String) -> Result<()> {
    let ip_account = &mut ctx.accounts.ip_account;
    let contract= &mut ctx.accounts.fbci_account;

    require!(ip_account.ownership.eq(&IPOwnership::PRIVATE), ErrorCode::WrongIPOwnership);
    require!(price > 0, ErrorCode::InvalidPrice);

    ip_account.ownership = IPOwnership::PUBLISHED;
    contract.ip_account = ip_account.key();
    contract.price = price;
    contract.goalcount = goalcount;
    contract.currcount = 0;
    contract.withdrawal_count = 0;

    Ok(())
}

pub fn pay(ctx: Context<FBPay>, _ipid: String) -> Result<()> {
    let fbci = &mut ctx.accounts.fbci_account;
    let ip_account = &mut ctx.accounts.ip_account;

    require!(ctx.accounts.signer.get_lamports() >= fbci.price, ErrorCode::LamportsNotEnough);
    require!(ip_account.ownership.eq(&IPOwnership::PUBLISHED), ErrorCode::GoalAlreadyAchieved);
    require!(fbci.currcount < fbci.goalcount, ErrorCode::GoalAlreadyAchieved);

    fbci.currcount += 1;
    if fbci.currcount == fbci.goalcount {
        ip_account.ownership = IPOwnership::PUBLIC;
    }

    let transfer = system_program::Transfer {
        from: ctx.accounts.signer.to_account_info(),
        to: fbci.to_account_info(),
    };
    let cpi = CpiContext::new(
        ctx.accounts.system_program.to_account_info(), 
        transfer);
    system_program::transfer(cpi, fbci.price)
}

pub fn withdraw(ctx: Context<FBWithdraw>, _ipid: String) -> Result<()> {
    let fbci = &mut ctx.accounts.fbci_account;
    let owner = &mut ctx.accounts.owner_account;
    let withdrawable = (fbci.currcount - fbci.withdrawal_count) * fbci.price;

    require!(fbci.currcount - fbci.withdrawal_count > 0, ErrorCode::ContractHasNoLamports);

    fbci.withdrawal_count = fbci.currcount;
    **fbci.to_account_info().try_borrow_mut_lamports()? -= withdrawable;
    **owner.to_account_info().try_borrow_mut_lamports()? += withdrawable;

    Ok(())
}

#[derive(Accounts)]
#[instruction(price: u64, goalcount: u64, ipid: String)]
pub struct FBPublish<'info> {
    #[account(
        init, payer = signer, space = 8 + FBCIAccount::INIT_SPACE,
        seeds = [b"fbci", ipid.as_bytes().as_ref()], bump
    )]
    fbci_account: Account<'info, FBCIAccount>,

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
pub struct FBPay<'info> {
    #[account(
        init, payer = signer, space = 8 + FBCPAccount::INIT_SPACE,
        seeds = [b"fbcp", user_account.key().as_ref(), fbci_account.key().as_ref()], bump
    )]
    fbcp_account: Account<'info, FBCPAccount>,

    #[account(mut, seeds = [b"fbci", ipid.as_bytes().as_ref()], bump)]
    fbci_account: Account<'info, FBCIAccount>,

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
pub struct FBWithdraw<'info> {
    #[account(mut, seeds = [b"fbci", ipid.as_bytes().as_ref()], bump)]
    fbci_account: Account<'info, FBCIAccount>,

    #[account(mut, seeds = [b"ip", ipid.as_bytes().as_ref()], bump)]
    ip_account: Account<'info, IPAccount>,

    #[account(mut, constraint = ip_account.owner.eq(&owner_account.key()))]
    owner_account: Account<'info, UserAccount>,

    #[account(mut, constraint = signer.key().eq(&owner_account.useraddr))]
    signer: Signer<'info>,

    system_program: Program<'info, System>
}

#[account]
#[derive(InitSpace)]
pub struct FBCIAccount { // Finite Buyout Contract Issue Account
    ip_account: Pubkey,
    price: u64,
    goalcount: u64,
    currcount: u64,
    withdrawal_count: u64
}

#[account]
#[derive(InitSpace)]
pub struct FBCPAccount { // Finite Buyout Contract Payment Account
    
}

