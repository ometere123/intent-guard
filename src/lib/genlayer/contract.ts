import { TransactionStatus } from "genlayer-js/types";
import type { CalldataEncodable, GenLayerClient, TransactionHash } from "genlayer-js/types";
import { CONTRACT_ADDRESS, REQUIRED_METHODS } from "./config";
import { createReadClient } from "./read-client";
import type { ContractStats, DecodedAction, Rebuttal, Review, VetoState } from "../contract-types";
import { assertSuccessfulGenVMExecution, inspectGenVMExecution } from "./execution";
import { returnedFromTransaction, type ReturnedValue } from "./returned-value";
import {
  available,
  isRecord,
  notFound,
  performRead,
  unavailable,
  type ReadResult,
} from "./read-result";

type Client = GenLayerClient<typeof import("./config").chain>;

/* ------------------------------------------------------------------------- */
/* Views                                                                      */
/* ------------------------------------------------------------------------- */

export async function verifyContractSchema() {
  if (!CONTRACT_ADDRESS) return { ok: false, missing: REQUIRED_METHODS, configured: false };
  const address = CONTRACT_ADDRESS;
  const client = createReadClient();
  const schema = await readMaybe<{ methods: Record<string, unknown> }>(() =>
    client.getContractSchema(address),
  );
  if (!schema) return { ok: false, missing: REQUIRED_METHODS, configured: true };
  const missing = REQUIRED_METHODS.filter((method) => !schema.methods[method]);
  return { ok: missing.length === 0, missing, configured: true };
}

export async function listReviews(): Promise<ReadResult<Review[]>> {
  if (!CONTRACT_ADDRESS) return unavailable("No deployed contract address is configured.");
  const address = CONTRACT_ADDRESS;
  const client = createReadClient();
  return performRead(
    () => client.readContract({ address, functionName: "list_reviews", args: [0n, 200n] }),
    isReviewArray,
    "list_reviews returned a malformed response",
  );
}

export async function getReview(id: string): Promise<ReadResult<Review>> {
  if (!CONTRACT_ADDRESS) return unavailable("No deployed contract address is configured.");
  const address = CONTRACT_ADDRESS;
  const client = createReadClient();
  const result = await performRead(
    () => client.readContract({ address, functionName: "get_review", args: [id] }),
    isReviewOrEmpty,
    "get_review returned a malformed response",
  );
  if (result.kind !== "AVAILABLE") return result;
  return Object.keys(result.value).length === 0 ? notFound() : available(result.value as Review);
}

export async function getActions(id: string): Promise<ReadResult<DecodedAction[]>> {
  if (!CONTRACT_ADDRESS) return unavailable("No deployed contract address is configured.");
  const address = CONTRACT_ADDRESS;
  const client = createReadClient();
  return performRead(
    () => client.readContract({ address, functionName: "get_actions", args: [id] }),
    isActionArray,
    "get_actions returned a malformed response",
  );
}

/**
 * The integration surface. A timelock guard or executor bot reads exactly this,
 * so the frontend reads it the same way rather than inferring it from a review.
 */
export async function isVetoed(
  governor: string,
  proposalId: string,
): Promise<ReadResult<VetoState>> {
  if (!CONTRACT_ADDRESS) return unavailable("No deployed contract address is configured.");
  const address = CONTRACT_ADDRESS;
  const client = createReadClient();
  return performRead(
    () => client.readContract({
      address,
      functionName: "is_vetoed",
      args: [governor, BigInt(proposalId)],
    }),
    isVetoState,
    "is_vetoed returned a malformed response",
  );
}

/**
 * `stats()` — the contract's own summary of itself. Read for one field in
 * particular: `min_review_bond_wei` is the bond floor the forms enforce, and it
 * has to come from here rather than from a constant in the frontend.
 */
export async function getStats(): Promise<ReadResult<ContractStats>> {
  if (!CONTRACT_ADDRESS) return unavailable("No deployed contract address is configured.");
  const address = CONTRACT_ADDRESS;
  const client = createReadClient();
  return performRead(
    () => client.readContract({ address, functionName: "stats", args: [] }),
    isStats,
    "stats returned a malformed response",
  );
}

export async function getRebuttals(reviewId: string): Promise<ReadResult<Rebuttal[]>> {
  if (!CONTRACT_ADDRESS) return unavailable("No deployed contract address is configured.");
  const address = CONTRACT_ADDRESS;
  const client = createReadClient();
  return performRead(
    () => client.readContract({ address, functionName: "get_rebuttals", args: [reviewId] }),
    isRebuttalArray,
    "get_rebuttals returned a malformed response",
  );
}

