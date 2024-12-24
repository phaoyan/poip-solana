use anchor_lang::prelude::*;

use crate::{CreateIPAccount, CreateUserAccount, DeleteIPAccount, DeleteUserAccount, UpdateIPAccountIntro, UpdateIPAccountLink, IP_OWNERSHIP_PRIVATE};
use crate::state::ErrorCode;

pub fn create_user_account(ctx: Context<CreateUserAccount>) -> Result<()> {
    ctx.accounts.user_account.user_addr = ctx.accounts.signer.key();
    Ok(())
}

pub fn delete_user_account(_ctx: Context<DeleteUserAccount>) -> Result<()> {
    Ok(())
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

pub fn delete_ip_account(_ctx: Context<DeleteIPAccount>, _ipid: Pubkey) -> Result<()> {
    require!(_ctx.accounts.ip_account.ownership.eq(&IP_OWNERSHIP_PRIVATE), ErrorCode::WrongIPOwnership);
    Ok(())
}