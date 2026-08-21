# Intent Guard — Reviewer Evidence

Intent Guard records whether a Governor proposal's corroborated executable actions stay within its published mandate. Deterministic gates establish bytes, selectors, bounds, and digests; GenLayer consensus compares those bounded facts to natural-language authority. Free-form rationale is explanatory and excluded from equivalence.

## Release evidence

| Item | Status | Evidence |
| --- | --- | --- |
| Contract deployed | PASS | `0x971406b8F8efFA474F19657d7e55549A17e2b157` |
| Deployment transaction | PASS | `0x72153b5f2147fd36308324e9f64242e5b49fde8f28d735cb4d944874508e3f51` |
| Local source binding | PASS | `DEPLOYMENT.json`; SHA-256 `8a2e3f1e7773c44c2ea5b6a54feabb3ea081d3ec230ff23d29b6397cb608e9b3` |
| Deployed-source equality | PENDING | Explorer source was not retrieved; equality is not claimed. |
| Schema | PASS | Earlier deployed read exposed all 20 required methods. |
| Contract self-tests | PASS | Earlier deployed reads returned `ok: true` for both self-tests. |
| Production Node regressions | PASS | `node --test tests/*.test.mjs`: 20/20. |
| Direct contract and decoder tests | PASS | `python -m pytest tests/direct -q`: 8/8. |
| Decoder parity/drift guard | PASS | In-repo corpus executes the embedded decoder and checks `decoder_fingerprint()`. |
| ACCEPTED restoration | PASS | Persisted `ACCEPTED` remains active, resumes polling, and never counts as application success. |
| Live-read failure semantics | PASS | Empty/not-found remain distinct from unavailable/malformed reads across ledger, detail and guard surfaces. |
| Linux CI | PENDING | Workflow is committed; no remote GitHub Actions run exists for this commit yet. |
| TypeScript | PASS | `tsc --noEmit`. |
| ESLint | PASS | `eslint .`. |
| Production build | PASS | `next build`. |
| Bonded `request_review` | PENDING | No successful public transaction is recorded. |
| Consensus `review` | PENDING | No successful public transaction is recorded. |
| Stored review/actions/veto read | PENDING | Proof harness is ready but has not produced proof here. |
| Rebuttal or override | PENDING | Not exercised on StudioNet. |
| Live application | PENDING | No verified public URL is recorded. |

## Integrity boundary

- `ACCEPTED` is not application success.
- `FINALIZED` is not application success by itself.
- Success requires `FINALIZED` plus explicit leader `execution_result === "SUCCESS"`.
- `ROLLBACK`, `ERROR`, missing receipt, or malformed execution data fail closed and persist in the transaction rail.
- `is_vetoed.reviewed` distinguishes reviewed-clear from no record. The frontend uses the returned `review_id`; it never scans the ledger.
- `UNDECODABLE` is a refusal gate and cannot create a veto.

## Reproduction

```bash
npm ci
npm run verify
npm run verify:schema
python -m py_compile contracts/IntentGuard.py
genvm-lint check contracts/IntentGuard.py
```

For the funded proof:

```bash
npm run verify:studionet -- <review-id> <request-tx-hash> <review-tx-hash>
```

Writes must be signed by the already-unlocked GenLayer CLI account. The verifier accepts only the resulting transaction hashes: it paces reads at five-second intervals, backs off on rate limits, requires `FINALIZED` plus explicit GenVM `SUCCESS` for both writes, and then asserts coherent `get_review`, `get_actions`, and `is_vetoed` state for the exact review id. It exits non-zero on rollback, missing execution data, or ambiguous record discovery.

The current GenLayer CLI exposes `--fee-value` for the transaction fee deposit, but no option for `gl.message.value`. Because `request_review` requires a native review bond, the CLI cannot currently submit that payable call. No credential export or alternate signer path is used.

## Honest limitations

- Adapters are intentionally limited to the governors returned by `supported_governors`; unsupported implementations are refused.
- A veto is advisory and can be cleared by a fresh governance vote.
- The mechanism checks mandate/action correspondence, not policy merit or target-contract safety.
- The in-repository decoder corpus covers the load-bearing byte/selector/dynamic-array/nesting/canonicalization paths, but it is not represented as a recovered copy of the historical 62-case parent-workspace replay.
- The full bonded StudioNet lifecycle and a rebuttal/override branch remain unproven.
