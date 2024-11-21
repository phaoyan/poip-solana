use anchor_lang::prelude::*;

pub fn issue(ctx: Context<LCBIssue>, price: u64, goalcount: u64, maxcount: u64) -> Result<()> {
    Ok(())
}

pub fn buy(ctx: Context<LCBBuy>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct LCBIssue {
}

#[derive(Accounts)]
pub struct LCBBuy {
}