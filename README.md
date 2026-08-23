# Intent Guard

Intent Guard asks one narrow governance question: **do the bytes a proposal will execute stay within the authority its published text describes?** It raises public, contestable objections; it never decides for a DAO. A timelock guard may honour a veto flag, and a fresh governance vote can clear it on-chain.

## Why It Exists

Token holders usually vote on prose while execution happens through ABI-encoded calls. Multisigs, delegates and forum reviewers may decode those calls manually, but there is no durable mechanism proving that the executable action set matches the mandate voters saw.

Intent Guard retrieves both halves from authoritative sources during GenLayer consensus. It records aligned, divergent, underspecified and undecodable outcomes, with decoded actions, digests, rationale, bonds, rebuttals and governance overrides.

## What GenLayer Does

- Reads the Governor's `ProposalCreated` event from Ethereum mainnet.
- Retrieves `getActions(uint256)` through independent JSON-RPC sources.
- Canonicalises and corroborates the action sets before inference.
- ABI-decodes calls and verifies selector names by recomputing keccak.
- Compares the published mandate with the decoded, corroborated action set inside consensus.
- Stores the review, objection, rebuttal and bond lifecycle on-chain.

## Contract

Live app: **https://intent-guard-genlayer.vercel.app**, wired to the StudioNet contract below, so it reads the same reviews recorded here. There is no backend: no API route, database, indexer, worker or cron. Reads and writes go from the browser straight to the GenLayer RPC, and every time transition is a button anyone can press.

StudioNet contract: `0x2DB60126A464f527289ADa029126DaEFb80Bf725`  
Deployment transaction: `0xc6170a11b116bbe8f2cfce1e8512ceb3966ef466d77d53130d70affb16e45653`

The frontend switches entirely to live state when the deployed address and live data mode are configured. Deployed-source equality is proven, not assumed: the source was retrieved from StudioNet with `genlayer code 0x2DB60126A464f527289ADa029126DaEFb80Bf725` and compared byte-for-byte against `contracts/IntentGuard.py`, which is 205,762 bytes and SHA-256 `1e9c0ac3e3d8c7d4f49dd0a830224c5d4e8c9a55390b0173945366ee3f18be1a` on both sides. Retrieved 2026-08-23. Two earlier deployments were superseded and are listed as historical in [`DEPLOYMENT.json`](./DEPLOYMENT.json); their transactions prove their own behaviour and nothing about this one.

### Proven on StudioNet

Four bonded reviews across two real Governors, plus two funded rejections. Full hashes, every stored field, and every balance reading: [`evidence/studionet.json`](./evidence/studionet.json) and [`docs/SUBMISSION.md`](./docs/SUBMISSION.md).

#### `IG-PROOF-3`: Compound Governor Bravo, proposal `294`, creation block `20422880`

| Step | Transaction | Result |
| --- | --- | --- |
| `request_review` (payable, 0.001 GEN bond) | `0x89480d17d1a80415525bd221f8a21f1ea29cd4d7ede6afae2bfbcde139f6d45b` | FINALIZED + GenVM `SUCCESS`; `value_credited: true`; returned `IG-PROOF-3`; votes `AGREE, AGREE, IDLE, IDLE, AGREE` |
| `review` (consensus) | `0x1f451833f428d138143f2dce894cc36f1ceea72d4ab92cff8e97c99ee5796fc4` | FINALIZED + GenVM `SUCCESS`; 4 validators, 2 SUCCESS and 2 non-fatal ERROR; votes `AGREE, IDLE, AGREE, IDLE, AGREE` |

Mandate `[Gauntlet] Rewards Contract Top-Up for Arb and IR Recs for USDT Mainnet and USDC Arbitrum Comets`, digest `0x818bc02e35bfc9d8b08aea728b8b8c0e40b34988958ed8db2bb4b8774c403041`; actions digest `0x7f6b86925bb79dedb5e8d0cf28bfe1a8469620f61b7aff35c55232e06f55753c`. Stored result `UNDERSPECIFIED` with `action_count: 8`, `nondet_ops: 4`, `divergence_kind: NONE`, `veto_flag: false`, `bond_settled: true`.

This proposal is here because it caught a real defect. Compound builds each action as a function *name* in `signatures[i]` with the arguments alone in `calldatas[i]`, and the Timelock hashes that name at execution time. An earlier deployment read the first four bytes of `calldatas[i]` as the selector, which on a leading `address` argument is `0x00000000`, so it reported all eight of these actions as unnameable and `UNDERSPECIFIED` was the only verdict it could reach. On this deployment `get_actions` names all eight: the four interest-rate setters, `deployAndUpgradeTo`, `_grantComp`, `approve` and `outboundTransferCustomRefund`. The round then matched the mandate's own figures against the decoded arguments, 0.05 / 4 / 0.052 / 3.6 on the rate slopes and 13,000 COMP on the top-up, and still declined to certify, because action #7's nested bridge payload cannot be named and the mandate's claim is about what arrives on Arbitrum. Same proposal, same rules, a real analysis instead of a blanket refusal.

