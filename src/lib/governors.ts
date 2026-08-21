/**
 * The client-side mirror of the contract's deterministic adapter registry.
 *
 * `request_review` reverts `[EXPECTED]` on an unknown governor, before any fetch
 * and before any bond is spent. Mirroring the registry here means a user learns
 * that from an inline field message instead of from a reverted payable write.
 *
 * These addresses are the well-known mainnet Governor deployments. They are held
 * in one place on purpose: the deployed contract's registry is authoritative, and
 * if the two ever disagree the contract wins and the request reverts.
 */

export type GovernorFlavour = "BRAVO" | "OZ" | "AAVE";

export type GovernorEntry = {
  address: string;
  label: string;
  space: string;
  flavour: GovernorFlavour;
  /** Shipped in the deployed adapter registry, or still pending. */
  supported: boolean;
  forum?: string;
};

export const GOVERNORS: GovernorEntry[] = [
  {
    address: "0x408ED6354d4973f66138C91495F2f2FCbd8724C3",
    label: "Uniswap Governor Bravo",
    space: "uniswap",
    flavour: "BRAVO",
    supported: true,
    forum: "https://gov.uniswap.org",
  },
  {
    address: "0xc0Da02939E1441F497fd74F78cE7Decb17B66529",
    label: "Compound Governor Bravo",
    space: "compound",
    flavour: "BRAVO",
    supported: true,
    forum: "https://www.comp.xyz",
  },
  {
    address: "0xEC568fffba86c094cf06b22134B23074DFE2252c",
    label: "Aave Governance v2",
    space: "aave",
    flavour: "AAVE",
    supported: false,
    forum: "https://governance.aave.com",
  },
];

export function findGovernor(address: string): GovernorEntry | undefined {
  const needle = (address ?? "").trim().toLowerCase();
  if (!needle) return undefined;
  return GOVERNORS.find((entry) => entry.address.toLowerCase() === needle);
}

export function governorLabel(address: string): string {
  return findGovernor(address)?.label ?? "Unregistered governor";
}

/**
 * Known targets, so a decoded `target` can be named in the apparatus without the
 * model naming it. Every entry here is a public, verifiable contract address; the
 * label is a convenience, never evidence, and the hex is always printed beside it.
 */
export const KNOWN_TARGETS: Record<string, string> = {
  "0x1a07cc4bd17e0118bdb54d70990d2158abad7a2d": "Arbitrum Delayed Inbox (L1 → L2)",
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "UNI token",
  "0x1a9c8182c09f50c8318d769245bea52c32be35bc": "Uniswap Timelock",
  "0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f": "L2 target (nested, depth 1)",
  "0x1f7d7550b1b028f7571e69a784071f0205fd2efa": "L2 target (nested, depth 1)",
};

export function targetLabel(address: string): string | undefined {
  return KNOWN_TARGETS[(address ?? "").trim().toLowerCase()];
}
