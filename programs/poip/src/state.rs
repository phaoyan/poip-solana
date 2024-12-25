use anchor_lang::prelude::*;

pub const IP_OWNERSHIP_PRIVATE: u64 = 1;
pub const IP_OWNERSHIP_PUBLISHED: u64 = 2;
pub const IP_OWNERSHIP_PUBLIC: u64 = 3;

#[account]
pub struct IPAccount {
    pub ipid: Pubkey,  //32字节随机ID
    pub link: String,  //IPFS Link, 包括了对称加密的IP内容文件
    pub intro: String, //IPFS Link, 用于存放介绍信息，为JSON
    pub owner: Pubkey,
    pub ownership: u64, // 见 IP_OWNERSHIP
}


#[account]
#[derive(InitSpace)]
pub struct UserAccount { // 用于存储临时的Lamports，通过 close 这个账户提现
    pub user_addr: Pubkey
}

#[account]
#[derive(InitSpace)]
pub struct CIAccount { // Contract Issue Account
    pub ipid: Pubkey,
    pub price: u64,
    pub goalcount: u64,
    pub currcount: u64,
    pub maxcount:  u64,
    pub withdrawal_count: u64,
}

#[account]
#[derive(InitSpace)]
pub struct CPAccount { // Contract Payment Account
    pub ipid: Pubkey,
    pub owner: Pubkey,
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
#[instruction(ipid: Pubkey, link: String, intro: String)]
pub struct CreateIPAccount<'info> {
    #[account(
        init, payer = signer, space = 8 + 32 + 4 + link.len() + 4 + intro.len() + 32 + 8,
        seeds = [b"ip", ipid.key().as_ref()], bump
    )]
    pub ip_account: Account<'info, IPAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: Pubkey)]
pub struct DeleteIPAccount<'info> {
    #[account(
        mut, close = signer,
        seeds = [b"ip", ipid.key().as_ref()], bump
    )]
    pub ip_account: Account<'info, IPAccount>,
    
    #[account(mut)]
    pub signer: Signer<'info>,
    
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: Pubkey, value: String)]
pub struct UpdateIPAccountLink<'info> {
    #[account(
        mut,
        seeds = [b"ip", ipid.key().as_ref()],
        bump,
        realloc = 8 + 32 + 4 + value.len() + 4 + ip_account.intro.len() + 32 + 8,
        realloc::zero = false,
        realloc::payer = signer,
    )]
    pub ip_account: Account<'info, IPAccount>,
    
    #[account(mut)]
    pub signer: Signer<'info>,
    
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: Pubkey, value: String)]
pub struct UpdateIPAccountIntro<'info> {
    #[account(
        mut,
        seeds = [b"ip", ipid.key().as_ref()],
        bump,
        realloc = 8 + 32 + 4 + value.len() + 4 + ip_account.intro.len() + 32 + 8,
        realloc::zero = false,
        realloc::payer = signer,
    )]
    pub ip_account: Account<'info, IPAccount>,
    
    #[account(mut)]
    pub signer: Signer<'info>,
    
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(ipid: Pubkey)]
pub struct Publish<'info> {
    #[account(
        init, payer = signer, space = 8 + CIAccount::INIT_SPACE,
        seeds = [b"ci", ipid.key().as_ref()], bump
    )]
    pub ci_account: Account<'info, CIAccount>,
    
    #[account(mut, seeds = [b"ip", ipid.key().as_ref()], bump)]
    pub ip_account: Account<'info, IPAccount>,

    #[account(mut, constraint = signer.key().eq(&ip_account.owner))]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>
}


#[derive(Accounts)]
#[instruction(ipid: Pubkey)]
pub struct  Pay<'info> {
    #[account(
        init, payer = signer, space = 8 + CPAccount::INIT_SPACE,
        seeds = [b"cp", signer.key().as_ref(), ci_account.key().as_ref()], bump
    )]
    pub cp_account: Account<'info, CPAccount>,

    #[account(mut, seeds = [b"ci", ipid.key().as_ref()], bump)]
    pub ci_account: Account<'info, CIAccount>,

    #[account(mut, seeds = [b"ip", ipid.key().as_ref()], bump)]
    pub ip_account: Account<'info, IPAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>
}


#[derive(Accounts)]
#[instruction(ipid: Pubkey)]
pub struct Withdraw<'info> {
    #[account(mut, seeds = [b"ci", ipid.key().as_ref()], bump)]
    pub ci_account: Account<'info, CIAccount>,

    #[account(mut, seeds = [b"ip", ipid.key().as_ref()], bump)]
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
#[instruction(ipid: Pubkey)]
pub struct  Bonus<'info> {
    #[account(mut, seeds = [b"ci", ipid.key().as_ref()], bump)]
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