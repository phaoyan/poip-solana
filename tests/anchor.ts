import * as anchor from "@coral-xyz/anchor";
import type { Poip } from "../target/types/poip";
import { PublicKey, sendAndConfirmTransaction, SIGNATURE_LENGTH_IN_BYTES } from "@solana/web3.js";

describe("Test", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Poip as anchor.Program<Poip>;

  const price = new anchor.BN(10)
  const goalcount = new anchor.BN(1000)
  const ipid = new anchor.BN(159487)
  const author = anchor.web3.Keypair.generate();
  const [contractPda, contractBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("bf-contract"), author.publicKey.toBuffer(), ipid.toBuffer()],
    program.programId
  )


  it("finite-buyout", async ()=>{
    const tx1 = await program.methods
      .fbIssue(price,goalcount,ipid)
      .accounts({contract: contractPda})
      .rpc({commitment: "confirmed"})
    const result = await program.account.fbContractAccount.fetch(contractPda, "confirmed")
    console.log(JSON.stringify(result, null, 2));
    console.log(
      "Transaction Signature:",
      `https://solana.fm/tx/${tx1}?cluster=devnet-solana`
    );
  });

});