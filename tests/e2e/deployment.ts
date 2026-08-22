/**
 * What this commit claims is deployed.
 *
 * The E2E suite asserts the live site is pointed at *this* address rather than at
 * any hardcoded one, so the pair (repo, deployment) is checked rather than
 * assumed. When the contract is redeployed, `DEPLOYMENT.json` is rewritten and
 * these tests follow it without being edited, which is the point: a stale test
 * that still passes against the old contract would be worse than no test.
 *
 * Resolved by walking up from the working directory rather than from `__dirname`
 * or `import.meta.url`, because one of these two repositories is CommonJS and the
 * other is ESM and this file is meant to be identical in both.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let hops = 0; hops < 6; hops += 1) {
    if (existsSync(path.join(dir, "DEPLOYMENT.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `DEPLOYMENT.json was not found at or above ${process.cwd()}. Run the E2E suite from the repository root.`,
  );
}

type DeploymentRecord = {
  network: string;
  contract: string;
  deploymentTransaction?: string;
  contractSha256?: string;
  deployedSourceVerified?: boolean;
};

const root = findRepoRoot();

export const deployment = JSON.parse(
  readFileSync(path.join(root, "DEPLOYMENT.json"), "utf8"),
) as DeploymentRecord;

/** Lowercased, because the site prints whatever casing its environment holds. */
export const expectedContract = deployment.contract.toLowerCase();

export const expectedNetwork = deployment.network;

/** The first `0x…40` in a string, lowercased, or undefined when there is none. */
export function addressIn(text: string | null): string | undefined {
  return text?.match(/0x[0-9a-fA-F]{40}/)?.[0]?.toLowerCase();
}
