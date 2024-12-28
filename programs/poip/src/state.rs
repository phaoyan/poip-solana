use anchor_lang::prelude::*;

pub const IP_OWNERSHIP_PRIVATE: u64 = 1;
pub const IP_OWNERSHIP_PUBLISHED: u64 = 2;
pub const IP_OWNERSHIP_PUBLIC: u64 = 3;

#[account]
pub struct IPAccount {
    pub ownership: u64, // 见 IP_OWNERSHIP
    pub ipid: Pubkey,  //32字节随机ID
    pub link: String,  //IPFS Link, 包括了对称加密的IP内容文件
    pub intro: String, //IPFS Link, 用于存放介绍信息，为JSON
    pub owner: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct CIAccount { // Contract Issue Account
    pub ipid: Pubkey,
    pub token_mint: Pubkey,
    pub price: u64, // Price per contribution, in terms of the SPL token
    pub goalcount: u64,
    pub currcount: u64,
    pub maxcount:  u64,
    pub withdrawal_count: u64, // Tracks the number of contributions withdrawn
}

#[account]
#[derive(InitSpace)]
pub struct CPAccount { // Contract Payment Account
    pub ipid: Pubkey,
    pub owner: Pubkey,
    pub withdrawal: u64, // Tracks the bonus amount withdrawn by the contributor
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