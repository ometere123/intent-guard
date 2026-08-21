/**
 * localStorage, kept in one file so nothing else has to know the key names or
 * guard against `localStorage` being absent during server rendering.
 */

import type { StoredTransaction } from "./contract-types";

const TX_KEY = "intent-guard.transactions.v1";
const GENERATED_KEY = "intent-guard.generated-wallet.v1";
const ACK_KEY = "intent-guard.generated-wallet-ack.v1";

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

export function readGeneratedKey(): `0x${string}` | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(GENERATED_KEY) as `0x${string}` | null;
}

export function writeGeneratedKey(key: `0x${string}`) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(GENERATED_KEY, key);
}

export function hasAcknowledgedGeneratedWallet(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(ACK_KEY) === "yes";
}

export function acknowledgeGeneratedWallet() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ACK_KEY, "yes");
}
