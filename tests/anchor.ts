
import * as anchor from "@coral-xyz/anchor";
import type { Poip } from "../target/types/poip";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { readFileSync } from "fs";
import { BN } from "bn.js";
import assert from "assert";
import chai from "chai"
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised)

describe("Test", async () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Poip as anchor.Program<Poip>;

  const connection = anchor.getProvider().connection
  
  const wallet_sk = Uint8Array.from(JSON.parse(readFileSync("/home/solana/poip-solana/tests/wallets/id.json", "utf-8")))
  const wallet = anchor.web3.Keypair.fromSecretKey(wallet_sk)

  const IP_OWNERSHIP_PRIVATE = 1
  const IP_OWNERSHIP_PUBLISHED = 2
  const IP_OWNERSHIP_PUBLIC = 3

  const USER_COUNT = 21
  const USERS: {
    username: string, 
    keypair: Keypair,
    user_account: PublicKey
  }[] = []

  interface IP {
    title: string,
    ipid: string,
    ip_account: PublicKey
    contract_account: PublicKey
    contract_data: any
  }[] = []
  const IP_1: IP = {
    title: "test-book",
    ipid: "123456",
    ip_account: PublicKey.findProgramAddressSync([Buffer.from("ip"),   Buffer.from("123456")], program.programId)[0],
    contract_account: PublicKey.findProgramAddressSync([Buffer.from("ci"), Buffer.from("123456")], program.programId)[0],
    contract_data: {
      price: 1 * LAMPORTS_PER_SOL,
      goalcount: 5
    }
  }
  const IP_2: IP = {
    title: "test-movie",
    ipid: "114514",
    ip_account: PublicKey.findProgramAddressSync([Buffer.from("ip"),   Buffer.from("114514")], program.programId)[0],
    contract_account: PublicKey.findProgramAddressSync([Buffer.from("ci"), Buffer.from("114514")], program.programId)[0],
    contract_data: {
      price: 1 * LAMPORTS_PER_SOL,
      goalcount: 5,
    }
  }
  const IP_3: IP = {
    title: "test-anime",
    ipid: "987654321",
    ip_account: PublicKey.findProgramAddressSync([Buffer.from("ip"),   Buffer.from("987654321")], program.programId)[0],
    contract_account: PublicKey.findProgramAddressSync([Buffer.from("ci"), Buffer.from("987654321")], program.programId)[0],
    contract_data: {
      price: 1 * LAMPORTS_PER_SOL,
      goalcount: 5,
      maxcount: 7
    }
  }

  it("create accounts", async ()=>{
    // 创建钱包 + 转账
    for (let i = 0; i < USER_COUNT; i ++) {
      let tx = new anchor.web3.Transaction()
      let keypair = anchor.web3.Keypair.generate()
      let [user_account] = PublicKey.findProgramAddressSync([Buffer.from("user"), keypair.publicKey.toBuffer()], program.programId)
      tx.add(SystemProgram.transfer({fromPubkey: wallet.publicKey, toPubkey: keypair.publicKey, lamports: 5 * LAMPORTS_PER_SOL}))
      USERS.push({username: `user-${i}`, keypair: keypair, user_account: user_account})
      await anchor.web3.sendAndConfirmTransaction(connection, tx, [wallet])
    }


    for (let user of USERS){
      let balance = await connection.getBalance(user.keypair.publicKey)
      assert(balance === 5 * LAMPORTS_PER_SOL)
    }


    // 创建 user_account
    for (let user of USERS) {
      let tx = new anchor.web3.Transaction()
      const inst_create_user = await program.methods
        .createUserAccount(user.username)
        .signers([user.keypair])
        .accounts({
          userAccount: user.user_account,
          signer: user.keypair.publicKey,
          systemProgram: SystemProgram.programId,
        }).instruction()
      tx.add(inst_create_user)
      await anchor.web3.sendAndConfirmTransaction(connection, tx, [user.keypair])
    }

    // 创建 ip：对于user-0
    for(let IP of [IP_1, IP_2, IP_3]) {
      let tx = new anchor.web3.Transaction()
      const inst_create_ip = await program.methods
        .createIpAccount(IP.ipid, IP.title)
        .signers([USERS[0].keypair])
        .accounts({
          ipAccount: IP.ip_account,
          ownerAccount: USERS[0].user_account,
          signer: USERS[0].keypair.publicKey,
          systemProgram: SystemProgram.programId,
        }).instruction()
      tx.add(inst_create_ip)
      await anchor.web3.sendAndConfirmTransaction(connection, tx, [USERS[0].keypair])
    }

    // 检查user_account
    for(let user of USERS) {
      const user_account_data = await program.account.userAccount.fetch(user.user_account)
      assert(user_account_data.username === user.username)
      assert(user_account_data.useraddr.equals(user.keypair.publicKey))
    }

    let ip_account_data = await program.account.ipAccount.fetch(IP_1.ip_account)
    assert(ip_account_data.title == IP_1.title)
    assert(ip_account_data.ipid  == IP_1.ipid)
    assert(ip_account_data.owner.equals(USERS[0].user_account))
    assert(ip_account_data.ownership.eq(new BN(IP_OWNERSHIP_PRIVATE)))

  })

  it("fb-publish", async ()=>{
    const inst_fbci = await program.methods
      .fbPublish(new BN(IP_1.contract_data.price), new BN(IP_1.contract_data.goalcount), new BN(0), IP_1.ipid)
      .signers([USERS[0].keypair])
      .accounts({
        ciAccount: IP_1.contract_account,
        ipAccount: IP_1.ip_account,
        ownerAccount: USERS[0].user_account,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).instruction()

    let tx = new anchor.web3.Transaction()
    tx.add(inst_fbci)
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [USERS[0].keypair])

    let fbci_account_data = await program.account.ciAccount.fetch(IP_1.contract_account)
    let ip_account_data     = await program.account.ipAccount.fetch(IP_1.ip_account)
    assert(fbci_account_data.price.eq(new BN(IP_1.contract_data.price)))
    assert(fbci_account_data.goalcount.eq(new BN(IP_1.contract_data.goalcount)))
    assert(fbci_account_data.currcount.eq(new BN(0)))
    assert(ip_account_data.ownership.eq(new BN(IP_OWNERSHIP_PUBLISHED)))

  })

  it("fb-pay", async ()=>{
    let fbci_lamports_ori = (await program.account.ciAccount.getAccountInfo(IP_1.contract_account)).lamports
    for(let i = 1; i < IP_1.contract_data.goalcount + 1; i ++) {
      let user = USERS[i]
      let tx = new anchor.web3.Transaction()
      const [fbcp_account]   = PublicKey.findProgramAddressSync([Buffer.from("cp"), user.user_account.toBuffer(), IP_1.contract_account.toBuffer()], program.programId)
      const inst_fbcp = await program.methods
        .fbPay(IP_1.ipid)
        .signers([user.keypair])
        .accounts({
          cpAccount: fbcp_account,
          ciAccount: IP_1.contract_account,
          ipAccount:   IP_1.ip_account,
          userAccount: user.user_account,
          signer:      user.keypair.publicKey,
        }).instruction()
      tx.add(inst_fbcp)
      await anchor.web3.sendAndConfirmTransaction(connection, tx, [user.keypair])
      let fbcp_account_data = await program.account.cpAccount.fetch(fbcp_account)
      let fbci_account_info = await program.account.ciAccount.getAccountInfo(IP_1.contract_account)
      assert(fbci_account_info.lamports - fbci_lamports_ori === IP_1.contract_data.price * i)
      assert(!!fbcp_account_data)
    }

    let except_tx = new anchor.web3.Transaction()
    const [fbcp_account]   = PublicKey.findProgramAddressSync([Buffer.from("cp"), USERS[4].user_account.toBuffer(), IP_1.contract_account.toBuffer()], program.programId)
    const inst_fbcp_after_goal_achieved = await program.methods
      .fbPay(IP_1.ipid)
      .signers([USERS[4].keypair])
      .accounts({
        cpAccount: fbcp_account,
        ciAccount: IP_1.contract_account,
        ipAccount:   IP_1.ip_account,
        userAccount: USERS[4].user_account,
        signer:      USERS[4].keypair.publicKey,
      }).instruction()
    except_tx.add(inst_fbcp_after_goal_achieved)
    await chai.expect(anchor.web3.sendAndConfirmTransaction(connection, except_tx, [USERS[4].keypair])).to.be.rejected
  })

  it("fb-withdraw", async ()=>{
    const fbci_account_data_ori = await program.account.ciAccount.fetch(IP_1.contract_account)
    const fbci_account_info_ori = await program.account.ciAccount.getAccountInfo(IP_1.contract_account)
    const owner_account_info_ori = await program.account.userAccount.getAccountInfo(USERS[0].user_account)
    assert(fbci_account_data_ori.withdrawalCount.eq(new BN(0)))

    const inst_withdraw = await program.methods
      .fbWithdraw(IP_1.ipid)
      .signers([USERS[0].keypair])
      .accounts({
        ciAccount: IP_1.contract_account,
        ipAccount: IP_1.ip_account,
        ownerAccount: USERS[0].user_account,
        signer: USERS[0].keypair.publicKey,
      }).instruction()
    const tx = new anchor.web3.Transaction()
    tx.add(inst_withdraw)
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [USERS[0].keypair])

    const fbci_account_data_mod = await program.account.ciAccount.fetch(IP_1.contract_account)
    const fbci_account_info_mod = await program.account.ciAccount.getAccountInfo(IP_1.contract_account)
    const owner_account_info_mod = await program.account.userAccount.getAccountInfo(USERS[0].user_account)
    assert(fbci_account_data_mod.withdrawalCount.eq(new BN(IP_1.contract_data.goalcount)))
    assert(fbci_account_info_ori.lamports - fbci_account_info_mod.lamports === IP_1.contract_data.goalcount * IP_1.contract_data.price)
    assert(owner_account_info_mod.lamports - owner_account_info_ori.lamports === IP_1.contract_data.goalcount * IP_1.contract_data.price)
  })

  it("cb-publish", async ()=>{
    const inst_dup = await program.methods
      .cbPublish(new BN(IP_1.contract_data.price), new BN(IP_1.contract_data.goalcount), new BN(0), IP_1.ipid)
      .signers([USERS[0].keypair])
      .accounts({
        ciAccount: IP_1.contract_account,
        ipAccount: IP_1.ip_account,
        ownerAccount: USERS[0].user_account,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).instruction()
    let tx_dup = new anchor.web3.Transaction()
    tx_dup.add(inst_dup)
    await chai.expect(anchor.web3.sendAndConfirmTransaction(connection, tx_dup, [USERS[0].keypair])).to.be.rejected
    

    const inst_cbci = await program.methods
      .cbPublish(new BN(IP_2.contract_data.price), new BN(IP_2.contract_data.goalcount), new BN(0), IP_2.ipid)
      .signers([USERS[0].keypair])
      .accounts({
        ciAccount: IP_2.contract_account,
        ipAccount: IP_2.ip_account,
        ownerAccount: USERS[0].user_account,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).instruction()

    let tx = new anchor.web3.Transaction()
    tx.add(inst_cbci)
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [USERS[0].keypair])

    let cbci_account_data = await program.account.ciAccount.fetch(IP_2.contract_account)
    let ip_account_data     = await program.account.ipAccount.fetch(IP_2.ip_account)
    assert(cbci_account_data.price.eq(new BN(IP_2.contract_data.price)))
    assert(cbci_account_data.goalcount.eq(new BN(IP_2.contract_data.goalcount)))
    assert(cbci_account_data.currcount.eq(new BN(0)))
    assert(ip_account_data.ownership.eq(new BN(IP_OWNERSHIP_PUBLISHED)))
  })
  
  it("cb-pay", async ()=>{
    let cbci_lamports_ori = (await program.account.ciAccount.getAccountInfo(IP_2.contract_account)).lamports
    for(let i = 1; i < USER_COUNT; i ++) {
      let tx = new anchor.web3.Transaction()
      let user = USERS[i]
      const [cbcp_account]   = PublicKey.findProgramAddressSync([Buffer.from("cp"), user.user_account.toBuffer(), IP_2.contract_account.toBuffer()], program.programId)
      const inst_cbcp = await program.methods
        .cbPay(IP_2.ipid)
        .signers([user.keypair])
        .accounts({
          cpAccount: cbcp_account,
          ciAccount: IP_2.contract_account,
          ipAccount:   IP_2.ip_account,
          userAccount: user.user_account,
          signer:      user.keypair.publicKey,
        }).instruction()
      tx.add(inst_cbcp)
      await anchor.web3.sendAndConfirmTransaction(connection, tx, [user.keypair])
      let cbcp_account_data = await program.account.cpAccount.fetch(cbcp_account)
      let cbci_lamports_mod = (await program.account.ciAccount.getAccountInfo(IP_2.contract_account)).lamports
      console.log("CB-Contract Lamports: ", cbci_lamports_mod - cbci_lamports_ori)
      // assert(cbci_lamports_mod - cbci_lamports_ori === IP_2.contract_data.price * IP_2.contract_data.goalcount)      
      assert(!!cbcp_account_data)
    }

  })

  it("cb-withdraw", async ()=>{
    const cbci_account_data_ori = await program.account.ciAccount.fetch(IP_2.contract_account)
    const cbci_account_info_ori = await program.account.ciAccount.getAccountInfo(IP_2.contract_account)
    const owner_account_info_ori = await program.account.userAccount.getAccountInfo(USERS[0].user_account)
    assert(cbci_account_data_ori.withdrawalCount.eq(new BN(0)))

    const inst_withdraw = await program.methods
      .cbWithraw(IP_2.ipid)
      .signers([USERS[0].keypair])
      .accounts({
        ciAccount: IP_2.contract_account,
        ipAccount: IP_2.ip_account,
        ownerAccount: USERS[0].user_account,
        signer: USERS[0].keypair.publicKey,
      }).instruction()
    const tx = new anchor.web3.Transaction()
    tx.add(inst_withdraw)
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [USERS[0].keypair])

    const cbci_account_data_mod = await program.account.ciAccount.fetch(IP_2.contract_account)
    const cbci_account_info_mod = await program.account.ciAccount.getAccountInfo(IP_2.contract_account)
    const owner_account_info_mod = await program.account.userAccount.getAccountInfo(USERS[0].user_account)
    assert(cbci_account_data_mod.withdrawalCount.eq(new BN(IP_2.contract_data.goalcount)))
    assert(cbci_account_info_ori.lamports - cbci_account_info_mod.lamports === IP_2.contract_data.goalcount * IP_2.contract_data.price)
    assert(owner_account_info_mod.lamports - owner_account_info_ori.lamports === IP_2.contract_data.goalcount * IP_2.contract_data.price)
 
  })

  it("cb-bonus", async ()=>{
    for(let i = 1; i < USER_COUNT; i ++) {
      let user = USERS[i]
      let tx = new anchor.web3.Transaction()
      const [cbcp_account]   = PublicKey.findProgramAddressSync([Buffer.from("cp"), user.user_account.toBuffer(), IP_2.contract_account.toBuffer()], program.programId)
      const inst_bonus = await program.methods
        .cbBonus(IP_2.ipid)
        .accounts({
          ciAccount: IP_2.contract_account,
          cpAccount: cbcp_account,
          userAccount: user.user_account,
          signer:      user.keypair.publicKey
        }).instruction()
      tx.add(inst_bonus)
      await anchor.web3.sendAndConfirmTransaction(connection, tx, [user.keypair])
      const cp_withdrawal = (USER_COUNT - 1 - IP_2.contract_data.goalcount) * IP_2.contract_data.price / (USER_COUNT - 1)
      const user_account_lamp = (await program.account.userAccount.getAccountInfo(user.user_account)).lamports
      const cp_account_data = await program.account.cpAccount.fetch(cbcp_account)
      assert(cp_account_data.withdrawal.eq(new BN(cp_withdrawal)))
      console.log(`USER-${i} Lamports: `, user_account_lamp, cp_account_data.withdrawal.toNumber())
    }
    const cbci_account_info = await program.account.ciAccount.getAccountInfo(IP_2.contract_account)
    const author_account_info = await program.account.userAccount.getAccountInfo(USERS[0].user_account)
    console.log("CBCI   Lamports: ", cbci_account_info.lamports)
    console.log("Author Lamports: ", author_account_info.lamports)
  })

  it("gm-publish", async()=>{
    const inst_ci = await program.methods
      .gmPublish(new BN(IP_3.contract_data.price), new BN(IP_3.contract_data.goalcount), new BN(IP_3.contract_data.maxcount), IP_3.ipid)
      .signers([USERS[0].keypair])
      .accounts({
        ciAccount: IP_3.contract_account,
        ipAccount: IP_3.ip_account,
        ownerAccount: USERS[0].user_account,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).instruction()

    let tx = new anchor.web3.Transaction()
    tx.add(inst_ci)
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [USERS[0].keypair])

    let ci_account_data = await program.account.ciAccount.fetch(IP_3.contract_account)
    let ip_account_data     = await program.account.ipAccount.fetch(IP_3.ip_account)
    assert(ci_account_data.price.eq(new BN(IP_3.contract_data.price)))
    assert(ci_account_data.goalcount.eq(new BN(IP_3.contract_data.goalcount)))
    assert(ci_account_data.maxcount .eq(new BN(IP_3.contract_data.maxcount )))
    assert(ci_account_data.currcount.eq(new BN(0)))
    assert(ip_account_data.ownership.eq(new BN(IP_OWNERSHIP_PUBLISHED)))
  })

  it("gm-pay", async()=>{
    let ci_lamports_ori = (await program.account.ciAccount.getAccountInfo(IP_3.contract_account)).lamports
    for(let i = 1; i < IP_3.contract_data.maxcount + 1; i ++) {
      let tx = new anchor.web3.Transaction()
      let user = USERS[i]
      const [cp_account]   = PublicKey.findProgramAddressSync([Buffer.from("cp"), user.user_account.toBuffer(), IP_3.contract_account.toBuffer()], program.programId)
      const inst_cp = await program.methods
        .gmPay(IP_3.ipid)
        .signers([user.keypair])
        .accounts({
          cpAccount: cp_account,
          ciAccount: IP_3.contract_account,
          ipAccount:   IP_3.ip_account,
          userAccount: user.user_account,
          signer:      user.keypair.publicKey,
        }).instruction()
      tx.add(inst_cp)
      await anchor.web3.sendAndConfirmTransaction(connection, tx, [user.keypair])
      let cp_account_data = await program.account.cpAccount.fetch(cp_account)
      let ci_lamports_mod = (await program.account.ciAccount.getAccountInfo(IP_3.contract_account)).lamports
      console.log("GM-Contract Lamports: ", ci_lamports_mod - ci_lamports_ori)
      // assert(cbci_lamports_mod - cbci_lamports_ori === IP_2.contract_data.price * IP_2.contract_data.goalcount)      
      assert(!!cp_account_data)
    }
    
    let ci_account_data = await program.account.ciAccount.fetch(IP_3.contract_account)
    let ip_account_data     = await program.account.ipAccount.fetch(IP_3.ip_account)
    assert(ci_account_data.currcount.eq(ci_account_data.maxcount))
    assert(ip_account_data.ownership.eq(new BN(IP_OWNERSHIP_PUBLIC)))

    // 在IP公有化后无需再进行支付
    let except_tx = new anchor.web3.Transaction()
    let user = USERS[IP_3.contract_data.maxcount + 1]
    const [cp_account]   = PublicKey.findProgramAddressSync([Buffer.from("cp"), user.user_account.toBuffer(), IP_3.contract_account.toBuffer()], program.programId)
    const inst_cp = await program.methods
      .gmPay(IP_3.ipid)
      .signers([user.keypair])
      .accounts({
        cpAccount: cp_account,
        ciAccount: IP_3.contract_account,
        ipAccount:   IP_3.ip_account,
        userAccount: user.user_account,
        signer:      user.keypair.publicKey,
      }).instruction()
    except_tx.add(inst_cp)
    await chai.expect(anchor.web3.sendAndConfirmTransaction(connection, except_tx, [USERS[0].keypair])).to.be.rejected
  })

  it("gm-withdraw", async()=>{
    const ci_account_data_ori = await program.account.ciAccount.fetch(IP_3.contract_account)
    const ci_account_info_ori = await program.account.ciAccount.getAccountInfo(IP_3.contract_account)
    const owner_account_info_ori = await program.account.userAccount.getAccountInfo(USERS[0].user_account)
    assert(ci_account_data_ori.withdrawalCount.eq(new BN(0)))

    const inst_withdraw = await program.methods
      .gmWithraw(IP_3.ipid)
      .signers([USERS[0].keypair])
      .accounts({
        ciAccount: IP_3.contract_account,
        ipAccount: IP_3.ip_account,
        ownerAccount: USERS[0].user_account,
        signer: USERS[0].keypair.publicKey,
      }).instruction()
    const tx = new anchor.web3.Transaction()
    tx.add(inst_withdraw)
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [USERS[0].keypair])

    const ci_account_data_mod = await program.account.ciAccount.fetch(IP_3.contract_account)
    const ci_account_info_mod = await program.account.ciAccount.getAccountInfo(IP_3.contract_account)
    const owner_account_info_mod = await program.account.userAccount.getAccountInfo(USERS[0].user_account)
    assert(ci_account_data_mod.withdrawalCount.eq(new BN(IP_3.contract_data.goalcount)))
    assert(ci_account_info_ori.lamports - ci_account_info_mod.lamports === IP_3.contract_data.goalcount * IP_3.contract_data.price)
    assert(owner_account_info_mod.lamports - owner_account_info_ori.lamports === IP_3.contract_data.goalcount * IP_3.contract_data.price)

  })

  it("gm-bonus", async()=>{
    for(let i = 1; i < IP_3.contract_data.maxcount + 1; i ++) {
      let user = USERS[i]
      let tx = new anchor.web3.Transaction()
      const [cp_account]   = PublicKey.findProgramAddressSync([Buffer.from("cp"), user.user_account.toBuffer(), IP_3.contract_account.toBuffer()], program.programId)
      const inst_bonus = await program.methods
        .gmBonus(IP_3.ipid)
        .accounts({
          ciAccount: IP_3.contract_account,
          cpAccount: cp_account,
          userAccount: user.user_account,
          signer:      user.keypair.publicKey
        }).instruction()
      tx.add(inst_bonus)
      await anchor.web3.sendAndConfirmTransaction(connection, tx, [user.keypair])
      const cp_withdrawal = (IP_3.contract_data.maxcount - IP_3.contract_data.goalcount) * IP_3.contract_data.price / IP_3.contract_data.maxcount
      const user_account_lamp = (await program.account.userAccount.getAccountInfo(user.user_account)).lamports
      const cp_account_data = await program.account.cpAccount.fetch(cp_account)
      assert(cp_account_data.withdrawal.eq(new BN(cp_withdrawal)))
      console.log(`USER-${i} Lamports: `, user_account_lamp, cp_account_data.withdrawal.toNumber())
    }
    const ci_account_info = await program.account.ciAccount.getAccountInfo(IP_3.contract_account)
    const author_account_info = await program.account.userAccount.getAccountInfo(USERS[0].user_account)
    console.log("GMCI   Lamports: ", ci_account_info.lamports)
    console.log("Author Lamports: ", author_account_info.lamports)
  })

  it("delete accounts", async()=>{
    // for(let IP of [IP_1, IP_2, IP_3]) {
    //   let tx = new anchor.web3.Transaction()
    //   const inst_delete_ip = await program.methods
    //     .deleteIpAccount(IP.ipid)
    //     .signers([USERS[0].keypair])
    //     .accounts({
    //       ipAccount: IP.ip_account,
    //       ownerAccount: USERS[0].user_account,
    //       signer: USERS[0].keypair.publicKey,
    //       systemProgram: SystemProgram.programId,
    //     }).instruction()
    //   tx.add(inst_delete_ip)
    //   await anchor.web3.sendAndConfirmTransaction(connection, tx,[USERS[0].keypair])
    // }

    for(let user of USERS) {
      let tx = new anchor.web3.Transaction()
      const inst_delete_user = await program.methods
        .deleteUserAccount()
        .signers([user.keypair])
        .accounts({
          userAccount: user.user_account,
          signer: user.keypair.publicKey,
          systemProgram: SystemProgram.programId,
        }).instruction()
        tx.add(inst_delete_user)
      await anchor.web3.sendAndConfirmTransaction(connection, tx,[user.keypair])
    }

    for(let user of USERS){
      const balance = await connection.getBalance(user.keypair.publicKey)
      console.log(`${user.username} Balance: ${balance}`)
    }

    for (let user of USERS) {
      let user_account_data = await program.account.userAccount.fetchNullable(user.user_account)
      assert(!user_account_data)
    }
  })

}); 