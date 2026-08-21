# Intent Guard — Reviewer Evidence

Intent Guard records whether a Governor proposal's corroborated executable actions stay within its published mandate. Deterministic gates establish bytes, selectors, bounds, and digests; GenLayer consensus compares those bounded facts to natural-language authority. Free-form rationale is explanatory and excluded from equivalence.

Every hash below is full and unabbreviated. Every stored value was read back from the deployed contract, not transcribed from a console. The machine-readable form is [`evidence/studionet.json`](../evidence/studionet.json).

## Release evidence

| Item | Status | Evidence |
| --- | --- | --- |
| Contract deployed | PASS | `0x971406b8F8efFA474F19657d7e55549A17e2b157` |
| Deployment transaction | PASS | `0x72153b5f2147fd36308324e9f64242e5b49fde8f28d735cb4d944874508e3f51` |
| Local source binding | PASS | `DEPLOYMENT.json`; SHA-256 `8a2e3f1e7773c44c2ea5b6a54feabb3ea081d3ec230ff23d29b6397cb608e9b3` |
| Deployed-source equality | PASS | `genlayer code 0x971406b8F8efFA474F19657d7e55549A17e2b157` retrieved on 2026-08-21; 195,759 bytes both sides; SHA-256 equal. Proven, not assumed. |
| Schema | PASS | Deployed read exposes all 20 required methods. |
| Contract self-tests | PASS | Deployed reads return `ok: true` for `keccak_self_test` and `decoder_self_test`. |
| Production Node regressions | PASS | `node --test tests/*.test.mjs`: 20/20. |
| Direct contract and decoder tests | PASS | `python -m pytest tests/direct -q`: 26/26. |
| Decoder parity/drift guard | PASS | In-repo corpus executes the embedded decoder and checks `decoder_fingerprint()`. |
| ACCEPTED restoration | PASS | Persisted `ACCEPTED` remains active, resumes polling, and never counts as application success. |
| Live-read failure semantics | PASS | Empty/not-found remain distinct from unavailable/malformed reads across ledger, detail and guard surfaces. |
| Linux CI | PASS | GitHub Actions run `32491864422` on commit `aeaed0740ba9dad7d7da9999f6fd4544d83ceab5`, `ubuntu-latest`, conclusion `success`. |
| TypeScript | PASS | `tsc --noEmit`. |
| ESLint | PASS | `eslint .`. |
| Production build | PASS | `next build`. |
| Dependency audit | PASS | `npm audit --omit=dev`: 0 vulnerabilities. See [Dependency audit](#dependency-audit). |
| Bonded `request_review` | PASS | `0x40b50e6a7f7950250e111d5371afa1f3cc6f15fd731ba4405ea4aa94019c237f` — FINALIZED, GenVM `SUCCESS`, 0.001 GEN bond attached. |
| Consensus `review` | PASS | `0x8f04f376045240d6be4ac83f31f3e4eda0bea82890aecc2e4bed60a23425dd46` — FINALIZED, GenVM `SUCCESS`, 5 validator executions SUCCESS / 1 non-fatal ERROR, votes `DISAGREE, AGREE, AGREE, IDLE, AGREE`. |
| Stored review/actions/veto read | PASS | `get_review("IG-PROOF-1")`, 7 rows from `get_actions`, and `is_vetoed` all coherent. Values below. |
| Bond settlement | PASS | `bond_settled: true`; `stats.balance` is `0`, so the 0.001 GEN was actually returned rather than merely flagged. |
| Veto path on StudioNet | NOT PROVEN | This proposal did not diverge, so no veto was created. Covered by deterministic tests instead — see [What the on-chain proof does not establish](#what-the-on-chain-proof-does-not-establish). |
| Rebuttal / override on StudioNet | NOT PROVEN | Unreachable without a standing veto. Same section. |
| Live application | NOT RECORDED | No verified public URL is recorded in this repository. |

## The proof round

One review, `IG-PROOF-1`, against Uniswap Governor Bravo `0x408ed6354d4973f66138c91495f2f2fcbd8724c3`, proposal `100`, creation block `25554834`.

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

### Why UNDERSPECIFIED, and why that was not forced

The verdict was recorded as the round produced it. Of the seven actions, five are consistent with the mandate — action #0 calls `setProtocolFeeController` directly and #1, #2, #5 and #6 are cross-chain messages carrying the same instruction to other chains, matching a mandate that names Ethereum, Arbitrum, Base, BNB Chain, Polygon, Optimism and Robinhood Chain. Two are not readable: action #3 has selector `0x76ef8453`, and action #4 carries an opaque nested payload with selector `0x00000000`.

The contract's own rule is that when the only thing standing between a proposal and `ALIGNED` is a call nobody can name, the answer is `UNDERSPECIFIED`. So the round declined both available shortcuts: it did not clear the proposal, and it did not veto it. That is the intended behaviour, and it is more informative than a manufactured `ALIGNED` would have been.

Verify independently:

```bash
genlayer call 0x971406b8F8efFA474F19657d7e55549A17e2b157 get_review --args IG-PROOF-1
```

### Control: consensus status is not application success

The same `request_review` submitted through the unpatched `genlayer write` reached consensus status `ACCEPTED` while its GenVM execution reverted, and `stats.reviews` stayed `0`. `genlayer write` hardcodes `value: 0n`, so no bond arrived and the contract correctly refused the call. It is recorded here because it is the cleanest demonstration available that a finalized-looking transaction can carry a reverted execution.

## What the on-chain proof does not establish

The proof above covers `PENDING → UNDERSPECIFIED` with a real bond and real validators. It does not cover the veto path, and this document does not claim otherwise.

A veto requires a live mainnet proposal whose executable calls genuinely contradict its own published text. The contract cannot invent one, and fabricating a fake Governor to produce a veto for a submission would make the evidence worthless. So the veto, rebuttal, override and settlement branches are driven deterministically instead, in [`tests/direct/test_lifecycle.py`](../tests/direct/test_lifecycle.py) — 18 tests covering:

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

After the bump: `postcss` resolves to `8.5.23` and `sharp` to `0.35.3`, both outside their advisory ranges. `npm audit` and `npm audit --omit=dev` both report **0 vulnerabilities**. Neither app imports `next/image`, so the `sharp` code path was never reachable at runtime in the first place, but it is now on a fixed version regardless rather than being argued away. `npm run verify` passes end to end on the new lockfile.

## Reproduction

```bash
npm ci
npm run verify
npm run verify:schema
python -m py_compile contracts/IntentGuard.py
genvm-lint check contracts/IntentGuard.py
```

To re-verify the funded proof from its hashes:

```bash
npm run verify:studionet -- IG-PROOF-1 \
  0x40b50e6a7f7950250e111d5371afa1f3cc6f15fd731ba4405ea4aa94019c237f \
  0x8f04f376045240d6be4ac83f31f3e4eda0bea82890aecc2e4bed60a23425dd46
```

The verifier accepts only transaction hashes. It paces reads at five-second intervals, backs off on rate limits, requires `FINALIZED` plus explicit GenVM `SUCCESS` for both writes, then asserts coherent `get_review`, `get_actions` and `is_vetoed` state for the exact review id. It exits non-zero on rollback, missing execution data, or ambiguous record discovery. It never handles signer material.

### How the payable write was submitted

GenLayer CLI 0.39.2 `genlayer write` hardcodes `value: 0n` and exposes no option for `gl.message.value`. `--fee-value` is not that option: `parseTransactionFees` assigns it to the nested `fees.feeValue`, while application value is the top-level `value` parameter of `writeContract`, which GenLayerJS already supports.

The two writes above were therefore sent from a separate local clone of `genlayer-cli` at tag `v0.39.2` carrying a one-field addition that forwards `--value-wei` to that parameter. That clone is not part of this repository, no contract change was required, and signing was untouched — the patched clone uses the same `BaseAction`/`getClient` path and the same OS-keychain cache populated by `genlayer account unlock`. No key was exported, no wallet or keystore was created, and no password was supplied on a command line or written to a file.

## Honest limitations

- Adapters are intentionally limited to the governors returned by `supported_governors`; unsupported implementations are refused.
- A veto is advisory and can be cleared by a fresh governance vote.
- The mechanism checks mandate/action correspondence, not policy merit or target-contract safety.
- The in-repository decoder corpus covers the load-bearing byte/selector/dynamic-array/nesting/canonicalization paths, but it is not represented as a recovered copy of the historical 62-case parent-workspace replay.
- The bonded StudioNet lifecycle is now proven end to end, but only along the `UNDERSPECIFIED` path. The veto, rebuttal and override branches are proven deterministically in-repo and remain unproven on StudioNet; that distinction is deliberate and is not collapsed anywhere in this document.
- The corroboration digest establishes that three readings agree on the *shape* of each call — target, value, selector, signature — and not on decoded arguments. The judged argument bytes come from the Governor's own emitted event.
- No public application URL is recorded.
