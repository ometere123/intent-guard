import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

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
  const status = tx?.status_name ?? tx?.status;
  if (status !== "FINALIZED") throw new Error(`${label} is not FINALIZED (${status ?? "missing"}): ${hash}`);
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
await pause(POLL_INTERVAL_MS);
const actions = await paced("read actions", () => client.readContract({ address, functionName: "get_actions", args: [id] }));
await pause(POLL_INTERVAL_MS);
const veto = await paced("read veto", () => client.readContract({ address, functionName: "is_vetoed", args: ["0x408ED6354d4973f66138C91495F2f2FCbd8724C3", 100n] }));
if (!review || review.status === "PENDING") throw new Error(`review did not produce a semantic outcome: ${id}`);
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
