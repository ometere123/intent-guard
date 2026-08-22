# Intent Guard — Reviewer Evidence

**Live app:** https://intent-guard-genlayer.vercel.app · **StudioNet contract:** `0x971406b8F8efFA474F19657d7e55549A17e2b157`

Intent Guard records whether a Governor proposal's corroborated executable actions stay within its published mandate. Deterministic gates establish bytes, selectors, bounds, and digests; GenLayer consensus compares those bounded facts to natural-language authority. Free-form rationale is explanatory and excluded from equivalence.

There is no backend: no API route, server action, database, indexer, worker or cron. Reads and writes go from the browser straight to the GenLayer RPC, and every time transition is a button any address can press.

Every hash below is full and unabbreviated. Every stored value was read back from the deployed contract, not transcribed from a console. The machine-readable form is [`evidence/studionet.json`](../evidence/studionet.json).

## Release evidence

| Item | Status | Evidence |
| --- | --- | --- |
| Contract deployed | PASS | `0x971406b8F8efFA474F19657d7e55549A17e2b157` |
| Deployment transaction | PASS | `0x72153b5f2147fd36308324e9f64242e5b49fde8f28d735cb4d944874508e3f51` |
| Local source binding | PASS | `DEPLOYMENT.json`; SHA-256 `8a2e3f1e7773c44c2ea5b6a54feabb3ea081d3ec230ff23d29b6397cb608e9b3` |
| Deployed-source equality | PASS | `genlayer code 0x971406b8F8efFA474F19657d7e55549A17e2b157` retrieved 2026-08-21, re-retrieved and re-compared 2026-08-22; 195,759 bytes both sides; SHA-256 equal; never redeployed. Proven, not assumed. |
| Schema | PASS | Deployed read exposes all 20 required methods. |
| Contract self-tests | PASS | Deployed reads return `ok: true` for `keccak_self_test` and `decoder_self_test`. |
| Production Node regressions | PASS | `node --test tests/*.test.mjs`: 20/20. |
| Direct contract and decoder tests | PASS | `python -m pytest tests/direct -q`: 26/26. |
| Decoder parity/drift guard | PASS | In-repo corpus executes the embedded decoder and checks `decoder_fingerprint()`. |
| ACCEPTED restoration | PASS | Persisted `ACCEPTED` remains active, resumes polling, and never counts as application success. |
| Live-read failure semantics | PASS | Empty/not-found remain distinct from unavailable/malformed reads across ledger, detail and guard surfaces. |
| Linux CI | PASS | GitHub Actions run `32508763523` on commit `0b07fa471edc4f37a3085d9bf44bf058cbaed11b`, `ubuntu-latest`, conclusion `success`; its `npm ci` step reports `found 0 vulnerabilities`. CI runs on every push, so later commits have their own runs. |
| TypeScript | PASS | `tsc --noEmit`. |
| ESLint | PASS | `eslint .`. |
| Production build | PASS | `next build`. |
| Dependency audit | PASS | `npm audit --omit=dev`: 0 vulnerabilities. See [Dependency audit](#dependency-audit). |
| Bonded `request_review` — `IG-PROOF-1` | PASS | `0x40b50e6a7f7950250e111d5371afa1f3cc6f15fd731ba4405ea4aa94019c237f` — FINALIZED, GenVM `SUCCESS`, 0.001 GEN bond attached. |
| Consensus `review` — `IG-PROOF-1` | PASS | `0x8f04f376045240d6be4ac83f31f3e4eda0bea82890aecc2e4bed60a23425dd46` — FINALIZED, GenVM `SUCCESS`, 5 executions SUCCESS / 1 non-fatal ERROR, votes `DISAGREE, AGREE, AGREE, IDLE, AGREE`. |
| Bonded `request_review` — `IG-PROOF-2` | PASS | `0xba9dc4e66e7ea155c308deb8d43bd32a8c248f8ae369ba6b274e2d14681cedea` — FINALIZED, GenVM `SUCCESS`, `value_credited: true`, 4 executions SUCCESS / 2 non-fatal ERROR, votes `IDLE, AGREE, IDLE, AGREE, AGREE`. |
| Consensus `review` — `IG-PROOF-2` | PASS | `0xa78a692eda0f08a0f3aa3c8f1520ae3af224bd4b16b42bef6dd52f4e435bcd2e` — FINALIZED, GenVM `SUCCESS`, 5 executions SUCCESS / 0 ERROR, votes `AGREE, DISAGREE, AGREE, AGREE`. |
| Stored review/actions/veto reads | PASS | `get_review`, `get_actions` (7 rows / 9 rows) and `is_vetoed` all coherent for both ids. Values below. |
| Two different proposals, two different shapes | PASS | Proposal `100` with 7 actions and proposal `98` with 9 cross-chain actions, reviewed a day apart against the same deployed contract. The path is not tuned to one input. |
| Bond settlement | PASS | `bond_settled: true` for both; `stats.reviews` is `2` and `stats.balance` is `0`, so both 0.001 GEN bonds were actually returned rather than merely flagged. A settlement that had silently failed to pay out would have left a balance behind. |
| Frontend read path against live state | PASS | `scripts/exercise-studionet.mjs` exits 0 for both ids, reading through `genlayer-js` — the same library and encoding path the browser uses. Three real defects in that script were fixed on 2026-08-22 to get there; see [Verifier defects found and fixed](#verifier-defects-found-and-fixed). |
| Veto path on StudioNet | NOT PROVEN | Neither proposal diverged, so no veto was created, and a `DIVERGENT` verdict was not forced out of either. Covered by deterministic tests instead — see [What the on-chain proof does not establish](#what-the-on-chain-proof-does-not-establish). |
| Rebuttal / override on StudioNet | NOT PROVEN | Unreachable without a standing veto. Same section. |
| Live application | PASS | **https://intent-guard-genlayer.vercel.app** — public, no login wall, all 7 routes return 200 unauthenticated, contract address baked into the served HTML, no backend of any kind. Not driven by a headless browser; see [Honest limitations](#honest-limitations). |

## The proof rounds

Two reviews against Uniswap Governor Bravo `0x408ed6354d4973f66138c91495f2f2fcbd8724c3`.

### `IG-PROOF-1` — proposal `100`, creation block `25554834`

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
| `reviewed_at` | `2026-08-21T13:43:02.958723Z` |

`is_vetoed("0x408ed6354d4973f66138c91495f2f2fcbd8724c3", 100)` returns `reviewed: true`, `vetoed: false`, `status: UNDERSPECIFIED`, `review_id: IG-PROOF-1`, `note: "The mandate was too vague to authorise or exclude what the calls do."`

### `IG-PROOF-2` — proposal `98`, creation block `25460396`

| Field | Value |
| --- | --- |
| `status` | `UNDERSPECIFIED` |
| `mandate_title` | `[RFC] Update Crosschain Governance Parameters for Avalanche, MegaETH, Soneium, and X Layer` |
| `mandate_digest` | `0xca1661a862f5104d8a32d4eb097952302b48aec43e382c0deb9eddbd56221fcb` |
| `actions_digest` | `0x973cac9e8dbbc216230c5f06b6741c244a63144a1267433bd1aef2f199575462` |
| `action_count` | `9` |
| `divergence_kind` | `NONE` |
| `veto_flag` | `false` |
| `undecodable_gate` | `""` (no refusal gate fired) |
| `nondet_ops` | `11` |
| `bond` / `bond_settled` | `1000000000000000` wei / `true` |
| `requester` | `0xB5EcD6dDa36B370aca4af5E2005d8E2Ae89c6db2` |
| `reviewed_at` | `2026-08-22T00:44:01.365078Z` |

`is_vetoed("0x408ed6354d4973f66138c91495f2f2fcbd8724c3", 98)` returns `reviewed: true`, `vetoed: false`, `status: UNDERSPECIFIED`, `review_id: IG-PROOF-2`.

### Why UNDERSPECIFIED, and why that was not forced

Both verdicts were recorded as the rounds produced them.

For `IG-PROOF-1`, five of the seven actions are consistent with the mandate — action #0 calls `setProtocolFeeController` directly and #1, #2, #5 and #6 are cross-chain messages carrying the same instruction to other chains, matching a mandate that names Ethereum, Arbitrum, Base, BNB Chain, Polygon, Optimism and Robinhood Chain. Two are not readable: action #3 has selector `0x76ef8453`, and action #4 carries an opaque nested payload with selector `0x00000000`.

For `IG-PROOF-2`, the round went further and named seven of the nine calls against the mandate's own text: actions #0 and #7 as the LayerZero trusted-remote writes for the MegaETH executors, #1/#2/#8 as `OmnichainProposalSender.execute` relays to Avalanche and MegaETH, and #3–#6 as bridge `depositTransaction` calls targeting the CrossChainAccount on Soneium and X Layer. It then refused to clear the proposal anyway. Its stored rationale says why, in its own words:

> However, the nested payloads for the `execute` calls (Actions #1, #2, #8) and the `depositTransaction` calls (Actions #3, #4, #5, #6) are OPAQUE. While the targets and high-level functions align with the mandate, the specific instructions being relayed to the remote chains cannot be verified. Per rule 5, since the only remaining uncertainty is the opaque nature of these nested calls, the verdict is UNDERSPECIFIED.

This is the more interesting of the two results. A reviewer optimising to look decisive would have called it `ALIGNED` — the targets and the top-level functions do match. The contract's own rule is that when the only thing standing between a proposal and `ALIGNED` is a call nobody can read, the answer is `UNDERSPECIFIED`. So in both rounds it declined both available shortcuts: it did not clear the proposal, and it did not veto it. The rationale is stored on-chain, which makes that decision auditable rather than asserted.

Verify independently:

```bash
genlayer call 0x971406b8F8efFA474F19657d7e55549A17e2b157 get_review --args IG-PROOF-1
```

```bash
genlayer call 0x971406b8F8efFA474F19657d7e55549A17e2b157 get_review --args IG-PROOF-2
```

### Control: consensus status is not application success

The same `request_review` submitted through the unpatched `genlayer write` reached consensus status `ACCEPTED` while its GenVM execution reverted, and `stats.reviews` stayed `0`. `genlayer write` hardcodes `value: 0n`, so no bond arrived and the contract correctly refused the call. It is recorded here because it is the cleanest demonstration available that a finalized-looking transaction can carry a reverted execution.

### Verifier defects found and fixed

Re-running `scripts/exercise-studionet.mjs` on 2026-08-22 surfaced three genuine defects in the verifier itself. All three are recorded here because the honest consequence is that this check had never actually passed before — not for `IG-PROOF-2`, and not for `IG-PROOF-1` either.

1. The FINALIZED assertion read `tx.status_name`, a field the RPC never sends. `genlayer-js` decorates the snake_case RPC payload with a camelCase `statusName`; the raw `status` beside it is a numeric enum ordinal, where `7` is FINALIZED. The check therefore fell through to the ordinal and compared `7` against the string `"FINALIZED"`, which can never match. It now reads `statusName` and refuses a non-string status outright rather than stringifying the ordinal into a mismatch.
2. The `is_vetoed` read passed a hardcoded `["0x408ED6354d4973f66138C91495F2f2FCbd8724C3", 100n]`, so for any review id other than `IG-PROOF-1` it would have silently reported a different proposal's veto state. It now derives the pair from the review it just read — `[review.governor, BigInt(review.proposal_id)]` — with the non-`PENDING` guard moved above the veto read so a missing review produces a clear error instead of a property access on null.
3. The script read `NEXT_PUBLIC_INTENT_GUARD_CONTRACT` straight from `process.env` with no `.env.local` loader, while its sibling `scripts/verify-schema.mjs` in the same directory already had one. The commands printed in this document and in the README therefore threw `NEXT_PUBLIC_INTENT_GUARD_CONTRACT is not set` and exited 1 before opening a socket; they only worked in a shell that had exported the address by hand. The sibling's ten-line loader was copied in verbatim rather than introducing a dependency, and both commands now exit 0 exactly as written. Recourse's `scripts/exercise-studionet.mjs` had the identical gap against its own `NEXT_PUBLIC_RECOURSE_CONTRACT` and was fixed the same way.

None of the three was a defect in the contract, and no contract change was made. `verify:studionet` is not part of the `npm run verify` chain, which is why CI never surfaced them; that gap is stated rather than quietly closed.

## What the on-chain proof does not establish

The proofs above cover `PENDING → UNDERSPECIFIED` with real bonds and real validators, twice, on two different proposals. They do not cover the veto path, and this document does not claim otherwise.

A veto requires a live mainnet proposal whose executable calls genuinely contradict its own published text. Two real proposals were put through the full path and neither diverged. The contract cannot invent one, and fabricating a fake Governor to produce a veto for a submission would make the evidence worthless. So the veto, rebuttal, override and settlement branches are driven deterministically instead, in [`tests/direct/test_lifecycle.py`](../tests/direct/test_lifecycle.py) — 18 tests covering:

- veto creation from a `DIVERGENT` round, with the bond deliberately left at risk;
- the rebuttal deadline landing exactly one window after the review;
- all three arithmetic overrides that refuse to veto — missing `divergence_kind`, out-of-range `diverging_index`, and an `OPAQUE_NESTED` finding against an action whose selector never resolved;
- the downgrade of `ALIGNED` when a selector never resolved;
- the `rebut` guards: no live veto, exact bond equality, one rebuttal per review, `http(s)` argument URL;
- all three rebuttal dispositions — `UPHELD`, `WITHDRAWN_VETO`, `UNCLEAR` — asserted on which stake moves and when;
- both `expire_rebuttal_window` branches, including a rebuttal that lapses unread;
- settlement latching, so permissionless buttons cannot double-pay.

Two seams are used and both are narrow. `_rpc` is replaced with a router that answers by JSON-RPC method, because `mock_web` matches on URL and HTTP method only while this contract POSTs both `eth_getLogs` and `eth_call` to the same URL. Inference is mocked, because a verdict is the *input* to these tests — what is under test is what the contract does with a verdict once it has one, including the three places where it overrules one. Everything downstream of the JSON-RPC envelope runs unmodified: `_find_proposal_log`, `_actions_from_call`, `canonical_digest`, selector resolution and `_apply_outcome` all operate on bytes the test file ABI-encodes itself.

Two tests exist to keep that harness honest rather than to add coverage. One gives provider B a different ETH value for action 0 and asserts the round refuses with `undecodable_gate: EXPLORER_DISAGREEMENT`, no veto and a returned bond — if the corroboration digest were being short-circuited anywhere, that round would still reach `DIVERGENT`. The other pins what the digest actually covers: `_bare_actions` hashes index, target, value, selector and signature and deliberately not the decoded arguments, because argument decoding needs a 4byte lookup and a digest that moved when a third party was slow would report "the explorers disagree" about something they agreed on. The argument words that get judged come from the event's own calldata, which is the emission the Governor is bound by.

## Integrity boundary

- `ACCEPTED` is not application success.
- `FINALIZED` is not application success by itself.
- Success requires `FINALIZED` plus explicit leader `execution_result === "SUCCESS"`.
- `ROLLBACK`, `ERROR`, missing receipt, or malformed execution data fail closed and persist in the transaction rail.
- `is_vetoed.reviewed` distinguishes reviewed-clear from no record. The frontend uses the returned `review_id`; it never scans the ledger.
- `UNDECODABLE` is a refusal gate and cannot create a veto.

## Dependency audit

Both CI installs reported 3 high-severity findings. They were real and they were in the production dependency tree, not dev-only — `npm audit --package-lock-only --omit=dev` against the previous lockfile reproduces all three:

| Finding | Severity | Path | Advisories |
| --- | --- | --- | --- |
| `postcss <=8.5.22` | high | `node_modules/next/node_modules/postcss` | GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849 |
| `sharp <0.35.0` | high | `node_modules/sharp` (optional dep of `next`) | GHSA-f88m-g3jw-g9cj — inherited libvips CVE-2026-33327/33328/35590/35591 |
| `next 9.3.4-canary.0 – 16.3.0-preview.10` | high | `node_modules/next` | Flagged only for depending on the two above |

All three were transitive through one direct dependency, `next 16.2.12`, and npm's own recommended remedy was `next@16.3.2`. That upgrade was applied deliberately — `npm install next@16.3.2 --save-exact`, reviewed, not `npm audit fix --force` — because `--force` is documented to install outside the stated dependency range and would have been an unreviewed change to the framework version in a submission build.

After the bump: `postcss` resolves to `8.5.23` and `sharp` to `0.35.3`, both outside their advisory ranges. `npm audit` and `npm audit --omit=dev` both report **0 vulnerabilities**, and CI confirms it independently — the `npm ci` step of run `32508763523` prints `found 0 vulnerabilities` where the earlier runs printed 3 high. Neither app imports `next/image`, so the `sharp` code path was never reachable at runtime in the first place, but it is now on a fixed version regardless rather than being argued away. `npm run verify` passes end to end on the new lockfile.

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
npm run verify:studionet -- IG-PROOF-1 \
  0x40b50e6a7f7950250e111d5371afa1f3cc6f15fd731ba4405ea4aa94019c237f \
  0x8f04f376045240d6be4ac83f31f3e4eda0bea82890aecc2e4bed60a23425dd46
```

```bash
npm run verify:studionet -- IG-PROOF-2 \
  0xba9dc4e66e7ea155c308deb8d43bd32a8c248f8ae369ba6b274e2d14681cedea \
  0xa78a692eda0f08a0f3aa3c8f1520ae3af224bd4b16b42bef6dd52f4e435bcd2e
```

Both exit 0 as of 2026-08-22 exactly as printed, after the three verifier defects above were fixed. The verifier accepts only transaction hashes. It paces reads at five-second intervals, backs off on rate limits, requires `FINALIZED` plus explicit GenVM `SUCCESS` for both writes, then asserts coherent `get_review`, `get_actions` and `is_vetoed` state for the exact review id. It exits non-zero on rollback, missing execution data, or ambiguous record discovery. It never handles signer material.

### How the payable writes were submitted

GenLayer CLI 0.39.2 `genlayer write` hardcodes `value: 0n` and exposes no option for `gl.message.value`. `--fee-value` is not that option: `parseTransactionFees` assigns it to the nested `fees.feeValue`, while application value is the top-level `value` parameter of `writeContract`, which GenLayerJS already supports.

The two payable `request_review` writes above were therefore sent from a separate local clone of `genlayer-cli` at tag `v0.39.2` carrying a one-field addition that forwards `--value-wei` to that parameter. That clone is not part of this repository, no contract change was required, and signing was untouched — the patched clone uses the same `BaseAction`/`getClient` path and the same OS-keychain cache populated by `genlayer account unlock`. No key was exported, no wallet or keystore was created, and no password was supplied on a command line or written to a file.

## Honest limitations

- Adapters are intentionally limited to the governors returned by `supported_governors`; unsupported implementations are refused.
- A veto is advisory and can be cleared by a fresh governance vote.
- The mechanism checks mandate/action correspondence, not policy merit or target-contract safety.
- The in-repository decoder corpus covers the load-bearing byte/selector/dynamic-array/nesting/canonicalization paths, but it is not represented as a recovered copy of the historical 62-case parent-workspace replay.
- The bonded StudioNet lifecycle is proven end to end twice, but both times along the `UNDERSPECIFIED` path. The veto, rebuttal and override branches are proven deterministically in-repo and remain unproven on StudioNet; that distinction is deliberate and is not collapsed anywhere in this document.
- The corroboration digest establishes that three readings agree on the *shape* of each call — target, value, selector, signature — and not on decoded arguments. The judged argument bytes come from the Governor's own emitted event.
- The deployed frontend was not driven by a headless browser. Every route on **https://intent-guard-genlayer.vercel.app** was confirmed to answer 200 to an unauthenticated request with the contract address present in the served HTML, and the data path behind it was verified directly — the CORS preflight from that origin against `https://studio.genlayer.com/api`, and the same `genlayer-js` reads the browser makes, run against the live contract. But no script clicked through the UI, because the in-app browser preview on the build machine cannot attach to a remote URL. That is a gap in the *method of verification*, stated rather than papered over with a screenshot.
