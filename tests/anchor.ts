
import * as anchor from "@coral-xyz/anchor";
import type { Poip } from "../target/types/poip";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram } from "@solana/web3.js";
import { readFileSync } from "fs";
import { BN } from "bn.js";
import assert from "assert";
import chai from "chai"
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised)

const IP_OWNERSHIP_PRIVATE = 1
const IP_OWNERSHIP_PUBLISHED = 2
const IP_OWNERSHIP_PUBLIC = 3

const CONTRACT_TYPE_FINITE_BUYOUT = 1
const CONTRACT_TYPE_COMPENSATIVE_BUYOUT = 2
const CONTRACT_TYPE_GOALMAX_BUYOUT = 3

describe("Test", async () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Poip as anchor.Program<Poip>;

  const connection = anchor.getProvider().connection
  
  const wallet_sk = Uint8Array.from(JSON.parse(readFileSync("/root/.config/solana/id.json", "utf-8")))
  const wallet = anchor.web3.Keypair.fromSecretKey(wallet_sk)

  const INIT_LAMPORT = 5 * LAMPORTS_PER_SOL

  const USER_COUNT = 20
  const USERS: {
    username: string, 
    keypair: Keypair,
    user_account: PublicKey
  }[] = []

  interface IP {
    link: string
    ipid: string
    contract_type: number
    ip_account: PublicKey
    contract_account: PublicKey
    contract_data: {
      price: number
      goalcount: number
      maxcount: number
    }
  }[] = []

  const IP_1: IP = {
    link: "test-book",
    ipid: "123456",
    contract_type: CONTRACT_TYPE_FINITE_BUYOUT,
    ip_account: PublicKey.findProgramAddressSync([Buffer.from("ip"),   Buffer.from("123456")], program.programId)[0],
    contract_account: PublicKey.findProgramAddressSync([Buffer.from("ci"), Buffer.from("123456")], program.programId)[0],
    contract_data: {
      price: 1 * LAMPORTS_PER_SOL,
      goalcount: 5,
      maxcount: USER_COUNT // 无效
    }
  }
  const IP_2: IP = {
    link: "test-movie",
    ipid: "114514",
    contract_type: CONTRACT_TYPE_COMPENSATIVE_BUYOUT,
    ip_account: PublicKey.findProgramAddressSync([Buffer.from("ip"),   Buffer.from("114514")], program.programId)[0],
    contract_account: PublicKey.findProgramAddressSync([Buffer.from("ci"), Buffer.from("114514")], program.programId)[0],
    contract_data: {
      price: 1 * LAMPORTS_PER_SOL,
      goalcount: 5,
      maxcount: USER_COUNT // 无效
    }
  }
  const IP_3: IP = {
    link: "test-anime",
    ipid: "987654321",
    contract_type: CONTRACT_TYPE_GOALMAX_BUYOUT,
    ip_account: PublicKey.findProgramAddressSync([Buffer.from("ip"),   Buffer.from("987654321")], program.programId)[0],
    contract_account: PublicKey.findProgramAddressSync([Buffer.from("ci"), Buffer.from("987654321")], program.programId)[0],
    contract_data: {
      price: 1 * LAMPORTS_PER_SOL,
      goalcount: 5,
      maxcount: 10
    }
  }

  const IPS = [IP_1, IP_2, IP_3]

  it("create accounts", async ()=>{
    // 创建钱包 + 转账
    for (let i = 0; i < USER_COUNT; i ++) {
      let tx = new anchor.web3.Transaction()
      let keypair = anchor.web3.Keypair.generate()
      let [user_account] = PublicKey.findProgramAddressSync([Buffer.from("user"), keypair.publicKey.toBuffer()], program.programId)
      tx.add(SystemProgram.transfer({fromPubkey: wallet.publicKey, toPubkey: keypair.publicKey, lamports: INIT_LAMPORT}))
      USERS.push({username: `user-${i}`, keypair: keypair, user_account: user_account})
      await anchor.web3.sendAndConfirmTransaction(connection, tx, [wallet])
    }

    // 创建 ip：对于user-0
    for(let IP of [IP_1, IP_2, IP_3]) {
      let tx = new anchor.web3.Transaction()
      const inst_create_ip = await program.methods
        .createIpAccount(IP.ipid, IP.link)
        .signers([USERS[0].keypair])
        .accounts({
          ipAccount: IP.ip_account,
          signer: USERS[0].keypair.publicKey,
          systemProgram: SystemProgram.programId,
        }).instruction()
      tx.add(inst_create_ip)
      await anchor.web3.sendAndConfirmTransaction(connection, tx, [USERS[0].keypair])
    }

    let ip_account_data = await program.account.ipAccount.fetch(IP_1.ip_account)
    assert(ip_account_data.link == IP_1.link)
    assert(ip_account_data.ipid  == IP_1.ipid)
    assert(ip_account_data.owner.equals(USERS[0].keypair.publicKey))
    assert(ip_account_data.ownership.eq(new BN(IP_OWNERSHIP_PRIVATE)))
  })

  it("publish", async ()=>{
    for(let ip of IPS) {
      const inst_publish = await program.methods
        .publish(
          ip.ipid, 
          new BN(ip.contract_data.price), 
          new BN(ip.contract_data.goalcount), 
          new BN(ip.contract_data.maxcount), 
          new BN(ip.contract_type))
        .signers([USERS[0].keypair])
        .accounts({
          ciAccount: ip.contract_account,
          ipAccount: ip.ip_account,
          signer: USERS[0].keypair.publicKey
        }).instruction()
      await sendAndConfirmTransaction(connection, new anchor.web3.Transaction().add(inst_publish), [USERS[0].keypair])
    }

    // 验证同一个IP不能建立两次合约
    const except_publish = await program.methods
      .publish(
        IP_1.ipid,
        new BN(10),
        new BN(10),
        new BN(12),
        new BN(CONTRACT_TYPE_COMPENSATIVE_BUYOUT))
      .signers([USERS[0].keypair])
      .accounts({
        ciAccount: IP_1.contract_account,
        ipAccount: IP_1.ip_account,
        signer: USERS[0].keypair.publicKey
      }).instruction()
    await chai.expect(sendAndConfirmTransaction(connection, new anchor.web3.Transaction().add(except_publish), [USERS[0].keypair])).to.be.rejected
  })

  it("pay", async ()=>{
    for(let IP of IPS) {
      for(let user of USERS.slice(0,IP.contract_data.goalcount)) {
        const cp_account = PublicKey.findProgramAddressSync([Buffer.from("cp"), user.keypair.publicKey.toBuffer(), IP.contract_account.toBuffer()], program.programId)[0]
        const inst_pay = await program.methods
          .pay(IP.ipid)
          .signers([user.keypair])
          .accounts({
            cpAccount: cp_account,
            ciAccount: IP.contract_account,
            ipAccount: IP.ip_account,
            signer: user.keypair.publicKey
          }).instruction()
        await sendAndConfirmTransaction(connection, new anchor.web3.Transaction().add(inst_pay), [user.keypair])
      }
    }

    const ip1_account_data = await program.account.ipAccount.fetch(IP_1.ip_account)
    const ip2_account_data = await program.account.ipAccount.fetch(IP_2.ip_account)
    const ip3_account_data = await program.account.ipAccount.fetch(IP_3.ip_account)
    assert(ip1_account_data.ownership.eq(new BN(IP_OWNERSHIP_PUBLIC)))
    assert(ip2_account_data.ownership.eq(new BN(IP_OWNERSHIP_PUBLISHED)))
    assert(ip3_account_data.ownership.eq(new BN(IP_OWNERSHIP_PUBLISHED)))

    // FINITE BUYOUT 在达到goalcount后就无需付费了,IPOwnership已经为Public
    const except_user_ip1 = USERS[IP_1.contract_data.goalcount]
    const except_cp_account_ip1 = PublicKey.findProgramAddressSync([Buffer.from("cp"), except_user_ip1.keypair.publicKey.toBuffer(), IP_1.contract_account.toBuffer()], program.programId)[0]
    const except_pay_ip1 = await program.methods
      .pay(IP_1.ipid)
      .signers([except_user_ip1.keypair])
      .accounts({
        cpAccount: except_cp_account_ip1,
        ciAccount: IP_1.contract_account,
        ipAccount: IP_1.ip_account,
        signer: except_user_ip1.keypair.publicKey
      }).instruction()
    await chai.expect(sendAndConfirmTransaction(connection, new anchor.web3.Transaction().add(except_pay_ip1), [except_user_ip1.keypair])).to.be.rejected
  
    // COMPENSATIVE_BUYOUT 在达到goalcount后可以继续付费，价格逐渐降低并对之前的付费者产生返利
    let ci_account_lamports_ip2 = (await program.account.ciAccount.getAccountInfo(IP_2.contract_account)).lamports
    let price_ip2 = IP_2.contract_data.price
    for (let user of USERS.slice(IP_2.contract_data.goalcount, USER_COUNT)) {
      const cp_account = PublicKey.findProgramAddressSync([Buffer.from("cp"), user.keypair.publicKey.toBuffer(), IP_2.contract_account.toBuffer()], program.programId)[0]
      const inst_pay = await program.methods
        .pay(IP_2.ipid)
        .signers([user.keypair])
        .accounts({
          cpAccount: cp_account,
          ciAccount: IP_2.contract_account,
          ipAccount: IP_2.ip_account,
          signer: user.keypair.publicKey
        }).instruction()
      await sendAndConfirmTransaction(connection, new anchor.web3.Transaction().add(inst_pay), [user.keypair])

      let curr_ci_account_lamports = (await program.account.ciAccount.getAccountInfo(IP_2.contract_account)).lamports
      let curr_price = curr_ci_account_lamports - ci_account_lamports_ip2
      assert(curr_price < price_ip2)
      ci_account_lamports_ip2 = curr_ci_account_lamports
      price_ip2 = curr_price
    }

    // GOALMAX_BUYOUT 在goalcount与maxcount之间可以继续付费，价格逐渐降低；在超过maxcount后不能继续付费，IPOwnership变为Public
    let ci_account_lamports_ip3 = (await program.account.ciAccount.getAccountInfo(IP_3.contract_account)).lamports
    let price_ip3 = IP_3.contract_data.price
    for (let user of USERS.slice(IP_3.contract_data.goalcount, IP_3.contract_data.maxcount)) {
      const cp_account = PublicKey.findProgramAddressSync([Buffer.from("cp"), user.keypair.publicKey.toBuffer(), IP_3.contract_account.toBuffer()], program.programId)[0]
      const inst_pay = await program.methods
        .pay(IP_3.ipid)
        .signers([user.keypair])
        .accounts({
          cpAccount: cp_account,
          ciAccount: IP_3.contract_account,
          ipAccount: IP_3.ip_account,
          signer: user.keypair.publicKey
        }).instruction()
      await sendAndConfirmTransaction(connection, new anchor.web3.Transaction().add(inst_pay), [user.keypair])

      let curr_ci_account_lamports = (await program.account.ciAccount.getAccountInfo(IP_3.contract_account)).lamports
      let curr_price = curr_ci_account_lamports - ci_account_lamports_ip3
      assert(curr_price < price_ip3)
      ci_account_lamports_ip3 = curr_ci_account_lamports
      price_ip3 = curr_price
    }

    const ip3_account_data_curr = await program.account.ipAccount.fetch(IP_3.ip_account)
    assert(ip3_account_data_curr.ownership.eq(new BN(IP_OWNERSHIP_PUBLIC)))

    const except_user_ip3 = USERS[IP_3.contract_data.maxcount]
    const except_cp_account = PublicKey.findProgramAddressSync([Buffer.from("cp"), except_user_ip3.keypair.publicKey.toBuffer(), IP_3.contract_account.toBuffer()], program.programId)[0]
    const except_pay_ip3 = await program.methods
      .pay(IP_3.ipid)
      .signers([except_user_ip3.keypair])
      .accounts({
        cpAccount: except_cp_account,
        ciAccount: IP_3.contract_account,
        ipAccount: IP_3.ip_account,
        signer: except_user_ip3.keypair.publicKey
      }).instruction()
    await chai.expect(sendAndConfirmTransaction(connection, new anchor.web3.Transaction().add(except_pay_ip3), [except_user_ip3.keypair])).to.be.rejected
    

  })

  it("withdraw", async ()=>{
    for(let IP of IPS) {
      const inst_withdraw = await program.methods
        .withraw(IP.ipid)
        .signers([USERS[0].keypair])
        .accounts({
          ciAccount: IP.contract_account,
          ipAccount: IP.ip_account,
          ownerAccount: USERS[0].user_account,
          signer: USERS[0].keypair.publicKey
        }).instruction()
      await sendAndConfirmTransaction(connection, new anchor.web3.Transaction().add(inst_withdraw), [USERS[0].keypair])
    }
    const user_account_rent = await connection.getMinimumBalanceForRentExemption(program.account.userAccount.size)
    const user_account_lamports = (await program.account.userAccount.getAccountInfo(USERS[0].user_account)).lamports
    const user_profit = user_account_lamports - user_account_rent
    assert(
      user_profit === 
      IP_1.contract_data.goalcount * IP_1.contract_data.price + 
      IP_2.contract_data.goalcount * IP_2.contract_data.price + 
      IP_3.contract_data.goalcount * IP_3.contract_data.price)
  })

  it("bonus", async ()=>{

    // COMPENSATIVE BUYOUT 所有用户都购买了，所有用户都有返利（最后一个用户的返利账面为0，体现在了他购买时是最低价格）
    for(let user of USERS.slice(0, USERS.length-1)) {
      const cp_account = PublicKey.findProgramAddressSync([Buffer.from("cp"), user.keypair.publicKey.toBuffer(), IP_2.contract_account.toBuffer()], program.programId)[0]
      const inst_bonus = await program.methods
        .bonus(IP_2.ipid)
        .signers([user.keypair])
        .accounts({
          ciAccount: IP_2.contract_account,
          cpAccount: cp_account,
          userAccount: user.user_account,
          signer: user.keypair.publicKey
        }).instruction()
      await sendAndConfirmTransaction(connection, new anchor.web3.Transaction().add(inst_bonus), [user.keypair])
    }

    // 最后一个用户提取返利会失败
    const except_user_ip2 = USERS[USERS.length - 1]
    const except_cp_account_ip2 = PublicKey.findProgramAddressSync([Buffer.from("cp"), except_user_ip2.keypair.publicKey.toBuffer(), IP_2.contract_account.toBuffer()], program.programId)[0]
    const except_bonus_ip2 = await program.methods
      .bonus(IP_2.ipid)
      .signers([except_user_ip2.keypair])
      .accounts({
        ciAccount: IP_2.contract_account,
        cpAccount: except_cp_account_ip2,
        userAccount: except_user_ip2.user_account,
        signer: except_user_ip2.keypair.publicKey
      }).instruction()
    await chai.expect(sendAndConfirmTransaction(connection, new anchor.web3.Transaction().add(except_bonus_ip2), [except_user_ip2.keypair])).to.be.rejected
    
    // cp_account 中的withdrawal应当都为最大值且相等
    const expected_bonus_ip2 = new BN((USER_COUNT - IP_2.contract_data.goalcount)).mul(new BN(IP_2.contract_data.price)).div(new BN(USER_COUNT))
    for(let user of USERS) {
      const cp_account = PublicKey.findProgramAddressSync([Buffer.from("cp"), user.keypair.publicKey.toBuffer(), IP_2.contract_account.toBuffer()], program.programId)[0]
      const cp_account_data = await program.account.cpAccount.fetch(cp_account)
      assert(cp_account_data.withdrawal.eq(expected_bonus_ip2))
    }

    // GOALMAX BUYOUT maxcount的用户购买了，他们都能获得返利（最后一个用户的返利账面为0，体现在了他购买时是最低价格）
    for(let user of USERS.slice(0, IP_3.contract_data.maxcount - 1)) {
      const cp_account = PublicKey.findProgramAddressSync([Buffer.from("cp"), user.keypair.publicKey.toBuffer(), IP_3.contract_account.toBuffer()], program.programId)[0]
      const inst_bonus = await program.methods
        .bonus(IP_3.ipid)
        .signers([user.keypair])
        .accounts({
          ciAccount: IP_3.contract_account,
          cpAccount: cp_account,
          userAccount: user.user_account,
          signer: user.keypair.publicKey
        }).instruction()
      await sendAndConfirmTransaction(connection, new anchor.web3.Transaction().add(inst_bonus), [user.keypair])
    }

    // 最后一个用户提取返利会失败
    const except_user_ip3 = USERS[IP_3.contract_data.maxcount - 1]
    const except_cp_account_ip3 = PublicKey.findProgramAddressSync([Buffer.from("cp"), except_user_ip3.keypair.publicKey.toBuffer(), IP_3.contract_account.toBuffer()], program.programId)[0]
    const except_bonus_ip3 = await program.methods
      .bonus(IP_3.ipid)
      .signers([except_user_ip3.keypair])
      .accounts({
        ciAccount: IP_3.contract_account,
        cpAccount: except_cp_account_ip3,
        userAccount: except_user_ip3.user_account,
        signer: except_user_ip3.keypair.publicKey
      }).instruction()
    await chai.expect(sendAndConfirmTransaction(connection, new anchor.web3.Transaction().add(except_bonus_ip3), [except_user_ip3.keypair])).to.be.rejected

    // cp_account 中的withdrawal应当都为最大值且相等
    const expected_bonus_ip3 = new BN((IP_3.contract_data.maxcount - IP_3.contract_data.goalcount)).mul(new BN(IP_3.contract_data.price)).div(new BN(IP_3.contract_data.maxcount))
    for(let user of USERS.slice(0, IP_3.contract_data.maxcount)) {
      const cp_account = PublicKey.findProgramAddressSync([Buffer.from("cp"), user.keypair.publicKey.toBuffer(), IP_3.contract_account.toBuffer()], program.programId)[0]
      const cp_account_data = await program.account.cpAccount.fetch(cp_account)
      assert(cp_account_data.withdrawal.eq(expected_bonus_ip3))
    }

  })

  it("delete-account", async ()=>{
    // 最后一个用户由于没有进行withdraw或bonus操作，所以user_account并没有创建
    for(let i = 0; i < USER_COUNT - 1; i ++) {
      let user = USERS[i]
      const inst_delete = await program.methods
        .deleteUserAccount()
        .signers([user.keypair])
        .accounts({
          userAccount: user.user_account,
          signer: user.keypair.publicKey,
        }).instruction()
      await sendAndConfirmTransaction(connection, new anchor.web3.Transaction().add(inst_delete), [user.keypair])
      const lamports = await connection.getBalance(user.keypair.publicKey)
      const ip_rent  = await connection.getMinimumBalanceForRentExemption(program.account.ipAccount.size)
      const ci_rent  = await connection.getMinimumBalanceForRentExemption(program.account.ciAccount.size)
      const cp_rent  = await connection.getMinimumBalanceForRentExemption(program.account.cpAccount.size)
      const cp_rent_count = 
        (i < IP_1.contract_data.goalcount ? 1 : 0) +
        (i < USER_COUNT ? 1 : 0) +
        (i < IP_3.contract_data.maxcount ? 1 : 0)
      const lamports_plus_rent = lamports + cp_rent * cp_rent_count + (i === 0 ? IPS.length * (ip_rent + ci_rent) : 0)
      const sol_delta = ((lamports_plus_rent - INIT_LAMPORT) / LAMPORTS_PER_SOL).toFixed(2)
      console.log(`${user.username} sol delta: ${sol_delta}`)
    }

  })

}); 