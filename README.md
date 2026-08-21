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

The frontend switches entirely to live state when the deployed address and live data mode are configured. The deployment manifest freezes the submitted contract file's SHA-256; the Explorer source could not be fetched programmatically, so deployed-source equality is not claimed.

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

Create `.env.local`:

```bash
NEXT_PUBLIC_GENLAYER_CHAIN=studionet
NEXT_PUBLIC_GENLAYER_ENDPOINT=https://studio.genlayer.com/api
NEXT_PUBLIC_INTENT_GUARD_CONTRACT=0x971406b8F8efFA474F19657d7e55549A17e2b157
NEXT_PUBLIC_INTENT_GUARD_DATA=live
```

Set the address and change the data mode to `live` after deployment.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run verify:deployment
npm run verify:schema   # requires a deployed address
```

The repository includes focused fail-closed execution regression tests. Earlier parent-workspace fixture replay exercised 62 decoder cases and found four contract bugs, but that historical harness is not represented as an in-repository release test. The deployed contract's `keccak_self_test` and `decoder_self_test` both returned `ok: true`; schema verification exposed all 20 public methods. `scripts/exercise-studionet.mjs` performs a funded request/review walk and refuses to continue unless each finalized write contains explicit GenVM `SUCCESS`.

A network transaction may be accepted and finalized while its GenVM execution rolls back. Intent Guard therefore treats consensus status and contract execution as separate facts; missing, malformed, `ERROR`, or `ROLLBACK` execution data never becomes application success.

## Honest Limits

- Intent Guard checks correspondence, not whether a proposal is good policy or its target contracts are safe.
- Unsupported Governor implementations are refused rather than decoded heuristically.
- Explorer disagreement, unverified selectors and payloads beyond the declared nesting limit produce `UNDECODABLE`, never an inferred verdict.
- A veto is advisory. The contract cannot halt governance by itself, and token holders can override it.
- Live web sources can fail or drift. Refusals are visible in the same ledger as findings.

## Design

The interface is a facing-page scholarly apparatus: warm paper for the human mandate, cool paper for calldata, and citation threads between them. It is intentionally distinct from a generic Web3 dashboard and includes explicit fixture/live provenance on every page.
