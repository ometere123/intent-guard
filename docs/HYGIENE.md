# Repository hygiene sweep

This repository was swept for the token classes that most often hide a leaked
secret, an unfinished thought, or a stale on-chain claim. Every match below was
read and classified. Nothing was suppressed to make a count look better, and
where a match is legitimate the reason is stated rather than implied.

Scope: all tracked and untracked files, excluding `node_modules`, `.git`,
`.next`, `.pytest_cache`, the gitignored `artifacts/` scratch directory,
`*.tsbuildinfo` and `package-lock.json`. Re-run on 2026-08-23 against the
redeployed contract. Command form:

```bash
grep -rIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next \
  --exclude='*.tsbuildinfo' --exclude=package-lock.json -E '<pattern>' .
```

## Results

| Pattern | Matches | Classification |
| --- | --- | --- |
| `\b(TODO\|FIXME\|HACK\|XXX\|TEMP)\b` | 2 | Both are this sweep describing itself: the pattern in the row you are reading, and the sentence in `README.md` that names the token classes swept for. No unfinished-work marker exists in any source, test, contract or evidence file. |
| `localhost` | 2 | `README.md` line 120, in the Local Development section: `Open http://localhost:3000`, which is developer instructions for `npm run dev`; and line 163, which names `localhost` as one of the token classes swept for. No source file contains a localhost endpoint. |
| `127.0.0.1` | 0 | None. |
| `example.com` | 0 | None. |
| `mnemonic`, `keystore`, `password`, `privateKey`, `private key` | 17 | Every match either asserts the negative or enforces it. Nine are documentation stating that no key is generated and that no keystore or password was used to produce the on-chain proofs (`README.md`, `docs/SUBMISSION.md`, `evidence/studionet.json`, `src/app/docs/page.tsx`, this file, and a comment in `src/lib/storage.ts` explaining the legacy purge). Six are inside `tests/wallet-session.test.mjs`: its test name plus the banned-token patterns it scans for, which fail the suite if any of those tokens appears in the wallet, storage or client modules. One is the same banned-token regex in `tests/e2e/wallet.spec.ts`, which asserts that the deployed page's own DOM and storage never contain a 64-hex string or any of those words. The last is the `*keystore*.json` rule in `.gitignore`. No key material, keystore, password or mnemonic exists anywhere in the repository or its history. |
| `MOCK_`, `mock-data`, `mock-actions` | 24 | The documented fixture mode. `src/lib/mock-data.ts` and `src/lib/mock-actions.ts` are the fixture ledger; they are imported only by `src/lib/genlayer/data-source.ts`, the single gate between fixtures and the contract. `tests/fixture-gate.test.mjs` enforces that, and fails if any page or component names a fixture constant or if a reader returns a fixture without first checking `IS_LIVE`. |
| `fixture` | 49 | Prose about fixture mode in the README, the in-app docs page, module headers and provenance banners, plus the gate tests. Fixture mode is a stated product feature: every page prints which mode it is in, and live mode is entered only when a contract address is configured. |
| Test doubles outside fixture mode | 1 | `tests/e2e/wallet-stub.ts` injects a scripted `window.ethereum` into the deployed page so the Playwright wallet suite can drive connect, chain-mismatch and disconnect without a real extension. It is a browser-side test double, never imported by application code, and it signs nothing: `eth_sendTransaction` is not implemented, and the suite asserts the page's refusal behaviour rather than a transaction. `tests/e2e/production.spec.ts` uses no double at all and drives the real deployed build against the real contract. |
| Contract addresses | 3 distinct, 1 current | The current deployment `0x2DB60126A464f527289ADa029126DaEFb80Bf725` in 14 places. The two superseded deployments `0x27C9CB5A68f1EBD7C190b3FA575cc17A15F4D8cC` and `0x971406b8F8efFA474F19657d7e55549A17e2b157` appear only in `DEPLOYMENT.json`, `evidence/studionet.json` and this file, in every case inside a block explicitly labelled historical. No source file, test, page or `.env.example` names a superseded address. |
| Other 40-hex addresses | see below | All are third-party or public: the Uniswap Governor Bravo `0x408ed6354d4973f66138c91495f2f2fcbd8724c3`, the reviewer's public account `0xB5EcD6dDa36B370aca4af5E2005d8E2Ae89c6db2`, real mainnet targets quoted from proposal calldata, and addresses marked illustrative inside the fixture ledger. None is a credential. |
| Deployment transaction hashes | current, plus labelled historical | Every hash in `README.md` and `docs/SUBMISSION.md` belongs to the current deployment. `evidence/studionet.json` and `DEPLOYMENT.json` additionally carry the two superseded deployments' own transactions under `historicalDeployments`, including the two that recorded the selector defect. Those are kept because they are true, and each is stated to prove the behaviour of its own contract and nothing about the current one. |

## Secrets and artifacts are not committed

`git ls-files` matched against `tsbuildinfo`, `.env`, `.vercel`, `node_modules`,
`.key`, `keystore`, `.pem` and `id_rsa` returns exactly one file: `.env.example`,
which is a template holding a public contract address and the public StudioNet
RPC endpoint. `git log --all --name-only` across every commit ever made returns
the same single file, so none of those artifacts was committed and later removed.

`.gitignore` covers `.env*` with `!.env.example`, `.vercel`, `node_modules`,
`*.pem`, `*.key`, `*keystore*.json`, `*.tsbuildinfo`, `.next`, `artifacts`,
`__pycache__` and `.pytest_cache`. Each was verified with `git check-ignore -q`
rather than read from the file, so the assertion is about behaviour and not about
the pattern list.

One temporary keystore existed on the machine that produced the StudioNet proofs
and was deleted. It is absent from
`%LOCALAPPDATA%\Temp`, absent from `git log --all --name-only` in both
repositories, and was never replaced by another credential file. Its contents
were never read or printed.
