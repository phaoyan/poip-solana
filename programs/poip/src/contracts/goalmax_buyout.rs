use anchor_lang::{prelude::*, system_program};

use crate::{Bonus, Pay, Publish, Withdraw, CONTRACT_TYPE_GOALMAX_BUYOUT, IP_OWNERSHIP_PRIVATE, IP_OWNERSHIP_PUBLIC, IP_OWNERSHIP_PUBLISHED};
use crate::state::ErrorCode;

pub fn publish(ctx: Context<Publish>, _ipid: String, price: u64, goalcount: u64, maxcount: u64) -> Result<()> {
    let ip_account = &mut ctx.accounts.ip_account;
    let ci_account = &mut ctx.accounts.ci_account;

    require!(ip_account.ownership.eq(&IP_OWNERSHIP_PRIVATE), ErrorCode::WrongIPOwnership);
    require!(price > 0, ErrorCode::InvalidPrice);
    require!(goalcount > 0, ErrorCode::InvalidGoalcount);
    require!(maxcount > goalcount, ErrorCode::InvalidMaxcount);

    ip_account.ownership = IP_OWNERSHIP_PUBLISHED;
    ci_account.contract_type = CONTRACT_TYPE_GOALMAX_BUYOUT;
    ci_account.price = price;
    ci_account.goalcount = goalcount;
    ci_account.maxcount  = maxcount;
    ci_account.currcount = 0;
    ci_account.withdrawal_count = 0;

    Ok(())
}

pub fn pay(ctx: Context<Pay>, _ipid: String) -> Result<()> {
    let ip_account   = &mut ctx.accounts.ip_account;
    let ci_account = &mut ctx.accounts.ci_account;
    let cp_account = &mut ctx.accounts.cp_account;

    // 实际付款 = price - withdrawable
    let withdrawable = 
        if ci_account.currcount < ci_account.goalcount { 0 } 
        else { (ci_account.currcount + 1 - ci_account.goalcount) * ci_account.price / (ci_account.currcount + 1) }; 
    
    require!(ci_account.contract_type.eq(&CONTRACT_TYPE_GOALMAX_BUYOUT), ErrorCode::WrongContractType);
    require!(ip_account.ownership.eq(&IP_OWNERSHIP_PUBLISHED), ErrorCode::WrongIPOwnership);
    require!(ci_account.currcount < ci_account.maxcount, ErrorCode::WrongIPOwnership);

    ci_account.currcount += 1;
    cp_account.withdrawal += withdrawable;

    if ci_account.currcount == ci_account.maxcount {
        ip_account.ownership = IP_OWNERSHIP_PUBLIC;
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

pub fn withdraw(ctx: Context<Withdraw>, _ipid: String) -> Result<()> {
    let ci_account = &mut ctx.accounts.ci_account;
    let owner = &mut ctx.accounts.owner_account;
    let withdrawable = std::cmp::min(ci_account.currcount, ci_account.goalcount) - ci_account.withdrawal_count;

    require!(ci_account.contract_type.eq(&CONTRACT_TYPE_GOALMAX_BUYOUT), ErrorCode::WrongContractType);
    require!(std::cmp::min(ci_account.currcount, ci_account.goalcount) > ci_account.withdrawal_count, ErrorCode::ContractHasNoLamports);

    ci_account.withdrawal_count += withdrawable;
    **ci_account.to_account_info().try_borrow_mut_lamports()? -= withdrawable * ci_account.price;
    **owner.to_account_info().try_borrow_mut_lamports()? += withdrawable * ci_account.price;

    Ok(())
}

pub fn bonus(ctx: Context<Bonus>, _ipid: String) -> Result<()> {
    let ci_account = &mut ctx.accounts.ci_account;
    let cp_account = &mut ctx.accounts.cp_account;
    let payer = &mut ctx.accounts.user_account;
    let withdrawable = 
        if ci_account.currcount <= ci_account.goalcount { 0 } 
        else { (ci_account.currcount - ci_account.goalcount) * ci_account.price / ci_account.currcount - cp_account.withdrawal };

    require!(ci_account.contract_type.eq(&CONTRACT_TYPE_GOALMAX_BUYOUT), ErrorCode::WrongContractType);
    require!(withdrawable > 0, ErrorCode::ContractHasNoLamports);

    cp_account.withdrawal += withdrawable;
    **ci_account.to_account_info().try_borrow_mut_lamports()? -= withdrawable;
    **payer.to_account_info().try_borrow_mut_lamports()? += withdrawable;

    Ok(())
}
