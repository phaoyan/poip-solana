import * as anchor from "@coral-xyz/anchor";
import type { Poip } from "../target/types/poip";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { readFileSync } from "fs";
import { BN } from "bn.js";
import assert from "assert";
import chai from "chai"
import chaiAsPromised from "chai-as-promised";
import { getOrCreateAssociatedTokenAccount, mintTo, createMint } from "@solana/spl-token";

chai.use(chaiAsPromised)

const IP_OWNERSHIP_PRIVATE = 1
const IP_OWNERSHIP_PUBLISHED = 2
const IP_OWNERSHIP_PUBLIC = 3

// Global setup for all tests
anchor.setProvider(anchor.AnchorProvider.env());
const program = anchor.workspace.Poip as anchor.Program<Poip>;
const connection = anchor.getProvider().connection;
const wallet_sk = Uint8Array.from(JSON.parse(readFileSync("/root/.config/solana/id.json", "utf-8")));
const wallet = anchor.web3.Keypair.fromSecretKey(wallet_sk);
const INIT_LAMPORT = 5 * LAMPORTS_PER_SOL;
const USER_COUNT = 20;
const USERS: {
  username: string,
  keypair: Keypair,
  user_account: PublicKey
}[] = [];
interface IPItem {
  link: string
  ipid: PublicKey
  ip_account: PublicKey
  contract_account: PublicKey
  contract_data: {
    price: number
    goalcount: number
    maxcount: number
  }
}
const IP: IPItem[] = [];
const IPID_1 = Keypair.generate().publicKey;
const IP_1: IPItem = {
  link: "test-book",
  ipid: IPID_1,
  ip_account: PublicKey.findProgramAddressSync([Buffer.from("ip"), IPID_1.toBuffer()], program.programId)[0],
  contract_account: PublicKey.findProgramAddressSync([Buffer.from("ci"), IPID_1.toBuffer()], program.programId)[0],
  contract_data: {
    price: 1 * LAMPORTS_PER_SOL,
    goalcount: 5,
    maxcount: 5
  }
};
const IPID_2 = Keypair.generate().publicKey;
const IP_2: IPItem = {
  link: "test-movie",
  ipid: IPID_2,
  ip_account: PublicKey.findProgramAddressSync([Buffer.from("ip"), IPID_2.toBuffer()], program.programId)[0],
  contract_account: PublicKey.findProgramAddressSync([Buffer.from("ci"), IPID_2.toBuffer()], program.programId)[0],
  contract_data: {
    price: 1 * LAMPORTS_PER_SOL,
    goalcount: 5,
    maxcount: 10000000
  }
};
const IPID_3 = Keypair.generate().publicKey;
const IP_3: IPItem = {
  link: "test-anime",
  ipid: IPID_3,
  ip_account: PublicKey.findProgramAddressSync([Buffer.from("ip"), IPID_3.toBuffer()], program.programId)[0],
  contract_account: PublicKey.findProgramAddressSync([Buffer.from("ci"), IPID_3.toBuffer()], program.programId)[0],
  contract_data: {
    price: 1 * LAMPORTS_PER_SOL,
    goalcount: 5,
    maxcount: 10
  }
};
let tokenMint: PublicKey;