export async function getRebuttal(id: string): Promise<ReadResult<Rebuttal>> {
  if (!CONTRACT_ADDRESS) return unavailable("No deployed contract address is configured.");
  const address = CONTRACT_ADDRESS;
  const client = createReadClient();
  const result = await performRead(
    () => client.readContract({ address, functionName: "get_rebuttal", args: [id] }),
    isRebuttalOrEmpty,
    "get_rebuttal returned a malformed response",
  );
  if (result.kind !== "AVAILABLE") return result;
  return Object.keys(result.value).length === 0 ? notFound() : available(result.value as Rebuttal);
}

/* ------------------------------------------------------------------------- */
/* Writes                                                                     */
/* ------------------------------------------------------------------------- */

export async function writeContract(
  client: Client,
  functionName: string,
  args: CalldataEncodable[],
  value: bigint,
) {
  if (!CONTRACT_ADDRESS) throw new Error("No deployed contract address is configured.");
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value,
    consensusMaxRotations: 3,
  });
  return hash as TransactionHash;
}

/**
 * View calls fail loudly for reasons that are not errors from the page's point of
 * view — an id that does not exist yet, a rate-limited public endpoint, a pool
 * that is momentarily full. Those become `undefined`; anything else is rethrown,
 * because swallowing a real fault would be a worse lie than showing it.
 */
async function readMaybe<T>(read: () => Promise<unknown>): Promise<T | undefined> {
  try {
    return (await read()) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("execution failed") ||
      message.includes("Missing or invalid parameters") ||
      message.includes("Rate limit exceeded") ||
      message.includes("QueuePool limit") ||
      message.includes("Unexpected token")
    ) {
      return undefined;
    }
    throw error;
  }
}

function hasStrings(value: Record<string, unknown>, keys: string[]) {
  return keys.every((key) => typeof value[key] === "string");
}

function isReview(value: unknown): value is Review {
  return isRecord(value) && hasStrings(value, ["id", "governor", "proposal_id", "status"]);
}
function isReviewOrEmpty(value: unknown): value is Review | Record<string, never> {
  return isRecord(value) && (Object.keys(value).length === 0 || isReview(value));
}
function isReviewArray(value: unknown): value is Review[] {
  return Array.isArray(value) && value.every(isReview);
}
function isAction(value: unknown): value is DecodedAction {
  return isRecord(value) && hasStrings(value, ["index", "target", "value", "selector"]);
}
function isActionArray(value: unknown): value is DecodedAction[] {
  return Array.isArray(value) && value.every(isAction);
}
function isRebuttal(value: unknown): value is Rebuttal {
  return isRecord(value) && hasStrings(value, ["id", "review_id", "status"]);
}
function isRebuttalOrEmpty(value: unknown): value is Rebuttal | Record<string, never> {
  return isRecord(value) && (Object.keys(value).length === 0 || isRebuttal(value));
}
function isRebuttalArray(value: unknown): value is Rebuttal[] {
  return Array.isArray(value) && value.every(isRebuttal);
}
function isVetoState(value: unknown): value is VetoState {
  return isRecord(value) && typeof value.vetoed === "boolean" &&
    typeof value.reviewed === "boolean" && hasStrings(value, ["status", "review_id", "note"]);
}
/**
 * `stats()` is validated on the one field the app actually acts on. A u256 arrives
 * as a decimal string, and anything that is not one is a malformed response rather
 * than a bond floor of zero.
 */
function isStats(value: unknown): value is ContractStats {
  return (
    isRecord(value) &&
    typeof value.min_review_bond_wei === "string" &&
    /^\d+$/.test(value.min_review_bond_wei)
  );
}

/**
 * Waits for finality, then re-reads the transaction and inspects the leader
 * receipt. A receipt arriving is not the same as the contract having succeeded:
 * a rolled-back write still finalizes.
 */
export type FinalizedExecution = {
  status: string;
  executionResult: "SUCCESS" | "ROLLBACK" | "ERROR" | "UNKNOWN";
  executionError?: string;
  /** The contract's own return value. A `[REJECTED]` one is a refusal, not a failure. */
  returned: ReturnedValue;
};

export async function getFinalizedExecution(client: Client, hash: TransactionHash): Promise<FinalizedExecution> {
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    interval: 5000,
    retries: 90,
  });
  const finalized = await client.getTransaction({ hash });
  const outcome = inspectGenVMExecution(finalized);
  return {
    status: String(receipt.statusName ?? receipt.status ?? "FINALIZED"),
    ...outcome,
    returned: returnedFromTransaction(finalized),
  };
}

export async function waitAccepted(client: Client, hash: TransactionHash) {
  const outcome = await getFinalizedExecution(client, hash);
  assertSuccessfulGenVMExecution(
    { consensus_data: { leader_receipt: [{ execution_result: outcome.executionResult, error: outcome.executionError ?? null }] } },
    hash,
  );
  return outcome;
}
