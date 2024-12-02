mod state;
mod contracts;

use anchor_lang::prelude::*;
use state::*;
use contracts::*;



// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("6xSaDiBZ4R6i7Rk47zcRvuuNGeJ8NRApRfPqWksS7Xe2");

#[program]
mod poip {
    use super::*;
    
    pub fn create_user_account(ctx: Context<CreateUserAccount>) -> Result<()> {
        general::create_user_account(ctx)
    }

    pub fn delete_user_account(ctx: Context<DeleteUserAccount>) -> Result<()> {
        general::delete_user_account(ctx)
    }

    pub fn create_ip_account(ctx: Context<CreateIPAccount>, ipid: String, title: String) -> Result<()> {
        general::create_ip_account(ctx, ipid, title)
    }

    pub fn delete_ip_account(ctx: Context<DeleteIPAccount>, ipid: String) -> Result<()> {
        general::delete_ip_account(ctx, ipid)
    }

    pub  fn publish(ctx: Context<Publish>, ipid: String, price: u64, goalcount: u64, maxcount: u64, contract_type: u64) -> Result<()> {
        match contract_type {
            CONTRACT_TYPE_GOALMAX_BUYOUT => goalmax_buyout::publish(ctx, ipid, price, goalcount, maxcount),
            CONTRACT_TYPE_COMPENSATIVE_BUYOUT => compensative_buyout::publish(ctx, ipid, price, goalcount, maxcount),
            CONTRACT_TYPE_FINITE_BUYOUT => finite_buyout::publish(ctx, ipid, price, goalcount, maxcount),
            _ => Ok(())
        }
    }

    pub fn pay(ctx: Context<Pay>, ipid: String) -> Result<()> {
        match ctx.accounts.ci_account.contract_type {
            CONTRACT_TYPE_GOALMAX_BUYOUT => goalmax_buyout::pay(ctx, ipid),
            CONTRACT_TYPE_COMPENSATIVE_BUYOUT => compensative_buyout::pay(ctx, ipid),
            CONTRACT_TYPE_FINITE_BUYOUT => finite_buyout::pay(ctx, ipid),
            _ => Ok(())
        }
    }

    pub fn withraw(ctx: Context<Withdraw>, ipid: String) -> Result<()> {
        match ctx.accounts.ci_account.contract_type {
            CONTRACT_TYPE_GOALMAX_BUYOUT => goalmax_buyout::withdraw(ctx, ipid),
            CONTRACT_TYPE_COMPENSATIVE_BUYOUT => compensative_buyout::withdraw(ctx, ipid),
            CONTRACT_TYPE_FINITE_BUYOUT => finite_buyout::withdraw(ctx, ipid),
            _ => Ok(())
        }
    }

    pub fn bonus(ctx: Context<Bonus>, ipid: String) -> Result<()> {
        match ctx.accounts.ci_account.contract_type {
            CONTRACT_TYPE_GOALMAX_BUYOUT => goalmax_buyout::bonus(ctx, ipid),
            CONTRACT_TYPE_COMPENSATIVE_BUYOUT => compensative_buyout::bonus(ctx, ipid),
            _ => Ok(())
        }
    }


}

