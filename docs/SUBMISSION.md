# Intent Guard: Reviewer Evidence

**Live app:** https://intent-guard-genlayer.vercel.app · **StudioNet contract:** `0x2DB60126A464f527289ADa029126DaEFb80Bf725`

Intent Guard records whether a Governor proposal's corroborated executable actions stay within its published mandate. Deterministic gates establish bytes, selectors, bounds, and digests; GenLayer consensus compares those bounded facts to natural-language authority. Free-form rationale is explanatory and excluded from equivalence.

There is no backend: no API route, server action, database, indexer, worker or cron. Reads and writes go from the browser straight to the GenLayer RPC, and every time transition is a button any address can press.

Every hash below is full and unabbreviated. Every stored value was read back from the deployed contract, not transcribed from a console. The machine-readable form is [`evidence/studionet.json`](../evidence/studionet.json).

The contract was redeployed on 2026-08-23 to fix a real decoding defect found by running a real proposal. Everything in this document is proof about `0x2DB60126A464f527289ADa029126DaEFb80Bf725`. Transactions against the two superseded deployments are kept in [`DEPLOYMENT.json`](../DEPLOYMENT.json) and in the evidence file under `historicalDeployments`, and they prove the behaviour of those contracts only. They are not offered as proof of this one.

## Release evidence

