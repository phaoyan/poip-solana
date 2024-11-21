use super::*;

pub fn fb_issue(ctx: Context<contracts::finite_buyout::FBIssue>, price: u64, headcount: u64) -> Result<()> {
    finite_buyout::issue(ctx, price, headcount)
}

pub fn fb_buy(ctx: Context<FBBuy>) -> Result<()> {
    finite_buyout::buy(ctx)
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
