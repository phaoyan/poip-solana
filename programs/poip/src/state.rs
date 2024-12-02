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
#[derive(InitSpace)]
pub struct UserAccount { // 用于存储临时的Lamports，通过 close 这个账户提现
    // user_addr: 在seed中
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

#[derive(Accounts)]
pub struct CreateUserAccount<'info> {
    #[account(
        init, payer = signer, space = 8 + UserAccount::INIT_SPACE,
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
    
    #[account(mut)]
    pub signer: Signer<'info>,
    
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: String)]
pub struct Publish<'info> {
    #[account(
        init, payer = signer, space = 8 + CIAccount::INIT_SPACE,
        seeds = [b"ci", ipid.as_bytes().as_ref()], bump
    )]
    pub ci_account: Account<'info, CIAccount>,
    
    #[account(mut, seeds = [b"ip", ipid.as_bytes().as_ref()], bump)]
    pub ip_account: Account<'info, IPAccount>,

    #[account(mut, constraint = signer.key().eq(&ip_account.owner))]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>
}


#[derive(Accounts)]
#[instruction(ipid: String)]
pub struct  Pay<'info> {
    #[account(
        init, payer = signer, space = 8 + CPAccount::INIT_SPACE,
        seeds = [b"cp", signer.key().as_ref(), ci_account.key().as_ref()], bump
    )]
    pub cp_account: Account<'info, CPAccount>,

    #[account(mut, seeds = [b"ci", ipid.as_bytes().as_ref()], bump)]
    pub ci_account: Account<'info, CIAccount>,

    #[account(mut, seeds = [b"ip", ipid.as_bytes().as_ref()], bump)]
    pub ip_account: Account<'info, IPAccount>,

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

    #[account(
        init_if_needed, payer = signer, space = 8 + UserAccount::INIT_SPACE, 
        seeds = [b"user", signer.key().as_ref()], bump
    )]
    pub owner_account: Account<'info, UserAccount>,

    #[account(mut, constraint = signer.key().eq(&ip_account.owner))]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: String)]
pub struct  Bonus<'info> {
    #[account(mut, seeds = [b"ci", ipid.as_bytes().as_ref()], bump)]
    pub ci_account: Account<'info, CIAccount>,

    #[account(mut, seeds = [b"cp", signer.key().as_ref(), ci_account.key().as_ref()], bump)]
    pub cp_account: Account<'info, CPAccount>,

    #[account(
        init_if_needed, payer = signer, space = 8 + UserAccount::INIT_SPACE, 
        seeds = [b"user", signer.key().as_ref()], bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>
}


#[error_code]
pub enum ErrorCode {
    LamportsNotEnough,
    GoalAlreadyAchieved,
    ContractHasNoLamports,
    WrongIPOwnership,
    WrongContractType,
    MathFailure,
    InvalidPrice,
    InvalidGoalcount,
    InvalidMaxcount,
}