describe("IP Account Management", async () => {
  before(async () => {
    // Create a token mint for testing
    tokenMint = await createMint(
      connection,
      wallet,
      wallet.publicKey,
      null,
      9
    );

    // Create wallets and initial IP accounts for setup in this describe block
    for (let i = 0; i < USER_COUNT; i++) {
      let tx = new anchor.web3.Transaction();
      let keypair = anchor.web3.Keypair.generate();
      let [user_account] = PublicKey.findProgramAddressSync([Buffer.from("user"), keypair.publicKey.toBuffer()], program.programId);
      tx.add(SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: keypair.publicKey, lamports: INIT_LAMPORT }));
      USERS.push({ username: `user-${i}`, keypair: keypair, user_account: user_account });
      await anchor.web3.sendAndConfirmTransaction(connection, tx, [wallet]);
    }

    // Create initial IP accounts
    for (let a_ip of [IP_1, IP_2, IP_3]) {
      IP.push(a_ip);
      let tx = new anchor.web3.Transaction();
      const inst_create_ip = await program.methods
        .createIpAccount(a_ip.ipid, a_ip.link, "Introduction Link")
        .signers([USERS[0].keypair])
        .accounts({
          ipAccount: a_ip.ip_account,
          signer: USERS[0].keypair.publicKey,
          systemProgram: SystemProgram.programId,
        }).instruction();
      tx.add(inst_create_ip);
      await anchor.web3.sendAndConfirmTransaction(connection, tx, [USERS[0].keypair]);
    }
  });

  it("create accounts", async () => {
    // Existing create accounts test logic here
    let ip_account_data = await program.account.ipAccount.fetch(IP_1.ip_account);
    assert.strictEqual(ip_account_data.link, IP_1.link);
    assert(ip_account_data.ipid.equals(IP_1.ipid));
    assert(ip_account_data.owner.equals(USERS[0].keypair.publicKey));
    assert(ip_account_data.ownership.eq(new BN(IP_OWNERSHIP_PRIVATE)));
  });

  it("update ip link", async () => {
    const newLink = "updated-test-book";
    const tx = new Transaction();
    const updateInstruction = await program.methods
      .updateIpAccountLink(IP_1.ipid, newLink)
      .accounts({
        ipAccount: IP_1.ip_account,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([USERS[0].keypair])
      .instruction();
    tx.add(updateInstruction);
    await sendAndConfirmTransaction(connection, tx, [USERS[0].keypair]);

    const ipAccount = await program.account.ipAccount.fetch(IP_1.ip_account);
    assert.strictEqual(ipAccount.link, newLink);
  });

  it("update ip intro", async () => {
    const newIntro = "ipfs://updated-intro-link";
    const tx = new Transaction();
    const updateInstruction = await program.methods
      .updateIpAccountIntro(IP_1.ipid, newIntro)
      .accounts({
        ipAccount: IP_1.ip_account,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([USERS[0].keypair])
      .instruction();
    tx.add(updateInstruction);
    await sendAndConfirmTransaction(connection, tx, [USERS[0].keypair]);

    const ipAccount = await program.account.ipAccount.fetch(IP_1.ip_account);
    assert.strictEqual(ipAccount.intro, newIntro);
  });

  it("delete ip account", async () => {
    const tx = new Transaction();
    const deleteInstruction = await program.methods
      .deleteIpAccount(IP_1.ipid)
      .accounts({
        ipAccount: IP_1.ip_account,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([USERS[0].keypair])
      .instruction();
    tx.add(deleteInstruction);
    await sendAndConfirmTransaction(connection, tx, [USERS[0].keypair]);

    const account = await connection.getAccountInfo(IP_1.ip_account);
    assert.strictEqual(account, null);

    // Re-create the IP account for subsequent tests
    const createTx = new Transaction();
    const createInstruction = await program.methods
      .createIpAccount(IP_1.ipid, IP_1.link, "Introduction Link")
      .signers([USERS[0].keypair])
      .accounts({
        ipAccount: IP_1.ip_account,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).instruction();
    createTx.add(createInstruction);
    await anchor.web3.sendAndConfirmTransaction(connection, createTx, [USERS[0].keypair]);
  });

  it("fail to delete ip account with wrong ownership", async () => {
    // First, publish the IP account
    const publishTx = new Transaction();
    const publishInstruction = await program.methods
      .publish(IP_1.ipid, new BN(IP_1.contract_data.price), new BN(IP_1.contract_data.goalcount), new BN(IP_1.contract_data.maxcount))
      .accounts({
        ciAccount: IP_1.contract_account,
        ipAccount: IP_1.ip_account,
        signer: USERS[0].keypair.publicKey,
        tokenMint: tokenMint,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: IP_1.contract_account }),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([USERS[0].keypair])
      .instruction();
    publishTx.add(publishInstruction);
    await sendAndConfirmTransaction(connection, publishTx, [USERS[0].keypair]);

    // Attempt to delete the IP account which is now PUBLISHED
    const deleteTx = new Transaction();
    const deleteInstruction = await program.methods
      .deleteIpAccount(IP_1.ipid)
      .accounts({
        ipAccount: IP_1.ip_account,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([USERS[0].keypair])
      .instruction();
    deleteTx.add(deleteInstruction)
    await assert.rejects(sendAndConfirmTransaction(connection, deleteTx, [USERS[0].keypair]));

    // Revert ownership back to PRIVATE for subsequent tests
    const revertTx = new Transaction();
    const revertInstruction = await program.methods
      .updateIpAccountLink(IP_1.ipid, IP_1.link) // Just to trigger a realloc and allow state change
      .accounts({
        ipAccount: IP_1.ip_account,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([USERS[0].keypair])
      .instruction();
    revertTx.add(revertInstruction);
    await sendAndConfirmTransaction(connection, revertTx, [USERS[0].keypair]);

    const ipAccount = await program.account.ipAccount.fetch(IP_1.ip_account);
    assert.strictEqual(ipAccount.ownership.toNumber(), IP_OWNERSHIP_PUBLISHED); // Still published

    // Need to implement a way to change ownership back to private or handle this scenario in other tests
    // For now, let's just ensure the deletion failed as expected
  });
});

describe("Publishing and Paying", async () => {
  before(async () => {
    tokenMint = await createMint(
      connection,
      wallet,
      wallet.publicKey,
      null,
      9
    );

    if (USERS.length === 0) {
      for (let i = 0; i < USER_COUNT; i++) {
        let tx = new anchor.web3.Transaction();
        let keypair = anchor.web3.Keypair.generate();
        let [user_account] = PublicKey.findProgramAddressSync([Buffer.from("user"), keypair.publicKey.toBuffer()], program.programId);
        tx.add(SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: keypair.publicKey, lamports: INIT_LAMPORT }));
        USERS.push({ username: `user-${i}`, keypair: keypair, user_account: user_account });
        await anchor.web3.sendAndConfirmTransaction(connection, tx, [wallet]);
      }
    }
  });

  it("publish", async () => {
    const ipid = Keypair.generate().publicKey;
    const ip_account_address = PublicKey.findProgramAddressSync([Buffer.from("ip"), ipid.toBuffer()], program.programId)[0];
    const contract_account_address = PublicKey.findProgramAddressSync([Buffer.from("ci"), ipid.toBuffer()], program.programId)[0];
    const link = "test-book";
    const contractData = { price: 1 * LAMPORTS_PER_SOL, goalcount: 5, maxcount: 5 };

    // Create IP Account first
    await program.methods
      .createIpAccount(ipid, link, "Introduction Link")
      .signers([USERS[0].keypair])
      .accounts({
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

    const tx = new Transaction();
    const publishInstruction = await program.methods
      .publish(ipid, new BN(contractData.price), new BN(contractData.goalcount), new BN(contractData.maxcount))
      .accounts({
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        tokenMint: tokenMint,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([USERS[0].keypair])
      .instruction();
    tx.add(publishInstruction);
    await sendAndConfirmTransaction(connection, tx, [USERS[0].keypair]);

    const ipAccount = await program.account.ipAccount.fetch(ip_account_address);
    assert.strictEqual(ipAccount.ownership.toNumber(), IP_OWNERSHIP_PUBLISHED);

    const ciAccount = await program.account.ciAccount.fetch(contract_account_address);
    assert(ciAccount.ipid.equals(ipid));
    assert(ciAccount.price.eq(new BN(contractData.price)));
    assert(ciAccount.goalcount.eq(new BN(contractData.goalcount)));
    assert(ciAccount.maxcount.eq(new BN(contractData.maxcount)));
    assert(ciAccount.currcount.eq(new BN(0)));
    assert(ciAccount.withdrawalCount.eq(new BN(0)));
  });

  it("pay", async () => {
    const ipid = Keypair.generate().publicKey;
    const ip_account_address = PublicKey.findProgramAddressSync([Buffer.from("ip"), ipid.toBuffer()], program.programId)[0];
    const contract_account_address = PublicKey.findProgramAddressSync([Buffer.from("ci"), ipid.toBuffer()], program.programId)[0];
    const link = "test-book";
    const contractData = { price: 1 * LAMPORTS_PER_SOL, goalcount: 5, maxcount: 5 };
    const payer = USERS[1];

    // Create IP Account
    await program.methods
      .createIpAccount(ipid, link, "Introduction Link")
      .signers([USERS[0].keypair])
      .accounts({
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

    // Publish the IP
    await program.methods
      .publish(ipid, new BN(contractData.price), new BN(contractData.goalcount), new BN(contractData.maxcount))
      .accounts({
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        tokenMint: tokenMint,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([USERS[0].keypair])
      .rpc();

    const payerTokenAccount = await getOrCreateAssociatedTokenAccount(connection, payer.keypair, tokenMint, payer.keypair.publicKey);
    const ciTokenAccount = anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address });


    // Mint tokens to the payer
    await mintTo(connection, payer.keypair, tokenMint, payerTokenAccount.address, wallet, contractData.price);

    const cpAccountAddress = PublicKey.findProgramAddressSync(
      [Buffer.from("cp"), payer.keypair.publicKey.toBuffer(), contract_account_address.toBuffer()],
      program.programId
    )[0];

    const initialCiTokenBalance = await connection.getTokenAccountBalance(ciTokenAccount);
    const initialPayerTokenBalance = await connection.getTokenAccountBalance(payerTokenAccount.address);

    await program.methods
      .pay(ipid)
      .accounts({
        cpAccount: cpAccountAddress,
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: payer.keypair.publicKey,
        payerTokenAccount: payerTokenAccount.address,
        ciTokenAccount: ciTokenAccount,
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .signers([payer.keypair])
      .rpc();

    const ciAccountData = await program.account.ciAccount.fetch(contract_account_address);
    assert(ciAccountData.currcount.eq(new BN(1)));

    const finalCiTokenBalance = await connection.getTokenAccountBalance(ciTokenAccount);
    const finalPayerTokenBalance = await connection.getTokenAccountBalance(payerTokenAccount.address);

    assert.strictEqual(finalCiTokenBalance.value.uiAmount, (initialCiTokenBalance.value.uiAmount || 0) + contractData.price / (10 ** 9));
    assert.strictEqual(finalPayerTokenBalance.value.uiAmount, (initialPayerTokenBalance.value.uiAmount || contractData.price / (10 ** 9)) - contractData.price / (10 ** 9));
  });

  it("fail to publish with wrong ownership", async () => {
    const ipid = Keypair.generate().publicKey;
    const ip_account_address = PublicKey.findProgramAddressSync([Buffer.from("ip"), ipid.toBuffer()], program.programId)[0];
    const contract_account_address = PublicKey.findProgramAddressSync([Buffer.from("ci"), ipid.toBuffer()], program.programId)[0];
    const link = "test-book";
    const contractData = { price: 1 * LAMPORTS_PER_SOL, goalcount: 5, maxcount: 5 };

    // Create IP Account
    await program.methods
      .createIpAccount(ipid, link, "Introduction Link")
      .signers([USERS[0].keypair])
      .accounts({
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

    // Change IP ownership to PUBLISHED
    await program.methods
      .publish(ipid, new BN(contractData.price), new BN(contractData.goalcount), new BN(contractData.maxcount))
      .accounts({
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        tokenMint: tokenMint,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([USERS[0].keypair])
      .rpc();

    await assert.rejects(
      program.methods
        .publish(ipid, new BN(contractData.price), new BN(contractData.goalcount), new BN(contractData.maxcount))
        .accounts({
          ciAccount: contract_account_address,
          ipAccount: ip_account_address,
          signer: USERS[0].keypair.publicKey,
          tokenMint: tokenMint,
          ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([USERS[0].keypair])
        .rpc(),
    );
  });

  it("fail to publish with invalid parameters", async () => {
    const ipid = Keypair.generate().publicKey;
    const ip_account_address = PublicKey.findProgramAddressSync([Buffer.from("ip"), ipid.toBuffer()], program.programId)[0];
    const contract_account_address = PublicKey.findProgramAddressSync([Buffer.from("ci"), ipid.toBuffer()], program.programId)[0];
    const link = "test-book";

    // Create IP Account
    await program.methods
      .createIpAccount(ipid, link, "Introduction Link")
      .signers([USERS[0].keypair])
      .accounts({
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

    // Invalid price (0)
    await assert.rejects(
      program.methods
        .publish(ipid, new BN(0), new BN(5), new BN(5))
        .accounts({
          ciAccount: contract_account_address,
          ipAccount: ip_account_address,
          signer: USERS[0].keypair.publicKey,
          tokenMint: tokenMint,
          ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([USERS[0].keypair])
        .rpc(),
    );

    // Invalid goalcount (0)
    await assert.rejects(
      program.methods
        .publish(ipid, new BN(1 * LAMPORTS_PER_SOL), new BN(0), new BN(5))
        .accounts({
          ciAccount: contract_account_address,
          ipAccount: ip_account_address,
          signer: USERS[0].keypair.publicKey,
          tokenMint: tokenMint,
          ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([USERS[0].keypair])
        .rpc(),
    );

    // Invalid maxcount (less than goalcount)
    await assert.rejects(
      program.methods
        .publish(ipid, new BN(1 * LAMPORTS_PER_SOL), new BN(5), new BN(4))
        .accounts({
          ciAccount: contract_account_address,
          ipAccount: ip_account_address,
          signer: USERS[0].keypair.publicKey,
          tokenMint: tokenMint,
          ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([USERS[0].keypair])
        .rpc(),
    );
  });

  it("fail to pay before publishing", async () => {
    const ipid = Keypair.generate().publicKey;
    const ip_account_address = PublicKey.findProgramAddressSync([Buffer.from("ip"), ipid.toBuffer()], program.programId)[0];
    const contract_account_address = PublicKey.findProgramAddressSync([Buffer.from("ci"), ipid.toBuffer()], program.programId)[0];
    const link = "test-book";
    const contractData = { price: 1 * LAMPORTS_PER_SOL, goalcount: 5, maxcount: 5 };
    const payer = USERS[1];

    // Create IP Account
    await program.methods
      .createIpAccount(ipid, link, "Introduction Link")
      .signers([USERS[0].keypair])
      .accounts({
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

    const payerTokenAccount = await getOrCreateAssociatedTokenAccount(connection, payer.keypair, tokenMint, payer.keypair.publicKey);
    const ciTokenAccount = anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address });


    // Mint tokens to the payer
    await mintTo(connection, payer.keypair, tokenMint, payerTokenAccount.address, wallet, contractData.price);

    const cpAccountAddress = PublicKey.findProgramAddressSync(
      [Buffer.from("cp"), payer.keypair.publicKey.toBuffer(), contract_account_address.toBuffer()],
      program.programId
    )[0];

    await assert.rejects(
      program.methods
        .pay(ipid)
        .accounts({
          cpAccount: cpAccountAddress,
          ciAccount: contract_account_address,
          ipAccount: ip_account_address,
          signer: payer.keypair.publicKey,
          payerTokenAccount: payerTokenAccount.address,
          ciTokenAccount: ciTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([payer.keypair])
        .rpc(),
    );
  });

  it("fail to pay with insufficient funds", async () => {
    const ipid = Keypair.generate().publicKey;
    const ip_account_address = PublicKey.findProgramAddressSync([Buffer.from("ip"), ipid.toBuffer()], program.programId)[0];
    const contract_account_address = PublicKey.findProgramAddressSync([Buffer.from("ci"), ipid.toBuffer()], program.programId)[0];
    const link = "test-book";
    const contractData = { price: 1000 * LAMPORTS_PER_SOL, goalcount: 5, maxcount: 5 };
    const payer = USERS[1];

    // Create IP Account
    await program.methods
      .createIpAccount(ipid, link, "Introduction Link")
      .signers([USERS[0].keypair])
      .accounts({
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

    // Publish the IP
    await program.methods
      .publish(ipid, new BN(contractData.price), new BN(contractData.goalcount), new BN(contractData.maxcount))
      .accounts({
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        tokenMint: tokenMint,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([USERS[0].keypair])
      .rpc();

    const payerTokenAccount = await getOrCreateAssociatedTokenAccount(connection, payer.keypair, tokenMint, payer.keypair.publicKey);
    const ciTokenAccount = anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address });


    // Do not mint enough tokens to the payer

    const cpAccountAddress = PublicKey.findProgramAddressSync(
      [Buffer.from("cp"), payer.keypair.publicKey.toBuffer(), contract_account_address.toBuffer()],
      program.programId
    )[0];

    await assert.rejects(
      program.methods
        .pay(ipid)
        .accounts({
          cpAccount: cpAccountAddress,
          ciAccount: contract_account_address,
          ipAccount: ip_account_address,
          signer: payer.keypair.publicKey,
          payerTokenAccount: payerTokenAccount.address,
          ciTokenAccount: ciTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([payer.keypair])
        .rpc(),
    );
  });

  it("pay successfully", async () => {
    const ipid = Keypair.generate().publicKey;
    const ip_account_address = PublicKey.findProgramAddressSync([Buffer.from("ip"), ipid.toBuffer()], program.programId)[0];
    const contract_account_address = PublicKey.findProgramAddressSync([Buffer.from("ci"), ipid.toBuffer()], program.programId)[0];
    const link = "test-book";
    const contractData = { price: 1 * LAMPORTS_PER_SOL, goalcount: 5, maxcount: 5 };
    const payer = USERS[1];

    // Create IP Account
    await program.methods
      .createIpAccount(ipid, link, "Introduction Link")
      .signers([USERS[0].keypair])
      .accounts({
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

    // Publish the IP
    await program.methods
      .publish(ipid, new BN(contractData.price), new BN(contractData.goalcount), new BN(contractData.maxcount))
      .accounts({
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        tokenMint: tokenMint,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([USERS[0].keypair])
      .rpc();

    const payerTokenAccount = await getOrCreateAssociatedTokenAccount(connection, payer.keypair, tokenMint, payer.keypair.publicKey);
    const ciTokenAccount = anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address });


    // Mint tokens to the payer
    await mintTo(connection, payer.keypair, tokenMint, payerTokenAccount.address, wallet, contractData.price);

    const cpAccountAddress = PublicKey.findProgramAddressSync(
      [Buffer.from("cp"), payer.keypair.publicKey.toBuffer(), contract_account_address.toBuffer()],
      program.programId
    )[0];

    const initialCiTokenBalance = await connection.getTokenAccountBalance(ciTokenAccount);
    const initialPayerTokenBalance = await connection.getTokenAccountBalance(payerTokenAccount.address);

    await program.methods
      .pay(ipid)
      .accounts({
        cpAccount: cpAccountAddress,
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: payer.keypair.publicKey,
        payerTokenAccount: payerTokenAccount.address,
        ciTokenAccount: ciTokenAccount,
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .signers([payer.keypair])
      .rpc();

    const ciAccountData = await program.account.ciAccount.fetch(contract_account_address);
    assert(ciAccountData.currcount.eq(new BN(1)));

    const finalCiTokenBalance = await connection.getTokenAccountBalance(ciTokenAccount);
    const finalPayerTokenBalance = await connection.getTokenAccountBalance(payerTokenAccount.address);

    assert.strictEqual(finalCiTokenBalance.value.uiAmount, (initialCiTokenBalance.value.uiAmount || 0) + contractData.price / (10 ** 9));
    assert.strictEqual(finalPayerTokenBalance.value.uiAmount, (initialPayerTokenBalance.value.uiAmount || contractData.price / (10 ** 9)) - contractData.price / (10 ** 9));
  });

  it("reach goal count", async () => {
    const ipid = Keypair.generate().publicKey;
    const ip_account_address = PublicKey.findProgramAddressSync([Buffer.from("ip"), ipid.toBuffer()], program.programId)[0];
    const contract_account_address = PublicKey.findProgramAddressSync([Buffer.from("ci"), ipid.toBuffer()], program.programId)[0];
    const link = "test-book";
    const contractData = { price: 1 * LAMPORTS_PER_SOL, goalcount: 3, maxcount: 5 }; // Adjusted goalcount

    // Create IP Account
    await program.methods
      .createIpAccount(ipid, link, "Introduction Link")
      .signers([USERS[0].keypair])
      .accounts({
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

    // Publish the IP
    await program.methods
      .publish(ipid, new BN(contractData.price), new BN(contractData.goalcount), new BN(contractData.maxcount))
      .accounts({
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        tokenMint: tokenMint,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([USERS[0].keypair])
      .rpc();

    for (let i = 1; i <= contractData.goalcount; i++) {
      const payer = USERS[i];
      const payerTokenAccount = await getOrCreateAssociatedTokenAccount(connection, payer.keypair, tokenMint, payer.keypair.publicKey);
      const ciTokenAccount = anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address });

      await mintTo(connection, payer.keypair, tokenMint, payerTokenAccount.address, wallet, contractData.price);
      const cpAccountAddress = PublicKey.findProgramAddressSync(
        [Buffer.from("cp"), payer.keypair.publicKey.toBuffer(), contract_account_address.toBuffer()],
        program.programId
      )[0];
      await program.methods
        .pay(ipid)
        .accounts({
          cpAccount: cpAccountAddress,
          ciAccount: contract_account_address,
          ipAccount: ip_account_address,
          signer: payer.keypair.publicKey,
          payerTokenAccount: payerTokenAccount.address,
          ciTokenAccount: ciTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([payer.keypair])
        .rpc();
    }

    const ipAccount = await program.account.ipAccount.fetch(ip_account_address);
    assert.strictEqual(ipAccount.ownership.toNumber(), IP_OWNERSHIP_PUBLISHED); // Should remain PUBLISHED until max count
    const ciAccountData = await program.account.ciAccount.fetch(contract_account_address);
    assert(ciAccountData.currcount.eq(new BN(contractData.goalcount)));
  });

  it("reach max count", async () => {
    const ipid = Keypair.generate().publicKey;
    const ip_account_address = PublicKey.findProgramAddressSync([Buffer.from("ip"), ipid.toBuffer()], program.programId)[0];
    const contract_account_address = PublicKey.findProgramAddressSync([Buffer.from("ci"), ipid.toBuffer()], program.programId)[0];
    const link = "test-book";
    const contractData = { price: 1 * LAMPORTS_PER_SOL, goalcount: 3, maxcount: 5 }; // Adjusted goalcount

    // Create IP Account
    await program.methods
      .createIpAccount(ipid, link, "Introduction Link")
      .signers([USERS[0].keypair])
      .accounts({
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

    // Publish the IP
    await program.methods
      .publish(ipid, new BN(contractData.price), new BN(contractData.goalcount), new BN(contractData.maxcount))
      .accounts({
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: USERS[0].keypair.publicKey,
        tokenMint: tokenMint,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([USERS[0].keypair])
      .rpc();

    for (let i = 1; i <= contractData.maxcount; i++) {
      const payer = USERS[i];
      const payerTokenAccount = await getOrCreateAssociatedTokenAccount(connection, payer.keypair, tokenMint, payer.keypair.publicKey);
      const ciTokenAccount = anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address });

      await mintTo(connection, payer.keypair, tokenMint, payerTokenAccount.address, wallet, contractData.price);
      const cpAccountAddress = PublicKey.findProgramAddressSync(
        [Buffer.from("cp"), payer.keypair.publicKey.toBuffer(), contract_account_address.toBuffer()],
        program.programId
      )[0];
      await program.methods
        .pay(ipid)
        .accounts({
          cpAccount: cpAccountAddress,
          ciAccount: contract_account_address,
          ipAccount: ip_account_address,
          signer: payer.keypair.publicKey,
          payerTokenAccount: payerTokenAccount.address,
          ciTokenAccount: ciTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([payer.keypair])
        .rpc();
    }

    const ipAccount = await program.account.ipAccount.fetch(ip_account_address);
    assert.strictEqual(ipAccount.ownership.toNumber(), IP_OWNERSHIP_PUBLIC); // Should be Public
    const ciAccountData = await program.account.ciAccount.fetch(contract_account_address);
    assert(ciAccountData.currcount.eq(new BN(contractData.maxcount)));
  });
});

describe("Withdrawal and Bonus", async () => {
  before(async () => {
    // Setup specific to withdrawal and bonus tests
    tokenMint = await createMint(
      connection,
      wallet,
      wallet.publicKey,
      null,
      9
    );
    if (USERS.length === 0) {
      for (let i = 0; i < USER_COUNT; i++) {
        let tx = new anchor.web3.Transaction();
        let keypair = anchor.web3.Keypair.generate();
        let [user_account] = PublicKey.findProgramAddressSync([Buffer.from("user"), keypair.publicKey.toBuffer()], program.programId);
        tx.add(SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: keypair.publicKey, lamports: INIT_LAMPORT }));
        USERS.push({ username: `user-${i}`, keypair: keypair, user_account: user_account });
        await anchor.web3.sendAndConfirmTransaction(connection, tx, [wallet]);
      }
    }
    if (IP.length === 0) {
      for (let a_ip of [IP_1, IP_2, IP_3]) {
        IP.push(a_ip);
        let tx = new anchor.web3.Transaction();
        const inst_create_ip = await program.methods
          .createIpAccount(a_ip.ipid, a_ip.link, "Introduction Link")
          .signers([USERS[0].keypair])
          .accounts({
            ipAccount: a_ip.ip_account,
            signer: USERS[0].keypair.publicKey,
            systemProgram: SystemProgram.programId,
          }).instruction();
        tx.add(inst_create_ip);
        await anchor.web3.sendAndConfirmTransaction(connection, tx, [USERS[0].keypair]);
      }
    }
  });

  it("fail to withdraw with wrong signer", async () => {
    const ipid = Keypair.generate().publicKey;
    const ip_account_address = PublicKey.findProgramAddressSync([Buffer.from("ip"), ipid.toBuffer()], program.programId)[0];
    const contract_account_address = PublicKey.findProgramAddressSync([Buffer.from("ci"), ipid.toBuffer()], program.programId)[0];
    const link = "test-book";
    const contractData = { price: 1 * LAMPORTS_PER_SOL, goalcount: 5, maxcount: 5 };
    const owner = USERS[0];

    // Create IP Account
    await program.methods
      .createIpAccount(ipid, link, "Introduction Link")
      .signers([owner.keypair])
      .accounts({
        ipAccount: ip_account_address,
        signer: owner.keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

    // Publish the IP
    await program.methods
      .publish(ipid, new BN(contractData.price), new BN(contractData.goalcount), new BN(contractData.maxcount))
      .accounts({
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: owner.keypair.publicKey,
        tokenMint: tokenMint,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([owner.keypair])
      .rpc();

    // Attempt to withdraw with a non-owner signer
    await assert.rejects(
      program.methods
        .withraw(ipid)
        .accounts({
          ciAccount: contract_account_address,
          ipAccount: ip_account_address,
          signer: USERS[1].keypair.publicKey, // Wrong signer
          ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
          ownerTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: owner.keypair.publicKey }),
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([USERS[1].keypair])
        .rpc()
    );
  });

  it("withdraw successfully after reaching goal", async () => {
    const ipid = Keypair.generate().publicKey;
    const ip_account_address = PublicKey.findProgramAddressSync([Buffer.from("ip"), ipid.toBuffer()], program.programId)[0];
    const contract_account_address = PublicKey.findProgramAddressSync([Buffer.from("ci"), ipid.toBuffer()], program.programId)[0];
    const link = "test-book";
    const contractData = { price: 1 * LAMPORTS_PER_SOL, goalcount: 3, maxcount: 5 };
    const owner = USERS[0];

    await getOrCreateAssociatedTokenAccount(connection, owner.keypair, tokenMint, owner.keypair.publicKey)

    // Create IP Account
    await program.methods
      .createIpAccount(ipid, link, "Introduction Link")
      .signers([owner.keypair])
      .accounts({
        ipAccount: ip_account_address,
        signer: owner.keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

    // Publish the IP
    await program.methods
      .publish(ipid, new BN(contractData.price), new BN(contractData.goalcount), new BN(contractData.maxcount))
      .accounts({
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: owner.keypair.publicKey,
        tokenMint: tokenMint,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([owner.keypair])
      .rpc();

    // Simulate contributions to reach the goal
    for (let i = 1; i <= contractData.goalcount; i++) {
      const contributor = USERS[i];
      const contributorTokenAccount = await getOrCreateAssociatedTokenAccount(connection, contributor.keypair, tokenMint, contributor.keypair.publicKey);
      await mintTo(connection, contributor.keypair, tokenMint, contributorTokenAccount.address, wallet, contractData.price);
      const cpAccountAddress = PublicKey.findProgramAddressSync(
        [Buffer.from("cp"), contributor.keypair.publicKey.toBuffer(), contract_account_address.toBuffer()],
        program.programId
      )[0];
      await program.methods
        .pay(ipid)
        .accounts({
          cpAccount: cpAccountAddress,
          ciAccount: contract_account_address,
          ipAccount: ip_account_address,
          signer: contributor.keypair.publicKey,
          payerTokenAccount: contributorTokenAccount.address,
          ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([contributor.keypair])
        .rpc();
    }

    const initialOwnerTokenBalance = await connection.getTokenAccountBalance(anchor.utils.token.associatedAddress({ mint: tokenMint, owner: owner.keypair.publicKey }));

    // Withdraw
    await program.methods
      .withraw(ipid)
      .accounts({
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: owner.keypair.publicKey,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        ownerTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: owner.keypair.publicKey }),
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .signers([owner.keypair])
      .rpc();

    const finalOwnerTokenBalance = await connection.getTokenAccountBalance(anchor.utils.token.associatedAddress({ mint: tokenMint, owner: owner.keypair.publicKey }));
    assert.strictEqual(finalOwnerTokenBalance.value.uiAmount, (initialOwnerTokenBalance.value.uiAmount || 0) + contractData.goalcount * contractData.price / (10 ** 9));
  });

  it("bonus distributed correctly", async () => {
    const ipid = Keypair.generate().publicKey;
    const ip_account_address = PublicKey.findProgramAddressSync([Buffer.from("ip"), ipid.toBuffer()], program.programId)[0];
    const contract_account_address = PublicKey.findProgramAddressSync([Buffer.from("ci"), ipid.toBuffer()], program.programId)[0];
    const link = "test-book";
    const contractData = { price: 1 * LAMPORTS_PER_SOL, goalcount: 2, maxcount: 4 };
    const owner = USERS[0];
    const contributor = USERS[1];

    // Create IP Account
    await program.methods
      .createIpAccount(ipid, link, "Introduction Link")
      .signers([owner.keypair])
      .accounts({
        ipAccount: ip_account_address,
        signer: owner.keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

    // Publish the IP
    await program.methods
      .publish(ipid, new BN(contractData.price), new BN(contractData.goalcount), new BN(contractData.maxcount))
      .accounts({
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: owner.keypair.publicKey,
        tokenMint: tokenMint,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([owner.keypair])
      .rpc();

    // Simulate contributions exceeding the goal
    for (let i = 1; i <= contractData.maxcount; i++) {
      const payer = USERS[i];
      const payerTokenAccount = await getOrCreateAssociatedTokenAccount(connection, payer.keypair, tokenMint, payer.keypair.publicKey);
      await mintTo(connection, payer.keypair, tokenMint, payerTokenAccount.address, wallet, contractData.price);
      const cpAccountAddress = PublicKey.findProgramAddressSync(
        [Buffer.from("cp"), payer.keypair.publicKey.toBuffer(), contract_account_address.toBuffer()],
        program.programId
      )[0];
      await program.methods
        .pay(ipid)
        .accounts({
          cpAccount: cpAccountAddress,
          ciAccount: contract_account_address,
          ipAccount: ip_account_address,
          signer: payer.keypair.publicKey,
          payerTokenAccount: payerTokenAccount.address,
          ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([payer.keypair])
        .rpc();
    }

    const cpAccountAddress = PublicKey.findProgramAddressSync(
      [Buffer.from("cp"), contributor.keypair.publicKey.toBuffer(), contract_account_address.toBuffer()],
      program.programId
    )[0];
    const initialContributorTokenBalance = await connection.getTokenAccountBalance(anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contributor.keypair.publicKey }));

    await program.methods
      .bonus(ipid)
      .accounts({
        ciAccount: contract_account_address,
        cpAccount: cpAccountAddress,
        signer: contributor.keypair.publicKey,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        userTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contributor.keypair.publicKey }),
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .signers([contributor.keypair])
      .rpc();

    const finalContributorTokenBalance = await connection.getTokenAccountBalance(anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contributor.keypair.publicKey }));
    const expectedBonus = (contractData.maxcount - contractData.goalcount) * contractData.price / contractData.maxcount;
    assert.strictEqual(finalContributorTokenBalance.value.uiAmount, (initialContributorTokenBalance.value.uiAmount || 0) + expectedBonus / (10 ** 9));
  });

  it("fail to claim bonus if no bonus available", async () => {
    const ipid = Keypair.generate().publicKey;
    const ip_account_address = PublicKey.findProgramAddressSync([Buffer.from("ip"), ipid.toBuffer()], program.programId)[0];
    const contract_account_address = PublicKey.findProgramAddressSync([Buffer.from("ci"), ipid.toBuffer()], program.programId)[0];
    const link = "test-book";
    const contractData = { price: 1 * LAMPORTS_PER_SOL, goalcount: 3, maxcount: 3 };
    const owner = USERS[0];
    const contributor = USERS[1];

    // Create IP Account
    await program.methods
      .createIpAccount(ipid, link, "Introduction Link")
      .signers([owner.keypair])
      .accounts({
        ipAccount: ip_account_address,
        signer: owner.keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

    // Publish the IP
    await program.methods
      .publish(ipid, new BN(contractData.price), new BN(contractData.goalcount), new BN(contractData.maxcount))
      .accounts({
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: owner.keypair.publicKey,
        tokenMint: tokenMint,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([owner.keypair])
      .rpc();

    // Simulate contributions up to the goal, so no bonus is available
    for (let i = 1; i <= contractData.goalcount; i++) {
      const payer = USERS[i];
      const payerTokenAccount = await getOrCreateAssociatedTokenAccount(connection, payer.keypair, tokenMint, payer.keypair.publicKey);
      await mintTo(connection, payer.keypair, tokenMint, payerTokenAccount.address, wallet, contractData.price);
      const cpAccountAddress = PublicKey.findProgramAddressSync(
        [Buffer.from("cp"), payer.keypair.publicKey.toBuffer(), contract_account_address.toBuffer()],
        program.programId
      )[0];
      await program.methods
        .pay(ipid)
        .accounts({
          cpAccount: cpAccountAddress,
          ciAccount: contract_account_address,
          ipAccount: ip_account_address,
          signer: payer.keypair.publicKey,
          payerTokenAccount: payerTokenAccount.address,
          ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([payer.keypair])
        .rpc();
    }

    const cpAccountAddress = PublicKey.findProgramAddressSync(
      [Buffer.from("cp"), contributor.keypair.publicKey.toBuffer(), contract_account_address.toBuffer()],
      program.programId
    )[0];

    await assert.rejects(
      program.methods
        .bonus(ipid)
        .accounts({
          ciAccount: contract_account_address,
          cpAccount: cpAccountAddress,
          signer: contributor.keypair.publicKey,
          ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
          userTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contributor.keypair.publicKey }),
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([contributor.keypair])
        .rpc()
    );
  });

  it("claim bonus successfully", async () => {
    const ipid = Keypair.generate().publicKey;
    const ip_account_address = PublicKey.findProgramAddressSync([Buffer.from("ip"), ipid.toBuffer()], program.programId)[0];
    const contract_account_address = PublicKey.findProgramAddressSync([Buffer.from("ci"), ipid.toBuffer()], program.programId)[0];
    const link = "test-book";
    const contractData = { price: 1 * LAMPORTS_PER_SOL, goalcount: 2, maxcount: 4 };
    const owner = USERS[0];
    const contributor = USERS[1];

    // Create IP Account
    await program.methods
      .createIpAccount(ipid, link, "Introduction Link")
      .signers([owner.keypair])
      .accounts({
        ipAccount: ip_account_address,
        signer: owner.keypair.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

    // Publish the IP
    await program.methods
      .publish(ipid, new BN(contractData.price), new BN(contractData.goalcount), new BN(contractData.maxcount))
      .accounts({
        ciAccount: contract_account_address,
        ipAccount: ip_account_address,
        signer: owner.keypair.publicKey,
        tokenMint: tokenMint,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([owner.keypair])
      .rpc();

    // Simulate contributions exceeding the goal
    for (let i = 1; i <= contractData.maxcount; i++) {
      const payer = USERS[i];
      const payerTokenAccount = await getOrCreateAssociatedTokenAccount(connection, payer.keypair, tokenMint, payer.keypair.publicKey);
      await mintTo(connection, payer.keypair, tokenMint, payerTokenAccount.address, wallet, contractData.price);
      const cpAccountAddress = PublicKey.findProgramAddressSync(
        [Buffer.from("cp"), payer.keypair.publicKey.toBuffer(), contract_account_address.toBuffer()],
        program.programId
      )[0];
      await program.methods
        .pay(ipid)
        .accounts({
          cpAccount: cpAccountAddress,
          ciAccount: contract_account_address,
          ipAccount: ip_account_address,
          signer: payer.keypair.publicKey,
          payerTokenAccount: payerTokenAccount.address,
          ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
          systemProgram: SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([payer.keypair])
        .rpc();
    }

    const cpAccountAddress = PublicKey.findProgramAddressSync(
      [Buffer.from("cp"), contributor.keypair.publicKey.toBuffer(), contract_account_address.toBuffer()],
      program.programId
    )[0];
    const initialContributorTokenBalance = await connection.getTokenAccountBalance(anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contributor.keypair.publicKey }));

    await program.methods
      .bonus(ipid)
      .accounts({
        ciAccount: contract_account_address,
        cpAccount: cpAccountAddress,
        signer: contributor.keypair.publicKey,
        ciTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contract_account_address }),
        userTokenAccount: anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contributor.keypair.publicKey }),
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .signers([contributor.keypair])
      .rpc();

    const finalContributorTokenBalance = await connection.getTokenAccountBalance(anchor.utils.token.associatedAddress({ mint: tokenMint, owner: contributor.keypair.publicKey }));
    const expectedBonus = (contractData.maxcount - contractData.goalcount) * contractData.price / contractData.maxcount;
    assert.strictEqual(finalContributorTokenBalance.value.uiAmount, (initialContributorTokenBalance.value.uiAmount || 0) + expectedBonus / (10 ** 9));
  });
});