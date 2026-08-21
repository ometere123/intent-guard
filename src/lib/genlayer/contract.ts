import { TransactionStatus } from "genlayer-js/types";
import type { CalldataEncodable, GenLayerClient, TransactionHash } from "genlayer-js/types";
import { CONTRACT_ADDRESS, REQUIRED_METHODS } from "./config";
import { createReadClient } from "./read-client";
import type { DecodedAction, Rebuttal, Review, VetoState } from "../contract-types";

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

export async function listReviews(): Promise<Review[]> {
  if (!CONTRACT_ADDRESS) return [];
  const address = CONTRACT_ADDRESS;
  const client = createReadClient();
  return (
    (await readMaybe<Review[]>(() =>
      client.readContract({ address, functionName: "list_reviews", args: [0n, 200n] }),
    )) ?? []
  );
}

export async function getReview(id: string): Promise<Review | undefined> {
  if (!CONTRACT_ADDRESS) return undefined;
  const address = CONTRACT_ADDRESS;
  const client = createReadClient();
  return readMaybe<Review>(() =>
    client.readContract({ address, functionName: "get_review", args: [id] }),
  );
}

export async function getActions(id: string): Promise<DecodedAction[]> {
  if (!CONTRACT_ADDRESS) return [];
  const address = CONTRACT_ADDRESS;
  const client = createReadClient();
  return (
    (await readMaybe<DecodedAction[]>(() =>
      client.readContract({ address, functionName: "get_actions", args: [id] }),
    )) ?? []
  );
}

/**
 * The integration surface. A timelock guard or executor bot reads exactly this,
 * so the frontend reads it the same way rather than inferring it from a review.
 */
export async function isVetoed(
  governor: string,
  proposalId: string,
): Promise<VetoState | undefined> {
  if (!CONTRACT_ADDRESS) return undefined;
  const address = CONTRACT_ADDRESS;
  const client = createReadClient();
  return readMaybe<VetoState>(() =>
    client.readContract({
      address,
      functionName: "is_vetoed",
      args: [governor, BigInt(proposalId)],
    }),
  );
}

export async function getRebuttals(reviewId: string): Promise<Rebuttal[]> {
  if (!CONTRACT_ADDRESS) return [];
  const address = CONTRACT_ADDRESS;
  const client = createReadClient();
  return (
    (await readMaybe<Rebuttal[]>(() =>
      client.readContract({ address, functionName: "get_rebuttals", args: [reviewId] }),
    )) ?? []
  );
}

export async function getRebuttal(id: string): Promise<Rebuttal | undefined> {
  if (!CONTRACT_ADDRESS) return undefined;
  const address = CONTRACT_ADDRESS;
  const client = createReadClient();
  return readMaybe<Rebuttal>(() =>
    client.readContract({ address, functionName: "get_rebuttal", args: [id] }),
  );
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

/**
 * Waits for finality, then re-reads the transaction and inspects the leader
 * receipt. A receipt arriving is not the same as the contract having succeeded:
 * a rolled-back write still finalizes.
 */
export async function waitAccepted(client: Client, hash: TransactionHash) {
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    interval: 5000,
    retries: 90,
  });
  const finalized = await client.getTransaction({ hash });
  const result = finalized?.consensus_data?.leader_receipt?.[0]?.execution_result;
  if (result && result !== "SUCCESS") {
    throw new Error(`GenLayer contract execution failed (${result}). Transaction: ${hash}`);
  }
  return receipt;
}
