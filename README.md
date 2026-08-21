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

StudioNet contract: `0x971406b8F8efFA474F19657d7e55549A17e2b157`  
Deployment transaction: `0x72153b5f2147fd36308324e9f64242e5b49fde8f28d735cb4d944874508e3f51`

The frontend switches entirely to live state when the deployed address and live data mode are configured. Deployed-source equality is proven, not assumed: the source was retrieved from StudioNet with `genlayer code 0x971406b8F8efFA474F19657d7e55549A17e2b157` on 2026-08-21 and compared byte-for-byte against `contracts/IntentGuard.py` — 195,759 bytes on both sides, SHA-256 `8a2e3f1e7773c44c2ea5b6a54feabb3ea081d3ec230ff23d29b6397cb608e9b3` on both sides.

### Proven on StudioNet

One bonded review, `IG-PROOF-1`, against Uniswap Governor Bravo `0x408ed6354d4973f66138c91495f2f2fcbd8724c3`, proposal `100`, creation block `25554834`:

| Step | Transaction | Result |
| --- | --- | --- |
| `request_review` (payable, 0.001 GEN bond) | `0x40b50e6a7f7950250e111d5371afa1f3cc6f15fd731ba4405ea4aa94019c237f` | FINALIZED + GenVM `SUCCESS` |
| `review` (consensus) | `0x8f04f376045240d6be4ac83f31f3e4eda0bea82890aecc2e4bed60a23425dd46` | FINALIZED + GenVM `SUCCESS`; 5 validator executions SUCCESS, 1 non-fatal ERROR; votes `DISAGREE, AGREE, AGREE, IDLE, AGREE` |

The stored result is `UNDERSPECIFIED` with `action_count: 7`, `divergence_kind: NONE`, `veto_flag: false` and `bond_settled: true` — five of the seven actions match the mandate `Activate v4 Protocol Fees (Part 1/2)`, and two carry selectors nobody could name (`0x76ef8453` and an opaque nested `0x00000000`), which under the contract's own rule forbids clearing the proposal *and* forbids vetoing it. `is_vetoed` returns `reviewed: true`, `vetoed: false`, `review_id: IG-PROOF-1`. `stats.balance` is `0`, so the bond was genuinely returned.

The veto, rebuttal and override branches are **not** proven on StudioNet — reaching them needs a live mainnet proposal whose calls contradict its own text, and this contract will not invent one. They are proven deterministically in `tests/direct/test_lifecycle.py` instead. Full record, including the exact hashes and every stored field: [`evidence/studionet.json`](./evidence/studionet.json) and [`docs/SUBMISSION.md`](./docs/SUBMISSION.md).

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

## Environment

Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_GENLAYER_CHAIN=studionet
NEXT_PUBLIC_GENLAYER_ENDPOINT=https://studio.genlayer.com/api
NEXT_PUBLIC_INTENT_GUARD_CONTRACT=0x971406b8F8efFA474F19657d7e55549A17e2b157
NEXT_PUBLIC_INTENT_GUARD_DATA=live
```

Set the address and change the data mode to `live` after deployment.

## Local Development

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

The repository includes production-module transaction/read regressions, direct state-machine tests, and a decoder corpus that executes the deterministic decoder embedded in `contracts/IntentGuard.py`. The decoder suite binds itself to `decoder_fingerprint()` so a changed embedded primitive fails review rather than drifting silently. `python -m pytest tests/direct -q` runs 26 tests, 18 of which drive the veto, rebuttal, override and settlement branches the StudioNet proof could not reach. The deployed contract's `keccak_self_test` and `decoder_self_test` both returned `ok: true`; schema verification exposed all 20 public methods. `scripts/exercise-studionet.mjs` re-verifies the funded request/review walk from its transaction hashes and refuses to continue unless each finalized write contains explicit GenVM `SUCCESS`.

`npm audit` and `npm audit --omit=dev` both report 0 vulnerabilities. Three high-severity transitive findings surfaced earlier through `next 16.2.12` and were resolved by an explicit reviewed `next@16.3.2` upgrade rather than `npm audit fix --force`; the full determination is in [`docs/SUBMISSION.md`](./docs/SUBMISSION.md#dependency-audit).

A network transaction may be accepted and finalized while its GenVM execution rolls back. Intent Guard therefore treats consensus status and contract execution as separate facts; missing, malformed, `ERROR`, or `ROLLBACK` execution data never becomes application success. That is not theoretical here: the same `request_review` submitted through the unpatched CLI reached `ACCEPTED` with a reverted execution and left `stats.reviews` at `0`.

## Honest Limits

- Intent Guard checks correspondence, not whether a proposal is good policy or its target contracts are safe.
- Unsupported Governor implementations are refused rather than decoded heuristically.
- Explorer disagreement, unverified selectors and payloads beyond the declared nesting limit produce `UNDECODABLE`, never an inferred verdict.
- A veto is advisory. The contract cannot halt governance by itself, and token holders can override it.
- Live web sources can fail or drift. Refusals are visible in the same ledger as findings.
- Deployed-source equality is proven for the current deployment. It is a claim about the contract *source* retrieved from StudioNet, not an independent audit of validator bytecode.
- The bonded StudioNet lifecycle is proven, but only along the `UNDERSPECIFIED` path. No veto exists on-chain, so the rebuttal and governance-override branches are proven in-repo and remain unproven on StudioNet. The two are not conflated anywhere in this repository.
- The three-way corroboration digest establishes agreement on the shape of each call — target, value, selector, signature — and deliberately not on decoded arguments, which would make a slow 4byte lookup look like explorer disagreement. The argument bytes that get judged come from the Governor's own emitted event.
- No public application URL is recorded.

## Design

The interface is a facing-page scholarly apparatus: warm paper for the human mandate, cool paper for calldata, and citation threads between them. It is intentionally distinct from a generic Web3 dashboard and includes explicit fixture/live provenance on every page.
