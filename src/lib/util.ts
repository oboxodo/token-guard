import * as anchor from "@project-serum/anchor";
import { Program, Provider, web3, Wallet } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TokenGuard } from "../../target/types/token_guard";
import { Cluster, clusterApiUrl } from "@solana/web3.js";

export type ExtendedCluster = Cluster | "localnet" | "civicnet";
export const CIVICNET_URL =
  "http://ec2-34-238-243-215.compute-1.amazonaws.com:8899";

export const getClusterUrl = (cluster: ExtendedCluster) => {
  switch (cluster) {
    case "localnet":
      return "http://localhost:8899";
    case "civicnet":
      return CIVICNET_URL;
    default:
      return clusterApiUrl(cluster);
  }
};

const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new anchor.web3.PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

const TOKEN_GUARD_PROGRAM = new anchor.web3.PublicKey(
  "tg7bdEQom2SZT1JB2d77RDJFYaL4eZ2FcM8HZZAg5Z8"
);

export interface TokenGuardState {
  id: anchor.web3.PublicKey;
  outMint: anchor.web3.PublicKey;
  recipient: anchor.web3.PublicKey;
  mintAuthority: anchor.web3.PublicKey;
  gatekeeperNetwork: anchor.web3.PublicKey;
}

export const fetchProgram = async (
  provider: Provider
): Promise<Program<TokenGuard>> => {
  const idl = await anchor.Program.fetchIdl(TOKEN_GUARD_PROGRAM, provider);

  if (!idl) throw new Error("TokenGuard IDL could not be found");

  return new anchor.Program(
    idl,
    TOKEN_GUARD_PROGRAM,
    provider
  ) as Program<TokenGuard>;
};

export const getTokenGuardState = async (
  anchorWallet: Wallet,
  tokenGuardId: anchor.web3.PublicKey,
  connection: anchor.web3.Connection
): Promise<TokenGuardState> => {
  const provider = new anchor.Provider(connection, anchorWallet, {
    preflightCommitment: "recent",
  });

  const program = await fetchProgram(provider);
  const tokenGuardAccountPromise =
    program.account.tokenGuard.fetch(tokenGuardId);
  const mintAuthorityPromise = deriveMintAuthority(tokenGuardId, program);

  const [tokenGuardAccount, [mintAuthority]] = await Promise.all([
    tokenGuardAccountPromise,
    mintAuthorityPromise,
  ]);

  return {
    id: tokenGuardId,
    outMint: tokenGuardAccount.outMint,
    recipient: tokenGuardAccount.recipient,
    mintAuthority,
    gatekeeperNetwork: tokenGuardAccount.gatekeeperNetwork,
  };
};

export const getTokenWallet = async (
  wallet: anchor.web3.PublicKey,
  mint: anchor.web3.PublicKey
) =>
  (
    await anchor.web3.PublicKey.findProgramAddress(
      [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    )
  )[0];

export const deriveMintAuthority = async (
  tokenGuard: anchor.web3.PublicKey,
  program: Program<TokenGuard>
) => {
  return web3.PublicKey.findProgramAddress(
    [Buffer.from("token_guard_out_mint_authority"), tokenGuard.toBuffer()],
    program.programId
  );
};