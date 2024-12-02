import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import type { Poip } from "../target/types/poip";

// Configure the client to use the local cluster
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.Poip as anchor.Program<Poip>;

