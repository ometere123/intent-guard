/**
 * localStorage, kept in one file so nothing else has to know the key names or
 * guard against `localStorage` being absent during server rendering.
 */

import type { StoredTransaction } from "./contract-types";

const TX_KEY = "intent-guard.transactions.v1";

/** Written by the generated-wallet build this replaced. Only ever removed now. */
const LEGACY_GENERATED_KEY = "intent-guard.generated-wallet.v1";
const LEGACY_ACK_KEY = "intent-guard.generated-wallet-ack.v1";

export function readTransactions(): StoredTransaction[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(TX_KEY) || "[]") as StoredTransaction[];
  } catch {
    return [];
  }
}

export function writeTransactions(items: StoredTransaction[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TX_KEY, JSON.stringify(items.slice(0, 24)));
}

/**
 * An earlier build offered a browser-generated signing key held in localStorage.
 * An injected wallet is the only signer now, but removing the feature is not a
 * reason to leave a plaintext private key behind in a browser that used it, so
 * the wallet provider calls this once on mount.
 */
export function purgeLegacyGeneratedKey() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(LEGACY_GENERATED_KEY);
  localStorage.removeItem(LEGACY_ACK_KEY);
}
