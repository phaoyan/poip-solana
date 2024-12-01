use anchor_lang::prelude::*;






pub const IP_OWNERSHIP_PRIVATE: u64 = 1;
pub const IP_OWNERSHIP_PUBLISHED: u64 = 2;
pub const IP_OWNERSHIP_PUBLIC: u64 = 3;

#[account]
pub struct IPAccount {
    pub ipid: String,
    pub title: String,
    pub owner: Pubkey,
    pub ownership: u64, // 见 IP_OWNERSHIP
}


#[account]
pub struct UserAccount {
    pub username: String,
    pub useraddr: Pubkey,
}

pub const CONTRACT_TYPE_FINITE_BUYOUT: u64 = 1;
pub const CONTRACT_TYPE_COMPENSATIVE_BUYOUT: u64 = 2;
pub const CONTRACT_TYPE_GOALMAX_BUYOUT: u64 = 3;

#[account]
#[derive(InitSpace)]
pub struct CIAccount { // Contract Issue Account
    // ip_account: 由于ipid已知故不需要存
    pub price: u64,
    pub contract_type: u64, // 见 CONTRACT_TYPE
    pub goalcount: u64,
    pub currcount: u64,
    pub maxcount:  u64,
    pub withdrawal_count: u64,
}

#[account]
#[derive(InitSpace)]
pub struct CPAccount { // Contract Payment Account
    pub withdrawal: u64,
}

#[account]
#[derive(InitSpace)]
pub struct CCAccount { // Contract Credit Account : 证明买过这个IP
    // ip_account: 在seed中
    // user: 在seed中
}

#[derive(Accounts)]
#[instruction(username: String)]
pub struct CreateUserAccount<'info> {
    #[account(
        init, payer = signer, space = 8 + 4 + username.len() + 32,
        seeds = [b"user", signer.key().as_ref()], bump
    )]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct  DeleteUserAccount<'info> {
    #[account(
        mut, close = signer,
        seeds = [b"user", signer.key().as_ref()], bump
    )]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: String, title: String)]
pub struct CreateIPAccount<'info> {
    #[account(
        init, payer = signer, space = 8 + 4 + ipid.len() + 4 + title.len() + 32 + 8,
        seeds = [b"ip", ipid.as_bytes().as_ref()], bump
    )]
    pub ip_account: Account<'info, IPAccount>,
    #[account(seeds=[b"user", signer.key().as_ref()], bump)]
    pub owner_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: String)]
pub struct DeleteIPAccount<'info> {
    #[account(
        mut, close = signer,
        seeds = [b"ip", ipid.as_bytes().as_ref()], bump
    )]
    pub ip_account: Account<'info, IPAccount>,
    #[account(
        seeds = [b"user", signer.key().as_ref()], bump
    )]
    pub owner_account: Account<'info, UserAccount>,
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(price: u64, goalcount: u64, maxcount: u64, ipid: String)]
pub struct Publish<'info> {
    #[account(
        init, payer = signer, space = 8 + CIAccount::INIT_SPACE,
        seeds = [b"ci", ipid.as_bytes().as_ref()], bump
    )]
    pub ci_account: Account<'info, CIAccount>,
    
    #[account(mut, seeds = [b"ip", ipid.as_bytes().as_ref()], bump)]
    pub ip_account: Account<'info, IPAccount>,
    
    #[account(mut, constraint = ip_account.owner.eq(&owner_account.key()))]
    pub owner_account: Account<'info, UserAccount>,

    #[account(mut, constraint = signer.key().eq(&owner_account.useraddr))]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>
}


#[derive(Accounts)]
#[instruction(ipid: String)]
pub struct  Pay<'info> {
    #[account(
        init, payer = signer, space = 8 + CCAccount::INIT_SPACE,
        seeds = [b"cc", user_account.key().as_ref(), ci_account.key().as_ref()], bump
    )]
    pub cc_account: Account<'info, CCAccount>,
    
    #[account(
        init, payer = signer, space = 8 + CPAccount::INIT_SPACE,
        seeds = [b"cp", user_account.key().as_ref(), ci_account.key().as_ref()], bump
    )]
    pub cp_account: Account<'info, CPAccount>,

    #[account(mut, seeds = [b"ci", ipid.as_bytes().as_ref()], bump)]
    pub ci_account: Account<'info, CIAccount>,

    #[account(mut, seeds = [b"ip", ipid.as_bytes().as_ref()], bump)]
    pub ip_account: Account<'info, IPAccount>,

    #[account(seeds = [b"user", signer.key().as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>
}


#[derive(Accounts)]
#[instruction(ipid: String)]
pub struct Withdraw<'info> {
    #[account(mut, seeds = [b"ci", ipid.as_bytes().as_ref()], bump)]
    pub ci_account: Account<'info, CIAccount>,

    #[account(mut, seeds = [b"ip", ipid.as_bytes().as_ref()], bump)]
    pub ip_account: Account<'info, IPAccount>,

    #[account(mut, constraint = ip_account.owner.eq(&owner_account.key()))]
    pub owner_account: Account<'info, UserAccount>,

    #[account(mut, constraint = signer.key().eq(&owner_account.useraddr))]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: String)]
pub struct  Bonus<'info> {
    #[account(mut, seeds = [b"ci", ipid.as_bytes().as_ref()], bump)]
    pub ci_account: Account<'info, CIAccount>,

    #[account(mut, seeds = [b"cp", user_account.key().as_ref(), ci_account.key().as_ref()], bump)]
    pub cp_account: Account<'info, CPAccount>,

    #[account(mut, seeds = [b"user", signer.key().as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>
}


#[error_code]
pub enum ErrorCode {
    InvalidPrice,
    LamportsNotEnough,
    GoalAlreadyAchieved,
    ContractHasNoLamports,
    WrongIPOwnership,
    WrongContractType,
}