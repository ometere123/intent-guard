import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...value] = trimmed.split("=");
    process.env[key] ??= value.join("=");
  }
}

const [id, requestHash, reviewHash] = process.argv.slice(2);
if (!id || !requestHash || !reviewHash) {
  throw new Error("usage: node scripts/exercise-studionet.mjs <review-id> <request-tx-hash> <review-tx-hash>");
}
const address = process.env.NEXT_PUBLIC_INTENT_GUARD_CONTRACT;
if (!address) throw new Error("NEXT_PUBLIC_INTENT_GUARD_CONTRACT is not set");
const client = createClient({
  chain: studionet,
  endpoint: process.env.NEXT_PUBLIC_GENLAYER_ENDPOINT ?? "https://studio.genlayer.com/api",
});
const POLL_INTERVAL_MS = 5000;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function paced(label, operation, attempts = 5) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const rateLimited = /429|rate.?limit|queuepool/i.test(message);
      if (!rateLimited || attempt === attempts - 1) throw error;
      await pause(POLL_INTERVAL_MS * (attempt + 1));
    }
  }
  throw new Error(`${label} exhausted retries`);
}
async function finalized(hash, label) {
  const tx = await paced(`${label} transaction`, () => client.getTransaction({ hash }));
  // genlayer-js decorates the RPC's snake_case payload with a camelCase
  // `statusName`; the raw `status` beside it is a numeric enum ordinal. Reading
  // only `status_name` -- which the RPC never sends -- silently fell through to
  // that ordinal, so this check compared 7 against "FINALIZED" and could never
  // pass. Both spellings are accepted here, and the ordinal is refused outright
  // rather than stringified into a mismatch.
  const status = tx?.statusName ?? tx?.status_name;
  if (typeof status !== "string") {
    throw new Error(`${label} returned no status name (raw status ${String(tx?.status)}): ${hash}`);
  }
  if (status !== "FINALIZED") throw new Error(`${label} is not FINALIZED (${status}): ${hash}`);
  const leader = tx?.consensus_data?.leader_receipt?.[0];
  const execution = leader?.execution_result;
  if (execution !== "SUCCESS") throw new Error(`${label} finalized without GenVM SUCCESS (${execution ?? "missing"}): ${hash}`);
  return { tx, status, execution };
}
const requestFinal = await finalized(requestHash, "request_review");
await pause(POLL_INTERVAL_MS);
const reviewFinal = await finalized(reviewHash, "review");
await pause(POLL_INTERVAL_MS);
const review = await paced("read final review", () => client.readContract({ address, functionName: "get_review", args: [id] }));
if (!review || review.status === "PENDING") throw new Error(`review did not produce a semantic outcome: ${id}`);
await pause(POLL_INTERVAL_MS);
const actions = await paced("read actions", () => client.readContract({ address, functionName: "get_actions", args: [id] }));
await pause(POLL_INTERVAL_MS);
// Read the veto state for whichever proposal the review actually covers, taken
// from the review we just read rather than a fixed pair. Hardcoding them made
// this script silently report a different proposal's veto state for any id but
// the first one.
const veto = await paced("read veto", () => client.readContract({
  address,
  functionName: "is_vetoed",
  args: [review.governor, BigInt(review.proposal_id)],
}));
if (!veto || veto.reviewed !== true) throw new Error(`is_vetoed did not report reviewed state: ${id}`);
console.log(JSON.stringify({
  network: "studionet",
  contract: address,
  id,
  request: { hash: requestHash, status: requestFinal.status, execution: requestFinal.execution },
  reviewTx: { hash: reviewHash, status: reviewFinal.status, execution: reviewFinal.execution },
  storedStatus: review.status,
  verdict: review.status,
  gate: review.undecodable_gate ?? "",
  actionsDigest: review.actions_digest,
  mandateDigest: review.mandate_digest,
  veto,
  actions,
  review,
}, null, 2));
