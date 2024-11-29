use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

pub fn create_user_account(ctx: Context<CreateUserAccount>, username: String) -> Result<()> {
    ctx.accounts.user_account.username = username;
    ctx.accounts.user_account.useraddr = ctx.accounts.signer.key();
    Ok(())
}

pub fn delete_user_account(_ctx: Context<DeleteUserAccount>) -> Result<()> {
    Ok(())
}

pub fn create_ip_account(ctx: Context<CreateIPAccount>, ipid: String, title: String) -> Result<()> {
    ctx.accounts.ip_account.ipid = ipid;
    ctx.accounts.ip_account.title = title;
    ctx.accounts.ip_account.owner = ctx.accounts.owner_account.key();
    ctx.accounts.ip_account.ownership = IPOwnership::PRIVATE;

    Ok(())
}

pub fn delete_ip_account(_ctx: Context<DeleteIPAccount>, _ipid: String) -> Result<()> {
    Ok(())
}




#[derive(Accounts)]
#[instruction(username: String)]
pub struct CreateUserAccount<'info> {
    #[account(
        init, payer = signer, space = 8 + 4 + username.len() + 32,
        seeds = [b"user", signer.key().as_ref()], bump
    )]
    user_account: Account<'info, UserAccount>,
    #[account(mut)]
    signer: Signer<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct  DeleteUserAccount<'info> {
    #[account(
        mut, close = signer,
        seeds = [b"user", signer.key().as_ref()], bump
    )]
    user_account: Account<'info, UserAccount>,
    #[account(mut)]
    signer: Signer<'info>,
    system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: String, title: String)]
pub struct CreateIPAccount<'info> {
    #[account(
        init, payer = signer, space = 8 + 4 + ipid.len() + 4 + title.len() + 32 + 4,
        seeds = [b"ip", ipid.as_bytes().as_ref()], bump
    )]
    ip_account: Account<'info, IPAccount>,
    #[account(
        seeds=[b"user", signer.key().as_ref()], bump
    )]
    owner_account: Account<'info, UserAccount>,
    #[account(mut)]
    signer: Signer<'info>,
    system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: String)]
pub struct DeleteIPAccount<'info> {
    #[account(
        mut, close = signer,
        seeds = [b"ip", ipid.as_bytes().as_ref()], bump
    )]
    ip_account: Account<'info, IPAccount>,
    #[account(
        seeds = [b"user", signer.key().as_ref()], bump
    )]
    owner_account: Account<'info, UserAccount>,
    signer: Signer<'info>,
    system_program: Program<'info, System>
}

#[account]
pub struct IPAccount {
    pub ipid: String,
    pub title: String,
    pub owner: Pubkey,
    pub ownership: IPOwnership,
}


#[account]
pub struct UserAccount {
    pub username: String,
    pub useraddr: Pubkey,
}

#[derive(Clone, BorshSerialize, BorshDeserialize, PartialEq, Eq)]
pub enum IPOwnership {
    PRIVATE, PUBLISHED, PUBLIC, 
}

#[error_code]
pub enum ErrorCode {
    InvalidPrice,
    LamportsNotEnough,
    GoalAlreadyAchieved,
    ContractHasNoLamports,
    WrongIPOwnership,
}