use anchor_lang::prelude::*;

use crate::{CreateIPAccount, CreateUserAccount, DeleteIPAccount, DeleteUserAccount, IP_OWNERSHIP_PRIVATE};
use crate::state::ErrorCode;

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
    ctx.accounts.ip_account.ownership = IP_OWNERSHIP_PRIVATE;

    Ok(())
}

pub fn delete_ip_account(_ctx: Context<DeleteIPAccount>, _ipid: String) -> Result<()> {
    require!(_ctx.accounts.ip_account.ownership.eq(&IP_OWNERSHIP_PRIVATE), ErrorCode::WrongIPOwnership);
    Ok(())
}