use anchor_lang::prelude::*;
use anchor_lang::system_program;

pub fn issue(ctx: Context<FBIssue>, price: u64, goalcount: u64, ipid: u64) -> Result<()> {
    let contract_account = &mut ctx.accounts.contract;
    let signer = &mut ctx.accounts.signer;
    contract_account.author = signer.to_account_info().key();
    contract_account.ipid = ipid;
    contract_account.price = price;
    contract_account.goalcount = goalcount;
    contract_account.headcount = 0;

    Ok(())
}

pub fn buy(ctx: Context<FBBuy>, author: Pubkey, ipid: u64) -> Result<()> {
    let buyer = &mut ctx.accounts.signer;
    let contract = &mut ctx.accounts.contract;
    let buyer_account = &mut ctx.accounts.buyer_account;
    require!(buyer.get_lamports() >= contract.price, ErrorCode::LamportsNotEnough);
    require!(contract.headcount < contract.goalcount, ErrorCode::GoalAlreadyAchieved);

    buyer_account.buyer = buyer.key();
    contract.headcount += 1;

    let transfer = system_program::Transfer {
        from: buyer.to_account_info(),
        to:   contract.to_account_info(),
    };
    let cpi= CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer);
    system_program::transfer(cpi, contract.price)
}



#[derive(Accounts)]
#[instruction(ipid: u64)]
pub struct FBIssue<'info> {
    #[account(
        init, payer = signer, space = 8 + FBContractAccount::INIT_SPACE,
        seeds = [b"fb-contract", signer.key().as_ref(), ipid.to_le_bytes().as_ref()], bump 
    )]
    contract: Account<'info, FBContractAccount>,
    #[account(mut)]
    signer: Signer<'info>,
    system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(author: Pubkey, ipid: u64)]
pub struct FBBuy<'info> {
    #[account(mut, seeds = [b"fb-contract", author.as_ref(), ipid.to_le_bytes().as_ref()], bump)]
    contract: Account<'info, FBContractAccount>,
    #[account(
        init, payer = signer, space = 8 + FBContractAccount::INIT_SPACE,
        seeds = [b"fb-buyer", signer.key().as_ref(), contract.key().as_ref()], bump
    )]
    buyer_account: Account<'info, BuyerAccount>,
    #[account(mut)]
    signer: Signer<'info>,
    system_program: Program<'info, System>
}

#[account]
#[derive(InitSpace)]
pub struct FBContractAccount {
    author: Pubkey,
    ipid: u64,
    price:  u64,
    goalcount: u64,
    headcount: u64
}

#[account]
#[derive(InitSpace)]
pub struct BuyerAccount {
    buyer: Pubkey
}

#[error_code]
pub enum ErrorCode {
    LamportsNotEnough,
    GoalAlreadyAchieved,
}