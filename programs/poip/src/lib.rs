mod state;
mod contracts;

use anchor_lang::prelude::*;
use state::*;
use contracts::*;
use goalmax_buyout::*;
use general::*;

// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("GPN5tAQi5PMCGYuVFMb4tnXrhQwXAjes2mSoGXzb3RML");

#[program]
mod poip {
    use super::*;

    pub fn create_ip_account(ctx: Context<CreateIPAccount>, ipid: Pubkey, link: String, intro: String) -> Result<()> {
        general::create_ip_account(ctx, ipid, link, intro)
    }

    pub fn delete_ip_account(ctx: Context<DeleteIPAccount>, ipid: Pubkey) -> Result<()> {
        general::delete_ip_account(ctx, ipid)
    }

    pub fn update_ip_account_link(ctx: Context<UpdateIPAccountLink>, ipid: Pubkey, value: String) -> Result<()> {
        general::update_ip_account_link(ctx, ipid, value)
    }

    pub fn update_ip_account_intro(ctx: Context<UpdateIPAccountIntro>, ipid: Pubkey, value: String) -> Result<()> {
        general::update_ip_account_intro(ctx, ipid, value)
    }

    pub  fn publish(ctx: Context<Publish>, ipid: Pubkey, price: u64, goalcount: u64, maxcount: u64) -> Result<()> {
        goalmax_buyout::publish(ctx, ipid, price, goalcount, maxcount)
    }

    pub fn pay(ctx: Context<Pay>, ipid: Pubkey) -> Result<()> {
        goalmax_buyout::pay(ctx, ipid)
    }

    pub fn withraw(ctx: Context<Withdraw>, ipid: Pubkey) -> Result<()> {
        goalmax_buyout::withdraw(ctx, ipid)
    }

    pub fn bonus(ctx: Context<Bonus>, ipid: Pubkey) -> Result<()> {
        goalmax_buyout::bonus(ctx, ipid)
    }

}