#### `IG-PROOF-4`: Uniswap Governor Bravo, proposal `100`, creation block `25554834`

| Step | Transaction | Result |
| --- | --- | --- |
| `request_review` (payable, 0.001 GEN bond) | `0x633f4b950fe322cc46547dd5b218afa30796377826096d7a920fba995f5aeae8` | FINALIZED + GenVM `SUCCESS`; `value_credited: true`; returned `IG-PROOF-4`; votes `AGREE, AGREE, IDLE, IDLE, AGREE` |
| `review` (consensus) | `0xdbc5ad34bff012b001469f710910413b17cba236d19f42bea1d4038de5408a04` | FINALIZED + GenVM `SUCCESS`; votes `IDLE, AGREE, AGREE, AGREE, DISAGREE` |

Mandate `Activate v4 Protocol Fees (Part 1/2)`, digest `0x4fc50677e537180b70ead45b970ce8174b5b8a6d9ce96a3d22605c8ae57d5562`; actions digest `0xab80c88729455dddc3e343fb10194a2440224d1241d5fab7ce7b002c6abc8853`. Stored result `UNDERSPECIFIED` with `action_count: 7`, `nondet_ops: 10`, `bond_settled: true`. Uniswap uses Bravo's unnamed-action shape, so this round exercised the 4-byte-and-keccak naming path rather than the Governor-declared one; both shapes are therefore proven on the same deployment. Action #0 matches `setProtocolFeeController(address)` directly, #1 and #6 relay that same call, and #2/#3/#4/#5 carry cargo the round could not examine. One `DISAGREE` is recorded as it occurred: these validators fetch mainnet calldata independently and decode it under inference, so a unanimous round would be the surprising result.

#### Invalid funded calls cannot strand value

| Call | Transaction | Result |
| --- | --- | --- |
| `request_review` with an unsupported Governor, 0.001 GEN attached | `0xf9d5617ba5d030b549a779b5c3225cf85e7960b5ddb0d7d934bc5ba72f44d69c` | FINALIZED + GenVM `SUCCESS`, returning `[REJECTED] Unsupported Governor 0x1111…` |
| `rebut` against a review that carries no veto, 0.001 GEN attached | `0xf29b0c64e3275ca20d91118c128458570a400ff74c9d93698d7ee7270b18b671` | FINALIZED + GenVM `SUCCESS`, returning `[REJECTED] Review IG-PROOF-3 is UNDERSPECIFIED and carries no veto; there is nothing to rebut` |

Both failed after entry, with the value already credited to the contract. Neither created a record: `get_review("IG-REJECT-1")` and `get_rebuttal("IG-REBUT-1")` both read empty, `IG-PROOF-3` still reads `rebuttal_id: ""` and `contested: false`, and `stats` still reads `reviews: 2, rebuttals: 0`. The contract balance was `0` before both and `0` after both, and the caller's balance was `168747000000000000000` wei before both and `168747000000000000000` wei after both. StudioNet does not roll a transfer back when GenVM reverts, so a rejection here is a successful execution that refunds and returns a reason, not a failed transaction.

`stats` reads `reviews: 2` and `balance: 0` after all six transactions, so both bonds were genuinely returned and neither rejection kept anything. The invariant `balance = open review bonds + open rebuttal bonds + bounty pool` holds with every term at zero. The refunds apply to the ledger asynchronously, so every balance-after figure above was read once settlement had applied, roughly twenty seconds after the receipt became readable; both readings are in the evidence file rather than only the convenient one.

The veto, rebuttal-acceptance, override and bounty-payout branches are **NOT PROVEN LIVE**. Reaching a veto needs a live mainnet proposal whose calls contradict its own published text. Four real proposals have gone through the full path and none diverged; twenty-three further Compound proposals were screened by action shape and five read in depth, and in every one the mandate matched its actions. No `DIVERGENT` verdict was forced out of any of them. Those branches are proven deterministically in `tests/direct/test_lifecycle.py` and `tests/direct/test_named_actions.py` instead.

### Main methods

| Method | Type | Purpose |
| --- | --- | --- |
| `request_review(id, governor, proposal_id, creation_block)` | payable write | Creates a bonded review record. |
| `review(id)` / `rereview(id)` | consensus write | Fetches, decodes and compares the proposal. |
| `rebut(id, review_id, argument_url)` | payable write | Opens a symmetric bonded reply. |
| `adjudicate_rebuttal(id)` | consensus write | Re-evaluates the stated divergence against the reply. |
| `expire_rebuttal_window(id)` | write | Permissionlessly advances an expired review or rebuttal. |
| `clear_veto_by_vote(id, vote_ref)` | write | Records the constitutional governance override. |
| `is_vetoed(governor, proposal_id)` | view | Structured integration answer for an executor or timelock guard. |
| `decoder_fingerprint()` / self-test views | view | Publicly inspect the embedded deterministic primitives. |

