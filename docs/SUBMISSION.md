# Intent Guard Submission Notes

## Submission Summary

Intent Guard is a GenLayer execution-integrity mechanism for on-chain governance. Validators retrieve a proposal's authoritative published mandate and its executable Governor action set, corroborate and decode the calls, and decide whether the action scope matches the authority voters approved. Divergences create an advisory veto with a bonded right of reply; token holders retain an explicit on-chain override.

## Trust Problem

Governance votes are cast against natural-language descriptions while execution occurs through calldata. Today the correspondence between those artifacts is mostly a manual review assumption. Intent Guard turns it into a public, contestable contract record.

## Why GenLayer Is Central

The main workflow requires live web/RPC retrieval, deterministic byte-level decoding, and semantic comparison of text against structured actions. GenLayer validators perform those steps inside consensus and store the outcome and dispute lifecycle. Removing the Intelligent Contract removes the product's trust mechanism, not merely an AI feature.

## Differentiation

This is not a proposal summarizer or an AI voting assistant. The model never receives raw calldata and never chooses policy. Deterministic gates recover, corroborate and decode the action set first; the semantic round answers only whether the mandate authorises it. A named divergence index is then checked against the actual action range before a veto can be written.

## Evidence Already Established

- Blockscout keyless JSON-RPC supports the required POST requests and headers from GenLayer.
- Real Uniswap proposals 99 and 100 were retrieved and decoded end-to-end.
- Proposal 100 exercised multiple action and nested-wrapper decoder branches.
- Selector lookups are treated as untrusted and accepted only when keccak verification matches.
- A 62-case offline fixture replay found and drove fixes for four real contract defects.
- The frontend covers fixture/live provenance, wallet connection, writes, consensus stages, verdicts, rebuttals, overrides and the executor-facing veto lookup.

## Release Evidence To Insert After Deployment

Do not submit until every placeholder below is replaced with public evidence.

| Item | Evidence |
| --- | --- |
| Live application | `PENDING` |
| StudioNet contract | `0x971406b8F8efFA474F19657d7e55549A17e2b157` |
| Deployment transaction | `0x72153b5f2147fd36308324e9f64242e5b49fde8f28d735cb4d944874508e3f51` |
| Bonded `request_review` | `PENDING` |
| Permissionless `review` consensus transaction | `PENDING` |
| Stored review read | `PENDING` |
| `is_vetoed` structured read | `PENDING` |
| Rebuttal or override branch | `PENDING` |
| Schema verification | `PASS — deployed schema exposes 20 required methods; keccak_self_test and decoder_self_test both ok` |

## Demo Walkthrough

1. Open the ledger and select a record to show the mandate/calldata apparatus and explicit data provenance.
2. Open `/reviews/new`, connect a wallet, and create a bonded review for a supported proposal.
3. Run the permissionless review and show the transaction rail through finality.
4. Read the stored rationale, decoded action set, digests and veto state.
5. Open `/guard` and demonstrate the same integration question an executor bot calls.
6. Demonstrate either a bonded rebuttal or `clear_veto_by_vote`, emphasizing that the mechanism raises objections but never governs the DAO.

## Submission Checklist

- [x] Deploy the exact committed contract to StudioNet.
- [x] Record the contract address and deployment transaction in README and this file.
- [ ] Run `npm run verify:schema` against the deployed contract.
- [ ] Complete at least one real bonded request and consensus review.
- [ ] Confirm the stored review and `is_vetoed` response with public transaction links.
- [ ] Exercise one adversarial branch: rebuttal or governance override.
- [ ] Deploy the frontend with live-mode environment variables.
- [ ] Run typecheck, lint and production build on the release commit.
- [ ] Test wallet and transaction lifecycle on mobile and desktop.
- [ ] Replace the live-app and write-walk entries with public explorer/Vercel evidence after external publication. The local CLI deployment and schema/read evidence are recorded above; the standalone genlayer-js write walk was blocked by the workspace network policy before submission.
