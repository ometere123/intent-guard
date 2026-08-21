import { localnet, studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_INTENT_GUARD_CONTRACT as
  | `0x${string}`
  | undefined;

export const GENLAYER_ENDPOINT =
  process.env.NEXT_PUBLIC_GENLAYER_ENDPOINT ?? "https://studio.genlayer.com/api";

export const CHAIN_NAME = (process.env.NEXT_PUBLIC_GENLAYER_CHAIN ?? "studionet") as
  | "studionet"
  | "localnet"
  | "testnetAsimov"
  | "testnetBradbury";

const CHAINS = { studionet, localnet, testnetAsimov, testnetBradbury } as const;

export const chain = CHAINS[CHAIN_NAME];

/**
 * The one switch between the bundled fixtures and the deployed contract.
 *
 * `NEXT_PUBLIC_INTENT_GUARD_DATA=live` (or any contract address being present)
 * puts every read and write in `data-source.ts` on the chain. Unset, the app
 * reads `src/lib/mock-data.ts` so the apparatus is fully explorable before a
 * deployment exists. Nothing else in the app branches on this.
 */
const requestedDataMode = process.env.NEXT_PUBLIC_INTENT_GUARD_DATA;
export const DATA_MODE: "live" | "fixtures" =
  requestedDataMode === "fixtures"
    ? "fixtures"
    : requestedDataMode === "live" || Boolean(CONTRACT_ADDRESS)
      ? "live"
      : "fixtures";

export const IS_LIVE = DATA_MODE === "live" && Boolean(CONTRACT_ADDRESS);

// genlayer-js's built-in chain metadata for studionet still points at
// genlayer-explorer.vercel.app, but the correct StudioNet explorer is
// explorer-studio.genlayer.com -- override it explicitly rather than trust
// chain.blockExplorers here.
export const EXPLORER_BASE = "https://explorer-studio.genlayer.com";
export const explorerTxUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;
export const explorerAddressUrl = (address: string) => `${EXPLORER_BASE}/address/${address}`;

/** Ethereum mainnet explorer, for the governor and target addresses the review cites. */
export const ETHERSCAN_BASE = "https://etherscan.io";
export const mainnetAddressUrl = (address: string) => `${ETHERSCAN_BASE}/address/${address}`;
export const mainnetBlockUrl = (block: string) => `${ETHERSCAN_BASE}/block/${block}`;
export const mainnetTxUrl = (hash: string) => `${ETHERSCAN_BASE}/tx/${hash}`;

/** Every method the frontend depends on. `verifyContractSchema` reports which are missing. */
export const REQUIRED_METHODS = [
  "request_review",
  "fund_bounty_pool",
  "review",
  "rereview",
  "rebut",
  "adjudicate_rebuttal",
  "expire_rebuttal_window",
  "clear_veto_by_vote",
  "is_vetoed",
  "get_review",
  "get_actions",
  "list_reviews",
  "get_rebuttal",
  "get_rebuttals",
  "supported_governors",
  "verify_event_topic",
  "decoder_fingerprint",
  "keccak_self_test",
  "decoder_self_test",
  "stats",
];
