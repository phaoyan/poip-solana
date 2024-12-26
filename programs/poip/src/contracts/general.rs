use anchor_lang::prelude::*;

use crate::{IPAccount, IP_OWNERSHIP_PRIVATE};
use crate::state::ErrorCode;

#[derive(Accounts)]
#[instruction(ipid: Pubkey, link: String, intro: String)]
pub struct CreateIPAccount<'info> {
    #[account(
        init, payer = signer, space = 8 + 32 + 4 + link.len() + 4 + intro.len() + 32 + 8,
        seeds = [b"ip", ipid.key().as_ref()], bump
    )]
    pub ip_account: Account<'info, IPAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: Pubkey)]
pub struct DeleteIPAccount<'info> {
    #[account(
        mut, close = signer,
        seeds = [b"ip", ipid.key().as_ref()], bump
    )]
    pub ip_account: Account<'info, IPAccount>,
    
    #[account(mut)]
    pub signer: Signer<'info>,
    
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: Pubkey, value: String)]
pub struct UpdateIPAccountLink<'info> {
    #[account(
        mut,
        seeds = [b"ip", ipid.key().as_ref()],
        bump,
        realloc = 8 + 32 + 4 + value.len() + 4 + ip_account.intro.len() + 32 + 8,
        realloc::zero = false,
        realloc::payer = signer,
    )]
    pub ip_account: Account<'info, IPAccount>,
    
    #[account(mut)]
    pub signer: Signer<'info>,
    
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: Pubkey, value: String)]
pub struct UpdateIPAccountIntro<'info> {
    #[account(
        mut,
        seeds = [b"ip", ipid.key().as_ref()],
        bump,
        realloc = 8 + 32 + 4 + value.len() + 4 + ip_account.intro.len() + 32 + 8,
        realloc::zero = false,
        realloc::payer = signer,
    )]
    pub ip_account: Account<'info, IPAccount>,
    
    #[account(mut)]
    pub signer: Signer<'info>,
    
    pub system_program: Program<'info, System>
}

pub fn create_ip_account(ctx: Context<CreateIPAccount>, ipid: Pubkey, link: String, intro: String) -> Result<()> {
    ctx.accounts.ip_account.ipid = ipid;
    ctx.accounts.ip_account.link = link;
    ctx.accounts.ip_account.intro = intro;
    ctx.accounts.ip_account.owner = ctx.accounts.signer.key();
    ctx.accounts.ip_account.ownership = IP_OWNERSHIP_PRIVATE;

    Ok(())
}

pub fn update_ip_account_link(ctx: Context<UpdateIPAccountLink>, _ipid: Pubkey, value: String) -> Result<()> {
    ctx.accounts.ip_account.link = value;
    Ok(())
}

pub fn update_ip_account_intro(ctx: Context<UpdateIPAccountIntro>, _ipid: Pubkey, value: String) -> Result<()> {
    ctx.accounts.ip_account.intro = value;
    Ok(())
}

pub fn delete_ip_account(ctx: Context<DeleteIPAccount>, _ipid: Pubkey) -> Result<()> {
    require!(ctx.accounts.ip_account.ownership.eq(&IP_OWNERSHIP_PRIVATE), ErrorCode::WrongIPOwnership);
    Ok(())
}