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
| Fail-closed execution tests | PASS | `node --test tests/*.test.mjs`: 6/6. |
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
npm install
npm run verify
npm run verify:schema
python -m py_compile contracts/IntentGuard.py
genvm-lint check contracts/IntentGuard.py
```

For the funded proof:

```bash
npm run verify:studionet -- <keystore> <password>
```

The harness uses `1000000000000000` wei, waits for finality, requires explicit GenVM success after each write, reads the stored `PENDING` record before review, then asserts coherent `get_review`, `get_actions`, and `is_vetoed` state. It exits non-zero on rollback or missing execution data.

## Honest limitations

- Adapters are intentionally limited to the governors returned by `supported_governors`; unsupported implementations are refused.
- A veto is advisory and can be cleared by a fresh governance vote.
- The mechanism checks mandate/action correspondence, not policy merit or target-contract safety.
- The historical 62-case fixture replay lived outside this release repository. It informed fixes but is not counted as an in-repository release test.
