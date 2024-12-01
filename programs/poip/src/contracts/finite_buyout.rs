use anchor_lang::{prelude::*, system_program};

use crate::{Pay, Publish, Withdraw, CONTRACT_TYPE_FINITE_BUYOUT, IP_OWNERSHIP_PRIVATE, IP_OWNERSHIP_PUBLIC, IP_OWNERSHIP_PUBLISHED};
use crate::state::ErrorCode;

pub fn publish(ctx: Context<Publish>, price: u64, goalcount: u64, _maxcount: u64, _ipid: String) -> Result<()> {
    let ip_account = &mut ctx.accounts.ip_account;
    let ci_account= &mut ctx.accounts.ci_account;

    require!(ip_account.ownership.eq(&IP_OWNERSHIP_PRIVATE), ErrorCode::WrongIPOwnership);
    require!(price > 0, ErrorCode::InvalidPrice);

    ip_account.ownership = IP_OWNERSHIP_PUBLISHED;
    ci_account.contract_type = CONTRACT_TYPE_FINITE_BUYOUT;
    ci_account.price = price;
    ci_account.goalcount = goalcount;
    ci_account.currcount = 0;
    ci_account.maxcount  = 0;
    ci_account.withdrawal_count = 0;

    Ok(())
}

pub fn pay(ctx: Context<Pay>, _ipid: String) -> Result<()> {
    let ci_account = &mut ctx.accounts.ci_account;
    let ip_account = &mut ctx.accounts.ip_account;

    require!(ctx.accounts.signer.get_lamports() >= ci_account.price, ErrorCode::LamportsNotEnough);
    require!(ip_account.ownership.eq(&IP_OWNERSHIP_PUBLISHED), ErrorCode::GoalAlreadyAchieved);
    require!(ci_account.currcount < ci_account.goalcount, ErrorCode::GoalAlreadyAchieved);
    require!(ci_account.contract_type.eq(&CONTRACT_TYPE_FINITE_BUYOUT), ErrorCode::WrongContractType);

    ci_account.currcount += 1;
    if ci_account.currcount == ci_account.goalcount {
        ip_account.ownership = IP_OWNERSHIP_PUBLIC;
    }

    let transfer = system_program::Transfer {
        from: ctx.accounts.signer.to_account_info(),
        to: ci_account.to_account_info(),
    };
    let cpi = CpiContext::new(
        ctx.accounts.system_program.to_account_info(), 
        transfer);
    system_program::transfer(cpi, ci_account.price)
}

pub fn withdraw(ctx: Context<Withdraw>, _ipid: String) -> Result<()> {
    let ci_account = &mut ctx.accounts.ci_account;
    let owner = &mut ctx.accounts.owner_account;
    let withdrawable = (ci_account.currcount - ci_account.withdrawal_count) * ci_account.price;

    require!(ci_account.currcount - ci_account.withdrawal_count > 0, ErrorCode::ContractHasNoLamports);
    require!(ci_account.contract_type.eq(&CONTRACT_TYPE_FINITE_BUYOUT), ErrorCode::WrongContractType);

    ci_account.withdrawal_count = ci_account.currcount;
    **ci_account.to_account_info().try_borrow_mut_lamports()? -= withdrawable;
    **owner.to_account_info().try_borrow_mut_lamports()? += withdrawable;

    Ok(())
}