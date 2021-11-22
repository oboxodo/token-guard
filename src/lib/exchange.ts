import { findGatewayToken } from "@identity.com/solana-gateway-ts";
import * as anchor from "@project-serum/anchor";
import { Program, web3 } from "@project-serum/anchor";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import { TokenGuard } from "../../target/types/token_guard";
import { deriveMintAuthority, getTokenWallet } from "./util";

export const exchange = async (
  connection: anchor.web3.Connection,
  program: Program<TokenGuard>,
  tokenGuard: anchor.web3.PublicKey,
  sender: anchor.web3.PublicKey,
  payer: anchor.web3.PublicKey,
  gatekeeperNetwork: anchor.web3.PublicKey,
  amount: number
): Promise<TransactionInstruction[]> => {
  const tokenGuardAccount = await program.account.tokenGuard.fetch(tokenGuard);
  const senderAta = await getTokenWallet(sender, tokenGuardAccount.outMint);

  const gatewayToken = await findGatewayToken(
    connection,
    sender,
    gatekeeperNetwork
  );
  if (!gatewayToken) throw new Error("Wallet has no gateway token");

  const [mintAuthority] = await deriveMintAuthority(tokenGuard, program);

  const createATAInstruction = Token.createAssociatedTokenAccountInstruction(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    tokenGuardAccount.outMint,
    senderAta,
    sender,
    payer
  );

  const closeATAInstruction = Token.createCloseAccountInstruction(
    TOKEN_PROGRAM_ID,
    senderAta,
    sender,
    sender,
    []
  );

  const exchangeInstruction = program.instruction.exchange(new BN(amount), {
    accounts: {
      tokenGuard: tokenGuard,
      payer: sender,
      payerAta: senderAta,
      recipient: tokenGuardAccount.recipient,
      outMint: tokenGuardAccount.outMint,
      mintAuthority,
      gatewayToken: gatewayToken.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      clock: web3.SYSVAR_CLOCK_PUBKEY,
    },
  });

  return [createATAInstruction, closeATAInstruction, exchangeInstruction];
};
