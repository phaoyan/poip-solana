use anchor_lang::prelude::*;

pub fn issue(ctx: Context<CBIssue>, price: u64, goalcount: u64) -> Result<()> {
    Ok(())
}

pub fn buy(ctx: Context<CBBuy>) -> Result<()> {
    Ok(())
}


#[derive(Accounts)]
pub struct CBIssue {
}

#[derive(Accounts)]
pub struct CBBuy {
}