## App Flow

1. Browse the ledger and inspect the facing-page mandate/calldata apparatus.
2. Connect a wallet and request a review with a supported Governor, proposal id, creation block and GEN bond.
3. Any wallet runs the permissionless review round and follows its real transaction lifecycle.
4. If a divergence is recorded, the proposer may file a rebuttal with an equal bond.
5. Anyone may adjudicate or expire the window. A fresh governance vote may clear a standing veto.
6. Integrators query `/guard` or call `is_vetoed` directly before execution.

## Signing

**Wallet mode: injected only.** Every write is signed by `window.ethereum` in the reader's own browser. This app holds no signer of its own: it never generates a private key, never stores one, never offers a browser-wallet mode, and never falls back to a local signer if no extension is present. Reading the ledger needs no wallet at all.

Previous experimental builds stored a generated StudioNet key locally. Current versions support injected wallets only. Legacy generated-wallet material is deleted on migration and is never used. The purge runs once when [`wallet-provider.tsx`](./src/components/wallet-provider.tsx) mounts, calling `purgeLegacyGeneratedKey()` in [`storage.ts`](./src/lib/storage.ts), which only ever removes those two keys. There is no recovery path for a key from those builds, and that is intentional.

The one account this app constructs is the ephemeral read account in [`read-client.ts`](./src/lib/genlayer/read-client.ts). `genlayer-js` requires a client to carry an account even for a view call, so that account exists in memory for the length of a read. It is never written to storage, never shown, never funded, and never used to sign anything.

The wallet's own network is what the masthead prints, not the network this build targets. If the wallet reports a different chain, the plate says so, offers to switch, and writes stay closed until it is on the expected chain. A wallet that has not answered `eth_chainId` is treated as unconfirmed and also cannot sign, because a transaction sent to the wrong chain is worse than one not sent. `tests/wallet-session.test.mjs` covers all five events: account changed, account removed, chain changed, provider disconnected, and a refused connection request.

## Environment

Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_GENLAYER_CHAIN=studionet
NEXT_PUBLIC_GENLAYER_ENDPOINT=https://studio.genlayer.com/api
NEXT_PUBLIC_INTENT_GUARD_CONTRACT=0x2DB60126A464f527289ADa029126DaEFb80Bf725
NEXT_PUBLIC_INTENT_GUARD_DATA=live
```

Set the address and change the data mode to `live` after deployment.

## Local Development

The hosted build at **https://intent-guard-genlayer.vercel.app** already runs against the deployed contract. To run it locally:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run test:direct
npm run verify:decoder
npm run verify:deployment
npm run verify:schema   # requires a deployed address
```

The repository includes production-module transaction/read regressions, direct state-machine tests, and a decoder corpus that executes the deterministic decoder embedded in `contracts/IntentGuard.py`. The decoder suite binds itself to `decoder_fingerprint()` so a changed embedded primitive fails review rather than drifting silently. `python -m pytest tests/direct -q` runs 67 tests, including the ones that drive the veto, rebuttal, override and settlement branches the StudioNet proofs could not reach, and the ten in `tests/direct/test_named_actions.py` that pin the Governor-declared action shape whose mishandling forced the 2026-08-23 redeployment. The deployed contract's `keccak_self_test` and `decoder_self_test` both returned `ok: true`; schema verification exposed all 20 public methods.

`scripts/exercise-studionet.mjs` re-verifies a funded request/review walk from its transaction hashes and refuses to continue unless each finalized write contains explicit GenVM `SUCCESS`. It reads through `genlayer-js`, the same library and encoding path the browser uses, so a pass is a statement about the frontend's own route and not only about the CLI's:

```bash
node scripts/exercise-studionet.mjs IG-PROOF-3 \
  0x89480d17d1a80415525bd221f8a21f1ea29cd4d7ede6afae2bfbcde139f6d45b \
  0x1f451833f428d138143f2dce894cc36f1ceea72d4ab92cff8e97c99ee5796fc4
```

```bash
node scripts/exercise-studionet.mjs IG-PROOF-4 \
  0x633f4b950fe322cc46547dd5b218afa30796377826096d7a920fba995f5aeae8 \
  0xdbc5ad34bff012b001469f710910413b17cba236d19f42bea1d4038de5408a04
```

