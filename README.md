# Token Guard 

A composable [gateway](https://docs.civic.com) program for Solana dApps written in
[Anchor](https://github.com/project-serum/anchor)
and using [Civic Pass](https://www.civic.com).

With TokenGuard, dApp developers can protect access to any dApp that
accepts tokens as payment, such as a Metaplex CandyMachine mint,
without requiring any on-chain smart-contract changes.

NOTE: TokenGuard is currently in beta on devnet only and is unaudited.

## Quick Start

```shell
$ yarn global add @civic/token-guard
$ token-guard create --help
```

## How it works

Let's say you want to set up a CandyMachine that mints NFTs at x Sol each,
and you want to restrict purchase only to holders of a valid [Civic Pass](https://www.civic.com).

1. Set up a TokenGuard that exchanges Sol for a new token T,
created by TokenGuard (the mint authority is a PDA owned by TokenGuard),
if the user has a valid Civic Pass.

2. Set up a CandyMachine that accepts token T instead of Sol

3. In your UI, add a TokenGuard exchange instruction to the mint transaction.

Note: the equivalent pattern applies to other protocols. 

![Candy Machine Example](./docs/TokenGuardCandyMachine.png)

## Allowance

TokenGuard has an "allowance" feature, that allows only x purchases per wallet, per token-guard.

For example, if the allowance is set to 1, a user with a valid [Civic Pass](https://www.civic.com)
associated with their wallet can make one purchase only.

They cannot use a second wallet, unless that wallet also has a Civic Pass associated with it. Civic Passes
are non-transferable.

Set up an allowance with the `--allowance` flag.

## Membership Tokens

TokenGuard has a feature that allows you to set a membership token requirement. 

Only users in possession of a membership token (and a Civic Pass) may exchange.

Membership tokens are not consumed by the TokenGuard. They come in two forms:

1. SPL Token

If the membership token is an SPL token mint, then the user must present a token account
for that mint with a balance of at least one token.

2. NFT

If the membership token is an NFT, then the user must present a token account containing an
NFT in the same collection, according to the
[Metaplex Token Metadata](https://github.com/metaplex-foundation/metaplex/tree/master/rust/token-metadata)
program.

As there is no current standard for defining a collection, the token-guard creator must
define the collection strategy at creation-time.

a) UpdateAuthority: The NFT collection is defined by updateAuthority in the metadata (default)
b) Creator: The NFT collection is defined by the first creator in the metadata

### Use-once NFTs

The membership-token feature can be combined with the allowance feature, to, for example,
allow each user to exchange once.

For example, if you have community where each user has an NFT, and you want to send a gift to
each member of the community, you can set up a tokenguard as follows:

- membership token = NFT (either strategy)
- allowance = 1

This will allow each NFT holder to call the guarded smart contract only once.

Note - when used in conjunction with membership tokens, the allowance feature uses the membership
token account as the unique identifier. If a user has two token accounts (i.e. two NFTs), they
can make two calls.

### Examples

To create tokenGuards using membership tokens:

```shell
# SPL Example
token-guard create --membershipToken <SPL_TOKEN_MINT>

# NFT example with update-authority check
token-guard create --membershipToken <NFT_UPDATE_AUTHORITY>

# NFT example with creator check
token-guard create --membershipToken <NFT_CREATOR> --strategy NFT-Creator

# NFT example with creator check and allowance
token-guard create --membershipToken <NFT_CREATOR> --strategy NFT-Creator --allowance 1
```

## Coming Soon

[ ] Support for SPL Token (accept SPL instead of Sol)

[x] Support for membership tokens (non-consumed tokens)

[ ] Mainnet deployment

[ ] Audit

## Usage

Example: CandyMachine using the dummy Civic Pass:
"tgnuXXNMDLK8dy7Xm1TdeGyc95MDym4bvAQCwcW21Bf"

Get the real civic pass address from https://docs.civic.com

## 1. Create a TokenGuard

```shell
$ yarn global add @civic/token-guard
$ token-guard create
TokenGuard created 

ID: FeHQD2mEHScoznRZQHFGTtTZALfPpDLCx8Pg4HyDYVwy
Mint: 6zV7KfgzuNHTEm922juUSFwGJ472Kx6w8J7Gf6kAYuzh
```

## 2. Add a Token Account for the mint

(TODO include this in the TG initialisation step?)

```shell
spl-token -u devnet create-account 6zV7KfgzuNHTEm922juUSFwGJ472Kx6w8J7Gf6kAYuzh
```

## 3. Create the CandyMachine

Check out the [metaplex](https://github.com/metaplex-foundation/metaplex) repository
and follow the steps to install the metaplex CLI.

See [Candy Machine Overview](https://docs.metaplex.com/overviews/candy_machine_overview) for details

```shell
# Find the token account created in step 2
MINT=6zV7KfgzuNHTEm922juUSFwGJ472Kx6w8J7Gf6kAYuzh
TOKEN_ACCOUNT=$(spl-token -u devnet address --token ${MINT} -v --output json | jq '.associatedTokenAddress' | tr -d '"')

# Upload the assets
metaplex upload assets -k ${HOME}/.config/solana/id.json -c devnet
# Create the candy machine instance, referencing the token account
metaplex create_candy_machine -k ${HOME}/.config/solana/id.json -c devnet -t ${MINT} -p 1 -a ${TOKEN_ACCOUNT}
# Set the start date
metaplex update_candy_machine -d now -k ${HOME}/.config/solana/id.json -c devnet
```

### 4. Set up the UI

You need to make two changes to a traditional CandyMachine UI:

#### 4a. Discover a user's Gateway Tokens

Your UI must lookup a wallet's gateway token. For more details on gateway tokens,
see the [Civic Pass documentation](https://docs.civic.com).

Quickstart:

```js
import {findGatewayToken} from "@identity.com/solana-gateway-ts";

const gatekeeperNetwork = new PublicKey("tgnuXXNMDLK8dy7Xm1TdeGyc95MDym4bvAQCwcW21Bf");
const foundToken = await findGatewayToken(connection, wallet.publicKey, gatekeeperNetwork);
```

If you want to integrate Civic's KYC flow into your UI, you can use
Civic's [react component](https://www.npmjs.com/package/@civic/solana-gateway-react).

More details [here](https://docs.civic.com/civic-pass/ui-integration-react-component)

#### 4b. Add the TokenGuard instructions to the mint transaction

```js
import * as TokenGuard from "@civic/token-guard";

const tokenGuard = new PublicKey("<ID from step 1>")
const program = await TokenGuard.fetchProgram(provider)
const tokenGuardInstructions = await TokenGuard.exchange(
    connection,
    program,
    tokenGuard,
    payer,
    payer,
    gatekeeperNetwork,
    amount
  );

await program.rpc.mintNft({
  accounts: {
    // ... candymachine accounts
  },
  remainingAccounts: remainingAccounts,
  signers: [mint],
  instructions: [
    ...(tokenGuardInstructions),  // ADD THIS LINE
  //...other candymachine instructions,
  ],
});
```

## Development

To get set up:

```shell
cargo install anchor
yarn
```

### Build and deploy the program from scratch

```shell
$ anchor build
$ anchor deploy
$ anchor idl init
```

### Testing the cli locally

You can test the CLI against a local network without having to use devnet etc.

In one shell:
```shell
anchor localnet
yarn id:deploy-local
```

In another shell:

```
./bin/run create
```

## FAQ

#### Q: How does this protect against bots? Couldn't I just execute exchange up-front to mint loads of T and then share them with bot accounts?

Four factors mitigate against that:
- The TokenGuard will mint only x token T per tx
- The TokenGuard will only mint tokens to an ephemeral token account (one with zero lamports, that will be garbage-collected after the transaction)
- The TokenGuard will only mint tokens after a specific go-live date
- (Not yet implemented) The TokenGuard would possibly only mint tokens if the tx also contains a specific instruction (e.g. a candymachine mint instruction)

#### Q: Why not just add the gateway token check inside the smart contract being guarded (e.g. Candy Machine)?

Both are good options. In fact, if you prefer that model, we have forks for
Metaplex [CandyMachine](https://github.com/civicteam/metaplex/pull/5) 
and [Auction contract](https://github.com/civicteam/metaplex/pull/1) that do that.

This option is potentially more flexible, as it can protect any kind of similar on-chain protocol,
without requiring each protocol to change to validate gateway tokens.

#### Q: What about if my protocol accepts an SPL Token instead of Sol?

TokenGuard support for SPL Token is in the roadmap.

#### Q: It looks like TokenGuard is now paying into the Treasury, not my smart contract? What happens if something goes wrong and the buyer has paid the Sol but the smart contract instruction fails?

This is where the beauty of the atomic Solana transaction model comes in.
If the TokenGuard exchange and smart contract instructions are in the same transaction,
and one fails, the whole thing is rolled back and the buyer does not lose Sol.
