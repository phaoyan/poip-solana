mod contracts;

use anchor_lang::prelude::*;
use contracts::*;
use finite_buyout::*;
use compensative_buyout::*;
use limited_compensative_buyout::*;



// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("11111111111111111111111111111111");

#[program]
mod poip {
    use super::*;
    
    
    pub fn fb_issue(ctx: Context<FBIssue>, price: u64, goalcount: u64, ipid: u64) -> Result<()> {
        finite_buyout::issue(ctx, price, goalcount, ipid)
    }

    pub fn fb_buy(ctx: Context<FBBuy>, author: Pubkey, ipid: u64) -> Result<()> {
        finite_buyout::buy(ctx, author, ipid)
    }

    pub fn cb_issue(ctx: Context<CBIssue>, price: u64, goalcount: u64) -> Result<()>{
        compensative_buyout::issue(ctx, price, goalcount)
    }

    pub fn cb_buy(ctx: Context<CBBuy>) -> Result<()> {
        compensative_buyout::buy(ctx)
    }

    pub fn lcb_issue(ctx: Context<LCBIssue>, price: u64, goalcount: u64, maxcount: u64) -> Result<()> {
        limited_compensative_buyout::issue(ctx, price, goalcount, maxcount)
    }

    pub fn lcb_buy(ctx: Context<LCBBuy>) -> Result<()> {
        limited_compensative_buyout::buy(ctx)
    }
}