| Item | Status | Evidence |
| --- | --- | --- |
| Contract deployed | PASS | `0x2DB60126A464f527289ADa029126DaEFb80Bf725` |
| Deployment transaction | PASS | `0xc6170a11b116bbe8f2cfce1e8512ceb3966ef466d77d53130d70affb16e45653`: FINALIZED, leader executions `SUCCESS, SUCCESS`, votes `IDLE, AGREE, AGREE, IDLE, AGREE`, submitted `2026-08-23T00:35:30.118823Z`. |
| Local source binding | PASS | `DEPLOYMENT.json`; SHA-256 `1e9c0ac3e3d8c7d4f49dd0a830224c5d4e8c9a55390b0173945366ee3f18be1a`, 205,762 bytes, byte-identical to `contracts/IntentGuard.py` at commit `ac39b40206d990d4cf8b6bc1fb34dd4f2dfce161`. That commit records the working tree the deployment was made from, so it is minutes younger than the transaction; parity is the claim, not chronology. |
| Deployed-source equality | PASS | `genlayer code 0x2DB60126A464f527289ADa029126DaEFb80Bf725` retrieved 2026-08-23 and compared byte-for-byte against `contracts/IntentGuard.py`: 205,762 bytes both sides, SHA-256 equal, no normalisation applied to either side. Proven, not assumed. |
| Contract source changed since previous deployment | YES | The selector defect below. The old deployment's transactions are not used as proof of this one. |
| Schema | PASS | Deployed read exposes all 20 required methods. |
| Contract self-tests | PASS | Deployed reads return `ok: true` for `keccak_self_test` and `decoder_self_test`. |
| Production Node regressions | PASS | `node --test tests/*.test.mjs`: 81/81. |
| Direct contract and decoder tests | PASS | `python -m pytest tests/direct -q`: 67/67, including the ten in `tests/direct/test_named_actions.py` that pin the fixed behaviour. |
| Decoder parity/drift guard | PASS | In-repo corpus executes the embedded decoder and checks `decoder_fingerprint()`. |
| GenVM lint | PASS | `genvm-lint check contracts/IntentGuard.py --json`: no findings. |
| ACCEPTED restoration | PASS | Persisted `ACCEPTED` remains active, resumes polling, and never counts as application success. |
| Live-read failure semantics | PASS | Empty/not-found remain distinct from unavailable/malformed reads across ledger, detail and guard surfaces. |
| Linux CI | PASS | Recorded in [CI and deployment of the exact final HEAD](#ci-and-deployment-of-the-exact-final-head) against the exact commit, since CI runs on every push and any run named inside a file predates the commit that names it. |
| TypeScript | PASS | `tsc --noEmit`. |
| ESLint | PASS | `eslint .`. |
| Production build | PASS | `next build`. |
| Dependency audit | PASS | `npm audit --omit=dev`: 0 vulnerabilities. See [Dependency audit](#dependency-audit). |
| Bonded `request_review` for `IG-PROOF-3` | PASS | `0x89480d17d1a80415525bd221f8a21f1ea29cd4d7ede6afae2bfbcde139f6d45b`: FINALIZED, GenVM `SUCCESS`, `value_credited: true`, 0.001 GEN bond attached, returned `IG-PROOF-3`, votes `AGREE, AGREE, IDLE, IDLE, AGREE`. |
| Consensus `review` for `IG-PROOF-3` | PASS | `0x1f451833f428d138143f2dce894cc36f1ceea72d4ab92cff8e97c99ee5796fc4`: FINALIZED, GenVM `SUCCESS`, 4 validators with 2 SUCCESS and 2 non-fatal ERROR, votes `AGREE, IDLE, AGREE, IDLE, AGREE`. |
| Bonded `request_review` for `IG-PROOF-4` | PASS | `0x633f4b950fe322cc46547dd5b218afa30796377826096d7a920fba995f5aeae8`: FINALIZED, GenVM `SUCCESS`, `value_credited: true`, returned `IG-PROOF-4`, votes `AGREE, AGREE, IDLE, IDLE, AGREE`. |
| Consensus `review` for `IG-PROOF-4` | PASS | `0xdbc5ad34bff012b001469f710910413b17cba236d19f42bea1d4038de5408a04`: FINALIZED, GenVM `SUCCESS`, votes `IDLE, AGREE, AGREE, AGREE, DISAGREE`. The single `DISAGREE` is recorded as it occurred. |
| Selector defect fixed on chain | PASS | `get_actions("IG-PROOF-3")` returns all 8 rows resolved with their real Compound function signatures. On the superseded deployment the same proposal stored 8 rows with selector `0x00000000`, `resolved: false` and an empty signature. |
| Invalid payable call cannot strand value | PASS | Two funded invalid calls, `0xf9d5617ba5d030b549a779b5c3225cf85e7960b5ddb0d7d934bc5ba72f44d69c` and `0xf29b0c64e3275ca20d91118c128458570a400ff74c9d93698d7ee7270b18b671`, each with 0.001 GEN attached and credited. Contract balance `0` before and `0` after both; caller balance `168747000000000000000` wei before and after; no record created by either. See [Invalid funded calls](#invalid-funded-calls-cannot-strand-value). |
| Stored review/actions/veto reads | PASS | `get_review`, `get_actions` (8 rows / 7 rows) and `is_vetoed` all coherent for both ids. Values below. |
| Two Governors, two action shapes | PASS | Compound proposal `294` uses Bravo's named-action shape and Uniswap proposal `100` uses the unnamed shape, so both naming paths are proven on this one deployment. The path is not tuned to one input. |
| Bond settlement | PASS | `bond_settled: true` for both; `stats.reviews` is `2` and `stats.balance` is `0`, so both 0.001 GEN bonds were actually returned rather than merely flagged. A settlement that had silently failed to pay out would have left a balance behind. |
| Frontend read path against live state | PASS | `scripts/exercise-studionet.mjs` exits 0 for both ids, reading through `genlayer-js`, the same library and encoding path the browser uses. Three real defects in that script were fixed on 2026-08-22 to get there; see [Verifier defects found and fixed](#verifier-defects-found-and-fixed). |
| Veto path on StudioNet | NOT PROVEN LIVE | Neither proposal diverged, so no veto was created, and a `DIVERGENT` verdict was not forced out of either. Covered by deterministic tests instead; see [What the on-chain proof does not establish](#what-the-on-chain-proof-does-not-establish). |
| Rebuttal acceptance / override / bounty payout on StudioNet | NOT PROVEN LIVE | Unreachable without a standing veto. Same section. The `rebut` *rejection* path is proven live, above. |
| Live application | PASS | **https://intent-guard-genlayer.vercel.app**: public, no login wall, all routes return 200 unauthenticated, contract address baked into the served HTML, no backend of any kind. |

## Why the contract was redeployed

Governor Bravo has two action shapes. A *named* action puts the function signature in `signatures[i]` and the arguments alone in `calldatas[i]`; the Timelock computes `bytes4(keccak256(signature))` itself at execution time and prepends it. An *unnamed* action leaves `signatures[i]` empty and `calldatas[i]` carries its own selector. Compound uses the named shape. Uniswap uses the unnamed one.

The previous deployment read `calldatas[i][:4]` as the selector unconditionally. For a named action those four bytes are the head of the first ABI word, so for a leading `address` argument they are `0x00000000`, which the resolver short-circuits as unnameable. Every named action therefore reached the model as OPAQUE, and Rule 5 made `UNDERSPECIFIED` the only verdict reachable on any Compound-shaped proposal. The product's central claim, that it names every call a proposal will make, failed on the majority of real Compound proposals.

This was found by running Compound proposal `294` against the previous deployment for real, not by reading the code. That contract stored the rationale *"All eight actions ... are marked as OPAQUE, with the 4-byte selector 0x00000000 being unconfirmed"*, while the Governor's own `getActions` names all eight. The request and review transactions that recorded it are in the evidence file under `historicalDeployments[0].defectEvidence`.

The fix: `_bare_actions` derives a named action's selector from the declared signature, and `_enrich_action` treats the Governor's declaration as authoritative, recording `name_source` as `"governor"` rather than `"selector"` so the model knows which of the two it is looking at. `canonical_digest` is computed from the bare action list, so the enriched-only `name_source` key cannot affect a digest. Regression coverage is [`tests/direct/test_named_actions.py`](../tests/direct/test_named_actions.py), ten tests, one of which drives a full round to a real verdict with the 4byte source answering nothing at all.

`IG-PROOF-3` below is that same proposal on the new deployment.

## The proof rounds

Two funded reviews on the current deployment, against both supported Governors.

### `IG-PROOF-3`: Compound Governor Bravo `0xc0da02939e1441f497fd74f78ce7decb17b66529`, proposal `294`, creation block `20422880`

| Field | Value |
| --- | --- |
| `status` | `UNDERSPECIFIED` |
| `mandate_title` | `[Gauntlet] Rewards Contract Top-Up for Arb and IR Recs for USDT Mainnet and USDC Arbitrum Comets` |
| `mandate_digest` | `0x818bc02e35bfc9d8b08aea728b8b8c0e40b34988958ed8db2bb4b8774c403041` |
| `actions_digest` | `0x7f6b86925bb79dedb5e8d0cf28bfe1a8469620f61b7aff35c55232e06f55753c` |
| `action_count` | `8` |
| `divergence_kind` | `NONE` |
| `veto_flag` | `false` |
| `undecodable_gate` | `""` (no refusal gate fired) |
| `nondet_ops` | `4` |
| `bond` / `bond_settled` | `1000000000000000` wei / `true` |
| `requester` | `0xB5EcD6dDa36B370aca4af5E2005d8E2Ae89c6db2` |
| `reviewed_at` | `2026-08-23T00:50:46.214565Z` |

`get_actions("IG-PROOF-3")` returns 8 rows, every one resolved, with these signatures in order:

```text
setBorrowPerYearInterestRateSlopeLow(address,uint64)
setBorrowPerYearInterestRateSlopeHigh(address,uint64)
setSupplyPerYearInterestRateSlopeLow(address,uint64)
setSupplyPerYearInterestRateSlopeHigh(address,uint64)
deployAndUpgradeTo(address,address)
_grantComp(address,uint256)
approve(address,uint256)
outboundTransferCustomRefund(address,address,address,uint256,uint256,uint256,bytes)
```

That list is the live proof of the fix. On the superseded deployment every one of those eight rows carried selector `0x00000000`, `resolved: false` and an empty signature.

`is_vetoed("0xc0Da02939E1441F497fd74F78cE7Decb17B66529", 294)` returns `reviewed: true`, `vetoed: false`, `status: UNDERSPECIFIED`, `review_id: IG-PROOF-3`, `divergence_kind: NONE`, `note: "The mandate was too vague to authorise or exclude what the calls do."`

### `IG-PROOF-4`: Uniswap Governor Bravo `0x408ed6354d4973f66138c91495f2f2fcbd8724c3`, proposal `100`, creation block `25554834`

| Field | Value |
| --- | --- |
| `status` | `UNDERSPECIFIED` |
| `mandate_title` | `Activate v4 Protocol Fees (Part 1/2)` |
| `mandate_digest` | `0x4fc50677e537180b70ead45b970ce8174b5b8a6d9ce96a3d22605c8ae57d5562` |
| `actions_digest` | `0xab80c88729455dddc3e343fb10194a2440224d1241d5fab7ce7b002c6abc8853` |
| `action_count` | `7` |
| `divergence_kind` | `NONE` |
| `veto_flag` | `false` |
| `undecodable_gate` | `""` (no refusal gate fired) |
| `nondet_ops` | `10` |
| `bond` / `bond_settled` | `1000000000000000` wei / `true` |
| `requester` | `0xB5EcD6dDa36B370aca4af5E2005d8E2Ae89c6db2` |
| `reviewed_at` | `2026-08-23T00:54:21.624442Z` |

`is_vetoed("0x408ED6354d4973f66138C91495F2f2FCbd8724C3", 100)` returns `reviewed: true`, `vetoed: false`, `status: UNDERSPECIFIED`, `review_id: IG-PROOF-4`.

### Why UNDERSPECIFIED, and why that was not forced

Both verdicts were recorded as the rounds produced them.

`IG-PROOF-3` is the more interesting result, because the fix gave the round something to reason about. It matched the mandate's own figures against the decoded arguments: actions #0 to #3 set the four interest-rate slopes on the comet at `0x3afdc9...` to 0.05, 4, 0.052 and 3.6, exactly the values the text lists, and actions #5 to #7 move 13,000 COMP, exactly the top-up the text authorises. It still declined to certify, because action #7's `outboundTransferCustomRefund` carries a nested payload whose own function cannot be named, and the mandate's claim is about what arrives on Arbitrum. Under Rule 5 an opaque call blocks `ALIGNED` without being evidence of divergence, so the verdict is `UNDERSPECIFIED`.

The contrast with the superseded deployment is the whole point. There the stored rationale was a blanket refusal: all eight actions opaque, nothing examined. Here the rationale reasons about named functions and their actual argument values and lands on `UNDERSPECIFIED` for one specific nested payload. Same proposal, same rules, real analysis instead of a blanket refusal.

`IG-PROOF-4` went through the other naming path. Action #0 matches `setProtocolFeeController(address)` directly, actions #1 and #6 are `createRetryableTicket` relays carrying that same nested call, actions #2, #4 and #5 wrap cargo the round could not examine, and action #3's selector `0x76ef8453` could not be confirmed. The mandate's claim is about what those relays set on remote PoolManagers, so opaque cargo blocks `ALIGNED` without proving divergence.

A reviewer optimising to look decisive would have called either of these `ALIGNED`, because the targets and top-level functions do match. The contract's own rule is that when the only thing between a proposal and `ALIGNED` is a call nobody can read, the answer is `UNDERSPECIFIED`. In both rounds it declined both available shortcuts: it did not clear the proposal and it did not veto it. The rationale is stored on chain, which makes that decision auditable rather than asserted.

Verify independently:

```bash
genlayer call 0x2DB60126A464f527289ADa029126DaEFb80Bf725 get_review --args IG-PROOF-3
```

```bash
genlayer call 0x2DB60126A464f527289ADa029126DaEFb80Bf725 get_review --args IG-PROOF-4
```

### Invalid funded calls cannot strand value

StudioNet does not roll `gl.message.value` back when a GenVM execution reverts. A payable method therefore cannot rely on a revert to protect its caller: the value has already arrived. Both payable methods validate first and, on any user-input failure, refund the sender and return a `[REJECTED]` reason. The on-chain shape of a rejection is consequently FINALIZED with GenVM `SUCCESS` and a return value beginning `[REJECTED]`, not a failed transaction.

| Call | Transaction | Value sent | Final status | GenVM | Returned |
| --- | --- | --- | --- | --- | --- |
| `request_review("IG-REJECT-1", "0x1111111111111111111111111111111111111111", 1, 1)` | `0xf9d5617ba5d030b549a779b5c3225cf85e7960b5ddb0d7d934bc5ba72f44d69c` | `1000000000000000` wei, credited | FINALIZED | `SUCCESS` | `[REJECTED] Unsupported Governor 0x1111111111111111111111111111111111111111. This contract only reviews Governors whose event topic and getActions ABI it has verified: ['0x408ed6354d4973f66138c91495f2f2fcbd8724c3', '0xc0da02939e1441f497fd74f78ce7decb17b66529']` |
| `rebut("IG-REBUT-1", "IG-PROOF-3", "https://www.comp.xyz/t/proposal-294-rebuttal")` | `0xf29b0c64e3275ca20d91118c128458570a400ff74c9d93698d7ee7270b18b671` | `1000000000000000` wei, credited | FINALIZED | `SUCCESS` | `[REJECTED] Review IG-PROOF-3 is UNDERSPECIFIED and carries no veto; there is nothing to rebut` |

Both failures are reached after entry, with the value already credited to the contract, which is exactly the case where value could be stranded.

| Reading | Before both | After both |
| --- | --- | --- |
| Contract balance (`eth_getBalance`) | `0` wei | `0` wei |
| Caller balance (`eth_getBalance`) | `168747000000000000000` wei | `168747000000000000000` wei |
| `stats()` | `reviews: 2, rebuttals: 0, active_vetoes: 0, bounty_pool: 0, balance: 0` | `reviews: 2, rebuttals: 0, active_vetoes: 0, bounty_pool: 0, balance: 0` |

Neither call created state: `get_review("IG-REJECT-1")` returns `{}`, `get_rebuttal("IG-REBUT-1")` returns `{}`, and `IG-PROOF-3` still reads `rebuttal_id: ""` and `contested: false`. **Value stranded: NO.**

One honest detail about method. `_pay` emits an outbound transfer and StudioNet applies it to the ledger asynchronously, roughly twenty seconds behind the receipt becoming readable, so an `eth_getBalance` taken the instant a receipt appears can still show the value sitting in the contract. Every after-figure above was taken once settlement had applied. Both readings, the pre-settlement one and the settled one, are in the evidence file rather than only the convenient one.

### Control: consensus status is not application success

The same `request_review` submitted through the unpatched `genlayer write` reached consensus status `ACCEPTED` while its GenVM execution reverted, and `stats.reviews` stayed `0`. `genlayer write` hardcodes `value: 0n`, so no bond arrived and the contract correctly refused the call. It is recorded here because it is the cleanest demonstration available that a finalized-looking transaction can carry a reverted execution.

### Verifier defects found and fixed

Re-running `scripts/exercise-studionet.mjs` on 2026-08-22 surfaced three genuine defects in the verifier itself. All three are recorded because the honest consequence is that this check had never actually passed before.

1. The FINALIZED assertion read `tx.status_name`, a field the RPC never sends. `genlayer-js` decorates the snake_case RPC payload with a camelCase `statusName`; the raw `status` beside it is a numeric enum ordinal, where `7` is FINALIZED. The check therefore fell through to the ordinal and compared `7` against the string `"FINALIZED"`, which can never match. It now reads `statusName` and refuses a non-string status outright rather than stringifying the ordinal into a mismatch.
2. The `is_vetoed` read passed a hardcoded governor/proposal pair, so for any review id but the first it would have silently reported a different proposal's veto state. It now derives the pair from the review it just read, as `[review.governor, BigInt(review.proposal_id)]`, with the non-`PENDING` guard moved above the veto read so a missing review produces a clear error instead of a property access on null.
3. The script read `NEXT_PUBLIC_INTENT_GUARD_CONTRACT` straight from `process.env` with no `.env.local` loader, while its sibling `scripts/verify-schema.mjs` in the same directory already had one. The commands printed in this document and in the README therefore threw `NEXT_PUBLIC_INTENT_GUARD_CONTRACT is not set` and exited 1 before opening a socket; they only worked in a shell that had exported the address by hand. The sibling's ten-line loader was copied in verbatim rather than introducing a dependency, and both commands now exit 0 exactly as written. Recourse's `scripts/exercise-studionet.mjs` had the identical gap against its own `NEXT_PUBLIC_RECOURSE_CONTRACT` and was fixed the same way.

None of the three was a defect in the contract, and no contract change was made for them. `verify:studionet` is not part of the `npm run verify` chain, which is why CI never surfaced them; that gap is stated rather than quietly closed.

## What the on-chain proof does not establish

The proofs above cover `PENDING → UNDERSPECIFIED` with real bonds and real validators, twice, on two Governors with two different action shapes, plus both payable rejection paths. They do not cover the veto path, and this document does not claim otherwise.

These branches are **NOT PROVEN LIVE**:

| Branch | Why not | Where it is proven instead |
| --- | --- | --- |
| Veto creation | Needs a live mainnet proposal whose executable calls genuinely contradict its own published text. Four real proposals have gone the full path and none diverged. Twenty-three further Compound proposals were screened by action shape and five read in depth; in every one the mandate matched its actions. No `DIVERGENT` verdict was forced out of any of them. | `tests/direct/test_lifecycle.py` |
| Rebuttal acceptance and adjudication | Unreachable without a standing veto. The `rebut` rejection path *is* proven live, above. | `tests/direct/test_lifecycle.py` |
| Governance override (`clear_veto_by_vote`) | Unreachable without a standing veto. | `tests/direct/test_lifecycle.py` |
| Bounty payout | Requires an upheld veto. | `tests/direct/test_lifecycle.py` |

The contract cannot invent a divergent proposal, and fabricating a fake Governor to produce a veto for a submission would make the evidence worthless. So those branches are driven deterministically in [`tests/direct/test_lifecycle.py`](../tests/direct/test_lifecycle.py), covering:

- veto creation from a `DIVERGENT` round, with the bond deliberately left at risk;
- the rebuttal deadline landing exactly one window after the review;
- all three arithmetic overrides that refuse to veto: missing `divergence_kind`, out-of-range `diverging_index`, and an `OPAQUE_NESTED` finding against an action whose selector never resolved;
- the downgrade of `ALIGNED` when a selector never resolved;
- the `rebut` guards: no live veto, exact bond equality, one rebuttal per review, `http(s)` argument URL;
- all three rebuttal dispositions (`UPHELD`, `WITHDRAWN_VETO`, `UNCLEAR`), asserted on which stake moves and when;
- both `expire_rebuttal_window` branches, including a rebuttal that lapses unread;
- settlement latching, so permissionless buttons cannot double-pay.

Two seams are used and both are narrow. `_rpc` is replaced with a router that answers by JSON-RPC method, because `mock_web` matches on URL and HTTP method only while this contract POSTs both `eth_getLogs` and `eth_call` to the same URL. Inference is mocked, because a verdict is the *input* to these tests: what is under test is what the contract does with a verdict once it has one, including the three places where it overrules one. Everything downstream of the JSON-RPC envelope runs unmodified: `_find_proposal_log`, `_actions_from_call`, `canonical_digest`, selector resolution and `_apply_outcome` all operate on bytes the test file ABI-encodes itself.

Two tests exist to keep that harness honest rather than to add coverage. One gives provider B a different ETH value for action 0 and asserts the round refuses with `undecodable_gate: EXPLORER_DISAGREEMENT`, no veto and a returned bond. If the corroboration digest were being short-circuited anywhere, that round would still reach `DIVERGENT`. The other pins what the digest actually covers: `_bare_actions` hashes index, target, value, selector and signature and deliberately not the decoded arguments, because argument decoding needs a 4byte lookup and a digest that moved when a third party was slow would report "the explorers disagree" about something they agreed on. The argument words that get judged come from the event's own calldata, which is the emission the Governor is bound by.

`tests/direct/test_named_actions.py` adds ten tests for the redeployment's fix, including that a named action's selector comes from the declared signature, that `name_source` reports `governor` versus `selector` correctly, that the canonical digest is unchanged by the enriched-only key, and one full round that reaches a real verdict with the 4byte source returning nothing.

## Test inventory

`node --test tests/*.test.mjs` (81 tests) covers the production frontend modules:

| Suite | What it pins |
| --- | --- |
| `tests/execution.test.mjs` | Consensus status is never application success. `FINALIZED` plus explicit leader `SUCCESS` is the only accepted shape; `ROLLBACK`, `ERROR`, a missing receipt and malformed execution data all fail closed. |
| `tests/transaction-state.test.mjs` | The transaction rail's persistence, including restoring a stored `ACCEPTED` and resuming polling without treating it as success. |
| `tests/read-result.test.mjs` | Empty and not-found reads stay distinct from unavailable and malformed reads on every surface. |
| `tests/returned-value.test.mjs` | The base64 leader-receipt decoder and the `[REJECTED]` detection that turns a successful-looking execution into a visible refusal in the UI. |
| `tests/minimum-bond.test.mjs` | The bond field reads its minimum from the contract's own `stats().min_review_bond_wei`, defaults to 0.001 GEN, and never hardcodes a figure. |
| `tests/gen-unit.test.mjs` | Wei/GEN conversion in both directions, including the double-conversion bug this suite was written to catch. |
| `tests/wallet-session.test.mjs` | All five wallet events (account changed, account removed, chain changed, provider disconnected, connection refused), plus a scan that fails the suite if a key-material token appears in the wallet, storage or client modules. |
| `tests/fixture-gate.test.mjs` | No page or component may name a fixture constant, and no reader may return a fixture without first checking `IS_LIVE`. |

`python -m pytest tests/direct -q` (67 tests) runs the contract itself under the GenVM SDK:

| Suite | What it pins |
| --- | --- |
| `tests/direct/test_intent_guard.py` | Entry validation, digests, selector resolution, bounds and the refusal gates. |
| `tests/direct/test_decoder_corpus.py` | The embedded deterministic decoder against a byte corpus, bound to `decoder_fingerprint()` so a changed primitive fails review rather than drifting. |
| `tests/direct/test_lifecycle.py` | Veto, rebuttal, adjudication, override, expiry and settlement latching. These are the branches that are NOT PROVEN LIVE. |
| `tests/direct/test_named_actions.py` | The Governor-declared action shape whose mishandling forced the 2026-08-23 redeployment. |
| `tests/direct/test_payable_value.py` | Every payable rejection path refunds and returns `[REJECTED]`, so no input can strand value. |
| `tests/direct/test_economics.py` | The accounting invariant `balance = open review bonds + open rebuttal bonds + bounty pool` across every state transition, asserted after each one rather than at the end. No unexplained balance may exist. |

`tests/e2e/` is Playwright against the deployed URL, not a local build: `production.spec.ts` drives the real routes against the real contract with no test double, and `wallet.spec.ts` uses the scripted provider in `wallet-stub.ts` to exercise connect, chain mismatch and disconnect. The stub signs nothing; `eth_sendTransaction` is deliberately unimplemented, so what the suite asserts is the page's refusal behaviour. Run with `npm run test:e2e`.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | The ledger, with fixture/live provenance stated on the page. |
| `/reviews` | All review records. |
| `/reviews/[id]` | The facing-page apparatus: mandate on one side, decoded calldata on the other, citation threads between them. |
| `/reviews/new` | Bonded `request_review`, with the minimum read from the contract. |
| `/rebut/[id]` | Bonded `rebut` against a review that carries a veto. Refuses, with the contract's own reason, when there is nothing to rebut. |
| `/guard` | The integrator surface: `is_vetoed` for a governor and proposal id. |
| `/docs` | In-app explanation of the mechanism, the signing model and the fixture/live gate. |

## CI and deployment of the exact final HEAD

No file inside a commit can contain the id of the CI run that commit triggers, so the exact-HEAD run ids are recorded in the final audit report rather than asserted here. They are re-derivable from the repository at any time:

```bash
gh run list --repo ometere123/intent-guard --commit "$(git rev-parse HEAD)" --json databaseId,name,conclusion,headSha
```

```bash
npx vercel ls intent-guard --meta githubCommitSha="$(git rev-parse HEAD)"
```

The workflow is [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), job `offline` on `ubuntu-latest`, which runs typecheck, lint, build, the frontend suite and the direct suite with no network access. Every third-party action in it is pinned to a full commit SHA, and the GenVM SDK archive is checked against a known SHA-256 before use, so what runs in CI cannot change without a diff in this repository. The Playwright suite is a separate manually dispatched workflow, [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml), because it requires the Vercel deployment of the same commit to be live first.

## Integrity boundary

- `ACCEPTED` is not application success.
- `FINALIZED` is not application success by itself.
- Success requires `FINALIZED` plus explicit leader `execution_result === "SUCCESS"`.
- `ROLLBACK`, `ERROR`, missing receipt, or malformed execution data fail closed and persist in the transaction rail.
- `is_vetoed.reviewed` distinguishes reviewed-clear from no record. The frontend uses the returned `review_id`; it never scans the ledger.
- `UNDECODABLE` is a refusal gate and cannot create a veto.

## Dependency audit

Both CI installs reported 3 high-severity findings. They were real and they were in the production dependency tree, not dev-only. `npm audit --package-lock-only --omit=dev` against the previous lockfile reproduces all three:

| Finding | Severity | Path | Advisories |
| --- | --- | --- | --- |
| `postcss <=8.5.22` | high | `node_modules/next/node_modules/postcss` | GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849 |
| `sharp <0.35.0` | high | `node_modules/sharp` (optional dep of `next`) | GHSA-f88m-g3jw-g9cj, inherited libvips CVE-2026-33327/33328/35590/35591 |
| `next 9.3.4-canary.0 to 16.3.0-preview.10` | high | `node_modules/next` | Flagged only for depending on the two above |

All three were transitive through one direct dependency, `next 16.2.12`, and npm's own recommended remedy was `next@16.3.2`. That upgrade was applied deliberately, as a reviewed `npm install next@16.3.2 --save-exact` rather than `npm audit fix --force`, because `--force` is documented to install outside the stated dependency range and would have been an unreviewed change to the framework version in a submission build.

After the bump: `postcss` resolves to `8.5.23` and `sharp` to `0.35.3`, both outside their advisory ranges. `npm audit` and `npm audit --omit=dev` both report **0 vulnerabilities**, and CI confirms it independently: the `npm ci` step of run `32508763523` prints `found 0 vulnerabilities` where the earlier runs printed 3 high. Neither app imports `next/image`, so the `sharp` code path was never reachable at runtime in the first place, but it is now on a fixed version regardless rather than being argued away. `npm run verify` passes end to end on the new lockfile.

### Version alignment

That upgrade moved `next` and left `eslint-config-next` behind at `16.2.12`, which is a supported combination but not an intentional one: the config that decides which framework rules apply was a minor release behind the framework. Both are now pinned to exactly `16.3.2` in both repositories, so a rule change shipped with a Next release lands in lint at the same time it lands in the build. The alignment also drops a stale nested `@eslint-community/eslint-utils` / `eslint-visitor-keys` pair from the lint tree. `npm audit`, `npm audit --omit=dev`, typecheck, lint, the full test suites and `next build` were all re-run afterwards on the regenerated lockfile.

## Reproduction

```bash
npm ci
npm run verify
npm run verify:schema
python -m py_compile contracts/IntentGuard.py
genvm-lint check contracts/IntentGuard.py
```

To re-verify the funded proofs from their hashes:

```bash
npm run verify:studionet -- IG-PROOF-3 \
  0x89480d17d1a80415525bd221f8a21f1ea29cd4d7ede6afae2bfbcde139f6d45b \
  0x1f451833f428d138143f2dce894cc36f1ceea72d4ab92cff8e97c99ee5796fc4
```

```bash
npm run verify:studionet -- IG-PROOF-4 \
  0x633f4b950fe322cc46547dd5b218afa30796377826096d7a920fba995f5aeae8 \
  0xdbc5ad34bff012b001469f710910413b17cba236d19f42bea1d4038de5408a04
```

Both exit 0 as of 2026-08-23 exactly as printed, after the three verifier defects above were fixed. The verifier accepts only transaction hashes. It paces reads at five-second intervals, backs off on rate limits, requires `FINALIZED` plus explicit GenVM `SUCCESS` for both writes, then asserts coherent `get_review`, `get_actions` and `is_vetoed` state for the exact review id. It exits non-zero on rollback, missing execution data, or ambiguous record discovery. It never handles signer material.

### How the payable writes were submitted

GenLayer CLI 0.39.2 `genlayer write` hardcodes `value: 0n` and exposes no option for `gl.message.value`. `--fee-value` is not that option: `parseTransactionFees` assigns it to the nested `fees.feeValue`, while application value is the top-level `value` parameter of `writeContract`, which GenLayerJS already supports.

The four payable writes above, two bonded requests and two funded rejections, were therefore sent from a separate local clone of `genlayer-cli` at tag `v0.39.2` carrying a one-field addition that forwards `--value-wei` to that parameter. That clone is not part of this repository, no contract change was required, and signing was untouched: the patched clone uses the same `BaseAction`/`getClient` path and the same OS-keychain cache populated by `genlayer account unlock`. No key was exported, no wallet or keystore was created, and no password was supplied on a command line or written to a file.

## Honest limitations

- Adapters are intentionally limited to the governors returned by `supported_governors`; unsupported implementations are refused.
- A veto is advisory and can be cleared by a fresh governance vote.
- The mechanism checks mandate/action correspondence, not policy merit or target-contract safety.
- The in-repository decoder corpus covers the load-bearing byte/selector/dynamic-array/nesting/canonicalization paths, but it is not represented as a recovered copy of the historical 62-case parent-workspace replay.
- The bonded StudioNet lifecycle is proven end to end twice on this deployment, but both times along the `UNDERSPECIFIED` path. The veto, rebuttal-acceptance, override and bounty branches are proven deterministically in-repo and remain NOT PROVEN LIVE; that distinction is deliberate and is not collapsed anywhere in this document.
- The corroboration digest establishes that three readings agree on the *shape* of each call (target, value, selector, signature) and not on decoded arguments. The judged argument bytes come from the Governor's own emitted event.
- The deployed frontend was not driven by a headless browser. Every route on **https://intent-guard-genlayer.vercel.app** was confirmed to answer 200 to an unauthenticated request with the contract address present in the served HTML, and the data path behind it was verified directly: the CORS preflight from that origin against `https://studio.genlayer.com/api`, and the same `genlayer-js` reads the browser makes, run against the live contract. But no script clicked through the UI, because the in-app browser preview on the build machine cannot attach to a remote URL. That is a gap in the *method of verification*, stated rather than papered over with a screenshot.
