import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

function decryptKeystore(path, password) {
  const ks = JSON.parse(readFileSync(path, "utf8"));
  const c = ks.Crypto || ks.crypto;
  const k = c.kdfparams;
  const derived = crypto.scryptSync(Buffer.from(password), Buffer.from(k.salt, "hex"), k.dklen, {
    N: k.n,
    r: k.r,
    p: k.p,
    maxmem: 1024 * 1024 * 1024,
  });
  const decipher = crypto.createDecipheriv(
    "aes-128-ctr",
    derived.subarray(0, 16),
    Buffer.from(c.cipherparams.iv, "hex"),
  );
  return `0x${Buffer.concat([decipher.update(Buffer.from(c.ciphertext, "hex")), decipher.final()]).toString("hex")}`;
}

const [keystore, password] = process.argv.slice(2);
if (!keystore || !password) throw new Error("usage: node scripts/exercise-studionet.mjs <keystore> <password>");
const address = process.env.NEXT_PUBLIC_INTENT_GUARD_CONTRACT;
if (!address) throw new Error("NEXT_PUBLIC_INTENT_GUARD_CONTRACT is not set");
const client = createClient({
  chain: studionet,
  account: createAccount(decryptKeystore(keystore, password)),
  endpoint: process.env.NEXT_PUBLIC_GENLAYER_ENDPOINT ?? "https://studio.genlayer.com/api",
});
const id = `ig-live-${Date.now()}`;
const MIN_REVIEW_BOND_WEI = 1_000_000_000_000_000n;
async function finalized(hash, label) {
  const receipt = await client.waitForTransactionReceipt({ hash, status: "FINALIZED", interval: 10000, retries: 120 });
  const tx = await client.getTransaction({ hash });
  const leader = tx?.consensus_data?.leader_receipt?.[0];
  const execution = leader?.execution_result;
  if (execution !== "SUCCESS") throw new Error(`${label} finalized without GenVM SUCCESS (${execution ?? "missing"}): ${hash}`);
  return { receipt, tx, execution };
}
const hash = await client.writeContract({
  address,
  functionName: "request_review",
  args: [id, "0x408ED6354d4973f66138C91495F2f2FCbd8724C3", 100n, 25554834n],
  value: MIN_REVIEW_BOND_WEI,
});
const requestFinal = await finalized(hash, "request_review");
const pending = await client.readContract({ address, functionName: "get_review", args: [id] });
if (!pending || pending.status !== "PENDING") throw new Error(`request_review did not store PENDING review: ${id}`);
const reviewHash = await client.writeContract({ address, functionName: "review", args: [id], value: 0n });
const reviewFinal = await finalized(reviewHash, "review");
const review = await client.readContract({ address, functionName: "get_review", args: [id] });
const actions = await client.readContract({ address, functionName: "get_actions", args: [id] });
const veto = await client.readContract({ address, functionName: "is_vetoed", args: ["0x408ED6354d4973f66138C91495F2f2FCbd8724C3", 100n] });
if (!review || review.status === "PENDING") throw new Error(`review did not produce a semantic outcome: ${id}`);
if (!veto || veto.reviewed !== true) throw new Error(`is_vetoed did not report reviewed state: ${id}`);
console.log(JSON.stringify({
  network: "studionet",
  contract: address,
  id,
  request: { hash, status: requestFinal.receipt.status_name ?? requestFinal.receipt.status, execution: requestFinal.execution },
  reviewTx: { hash: reviewHash, status: reviewFinal.receipt.status_name ?? reviewFinal.receipt.status, execution: reviewFinal.execution },
  storedStatus: review.status,
  verdict: review.status,
  gate: review.undecodable_gate ?? "",
  actionsDigest: review.actions_digest,
  mandateDigest: review.mandate_digest,
  veto,
  actions,
  review,
}, null, 2));
