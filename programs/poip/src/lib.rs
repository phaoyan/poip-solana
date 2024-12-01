mod general;
mod contracts;

use anchor_lang::prelude::*;
use general::*;
use contracts::*;



// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("6xSaDiBZ4R6i7Rk47zcRvuuNGeJ8NRApRfPqWksS7Xe2");

#[program]
mod poip {
    use super::*;
    
    pub fn create_user_account(ctx: Context<CreateUserAccount>, username: String) -> Result<()> {
        general::create_user_account(ctx, username)
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
    
    pub fn fb_publish(ctx: Context<Publish>, price: u64, goalcount: u64, maxcount: u64, ipid: String) -> Result<()> {
        finite_buyout::publish(ctx, price, goalcount, maxcount, ipid)
    }

    pub fn fb_pay(ctx: Context<Pay>, ipid: String) -> Result<()> {
        finite_buyout::pay(ctx, ipid)
    }

    pub fn fb_withdraw(ctx: Context<Withdraw>, ipid: String) -> Result<()> {
        finite_buyout::withdraw(ctx, ipid)
    }

    pub  fn cb_publish(ctx: Context<Publish>, price: u64, goalcount: u64, maxcount: u64, ipid: String) -> Result<()> {
        compensative_buyout::publish(ctx, price, goalcount, maxcount, ipid)
    }

    pub fn cb_pay(ctx: Context<Pay>, ipid: String) -> Result<()> {
        compensative_buyout::pay(ctx, ipid)
    }

    pub fn cb_withraw(ctx: Context<Withdraw>, ipid: String) -> Result<()> {
        compensative_buyout::withdraw(ctx, ipid)
    }

    pub fn cb_bonus(ctx: Context<Bonus>, ipid: String) -> Result<()> {
        compensative_buyout::bonus(ctx, ipid)
    }

    pub  fn gm_publish(ctx: Context<Publish>, price: u64, goalcount: u64, maxcount: u64, ipid: String) -> Result<()> {
        goalmax_buyout::publish(ctx, price, goalcount, maxcount, ipid)
    }

    pub fn gm_pay(ctx: Context<Pay>, ipid: String) -> Result<()> {
        goalmax_buyout::pay(ctx, ipid)
    }

    pub fn gm_withraw(ctx: Context<Withdraw>, ipid: String) -> Result<()> {
        goalmax_buyout::withdraw(ctx, ipid)
    }

    pub fn gm_bonus(ctx: Context<Bonus>, ipid: String) -> Result<()> {
        goalmax_buyout::bonus(ctx, ipid)
    }


}