Both exit 0 as of 2026-08-23, but only after three real defects in the script itself were fixed on 2026-08-22, and the honest version of that sentence is that this check had never actually passed before. Its FINALIZED assertion read `tx.status_name`, a field the RPC never sends; it fell through to the raw `status`, which is a numeric enum ordinal, so the comparison was `7 !== "FINALIZED"` and could never succeed. Its `is_vetoed` read used a hardcoded governor/proposal pair, so for any id but the first it would have reported a different proposal's veto state; both are now derived from the review the script just read. Third, it took the contract address from `process.env` without loading `.env.local`, unlike its sibling `scripts/verify-schema.mjs`, so the two commands exactly as printed above aborted on a missing environment variable before reaching the network, and only worked for a shell that had exported one by hand. It now uses the same loader the sibling script already had. None of the three was a defect in the contract and no contract change was made. `verify:studionet` is not part of the `npm run verify` chain, which is why CI never surfaced them; that is recorded rather than quietly corrected.

`npm audit` and `npm audit --omit=dev` both report 0 vulnerabilities. Three high-severity transitive findings surfaced earlier through `next 16.2.12` and were resolved by an explicit reviewed `next@16.3.2` upgrade rather than `npm audit fix --force`; the full determination is in [`docs/SUBMISSION.md`](./docs/SUBMISSION.md#dependency-audit). `eslint-config-next` was left behind at `16.2.12` by that upgrade and has since been pinned to `16.3.2`, so the lint config and the framework it lints for are the same release.

Two things enter the CI runner from outside the lockfile, and both are pinned by digest rather than by name. Every third-party action in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) is referenced by full commit SHA with the release in a trailing comment, because `@v4` is a movable ref that would let an action's owner change what runs here with no diff in this repository. The GenVM SDK archive the direct tests need is fetched from a GitHub release, so the job checks it against a known SHA-256 before gltest unpacks it:

```bash
echo "4f0b358ec98ec148be9b95cdfb0f0e1a6cbe64da0194fdfac3fffc6f5d1d93e2  genvm-universal-v0.2.16.tar.xz" | sha256sum -c -
```

That value is the digest GitHub's release API reports for the asset, and it matches the 216,630,904-byte copy the local runs use. The check runs under `set -euo pipefail`, so a substituted archive fails the job instead of quietly changing which SDK `test:direct` executes against.

The repository was also swept for the token classes that hide a leaked secret, an unfinished thought or a stale on-chain claim: TODO and FIXME markers, `localhost`, key and keystore material, mocks and fixtures, superseded contract addresses and old deployment hashes. Every match is classified in [`docs/HYGIENE.md`](./docs/HYGIENE.md), including the ones that are legitimate and why.

A network transaction may be accepted and finalized while its GenVM execution rolls back. Intent Guard therefore treats consensus status and contract execution as separate facts; missing, malformed, `ERROR`, or `ROLLBACK` execution data never becomes application success. That is not theoretical here: the same `request_review` submitted through the unpatched CLI reached `ACCEPTED` with a reverted execution and left `stats.reviews` at `0`.

## Honest Limits

- Intent Guard checks correspondence, not whether a proposal is good policy or its target contracts are safe.
- Unsupported Governor implementations are refused rather than decoded heuristically.
- Explorer disagreement, unverified selectors and payloads beyond the declared nesting limit produce `UNDECODABLE`, never an inferred verdict.
- A veto is advisory. The contract cannot halt governance by itself, and token holders can override it.
- Live web sources can fail or drift. Refusals are visible in the same ledger as findings.
- Deployed-source equality is proven for the current deployment. It is a claim about the contract *source* retrieved from StudioNet, not an independent audit of validator bytecode.
- The bonded StudioNet lifecycle is proven twice, but both times along the `UNDERSPECIFIED` path. No veto exists on-chain, so the rebuttal and governance-override branches are proven in-repo and remain unproven on StudioNet. The two are not conflated anywhere in this repository.
- The three-way corroboration digest establishes agreement on the shape of each call (target, value, selector, signature) and deliberately not on decoded arguments, which would make a slow 4byte lookup look like explorer disagreement. The argument bytes that get judged come from the Governor's own emitted event.
- The deployed frontend was not driven by a headless browser. Every route on **https://intent-guard-genlayer.vercel.app** was confirmed to answer 200 unauthenticated with the contract address in the served HTML, and the data path behind it was verified directly (the CORS preflight from that origin, and the same `genlayer-js` reads the browser makes, run against the live contract), but no script clicked through the UI.

## Design

The interface is a facing-page scholarly apparatus: warm paper for the human mandate, cool paper for calldata, and citation threads between them. It is intentionally distinct from a generic Web3 dashboard and includes explicit fixture/live provenance on every page.

## License

Apache License 2.0. The full text is in [`LICENSE`](./LICENSE), and the copyright and third-party attribution are in [`NOTICE`](./NOTICE). The mandate texts, proposal descriptions and calldata quoted in the fixtures and evidence files are public on-chain and governance-forum records, reproduced verbatim as evidence.
