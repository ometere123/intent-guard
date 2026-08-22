# Repository hygiene sweep

This repository was swept for the token classes that most often hide a leaked
secret, an unfinished thought, or a stale on-chain claim. Every match below was
read and classified. Nothing was suppressed to make a count look better, and
where a match is legitimate the reason is stated rather than implied.

Scope: all tracked and untracked files, excluding `node_modules`, `.git`,
`.next`, `*.tsbuildinfo` and `package-lock.json`. Command form:

```bash
grep -rIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next \
  --exclude='*.tsbuildinfo' --exclude=package-lock.json -E '<pattern>' .
```

## Results

| Pattern | Matches | Classification |
| --- | --- | --- |
| `\b(TODO\|FIXME\|HACK\|XXX\|TEMP)\b` | 0 | No unfinished-work markers exist in this repository. |
| `localhost` | 1 | `README.md`, in the Local Development section: `Open http://localhost:3000`. Developer instructions for `npm run dev`. No source file contains a localhost endpoint. |
| `127.0.0.1` | 0 | None. |
| `example.com` | 0 | None. |
| `mnemonic`, `keystore`, `password`, `privateKey`, `private key` | 12 | Every match either asserts the negative or enforces it. Five are documentation stating that no key was exported and no keystore or password was used (`README.md`, `docs/SUBMISSION.md`, `evidence/studionet.json`, `src/app/docs/page.tsx`, and a comment in `src/lib/storage.ts` explaining the legacy purge). Six are inside `tests/wallet-session.test.mjs`: its test name plus the banned-token patterns it scans for, which fail the suite if any of those tokens appears in the wallet, storage or client modules. The twelfth is the `*keystore*.json` rule in `.gitignore`. No key material, keystore, password or mnemonic exists anywhere in the repository or its history. |
| `MOCK_`, `mock-data`, `mock-actions` | 24 | The documented fixture mode. `src/lib/mock-data.ts` and `src/lib/mock-actions.ts` are the fixture ledger; they are imported only by `src/lib/genlayer/data-source.ts`, the single gate between fixtures and the contract. `tests/fixture-gate.test.mjs` enforces that, and fails if any page or component names a fixture constant or if a reader returns a fixture without first checking `IS_LIVE`. |
| `fixture` | 49 | Prose about fixture mode in the README, the in-app docs page, module headers and provenance banners, plus the gate tests. Fixture mode is a stated product feature: every page prints which mode it is in, and live mode is entered only when a contract address is configured. |
| Contract addresses | 1 distinct | `0x971406b8F8efFA474F19657d7e55549A17e2b157` only, in 15 places. No superseded Intent Guard deployment address appears anywhere. |
| Other 40-hex addresses | see below | All are third-party or public: the Uniswap Governor Bravo `0x408ed6354d4973f66138c91495f2f2fcbd8724c3`, the reviewer's public account `0xB5EcD6dDa36B370aca4af5E2005d8E2Ae89c6db2`, real mainnet targets quoted from proposal calldata, and addresses marked illustrative inside the fixture ledger. None is a credential. |
| Deployment transaction hashes | current only | Every transaction hash recorded in `README.md`, `docs/SUBMISSION.md` and `evidence/studionet.json` belongs to the deployment named above. There is no historical deployment to label, because the contract has never been redeployed. |

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
