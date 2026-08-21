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
const hash = await client.writeContract({
  address,
  functionName: "request_review",
  args: [id, "0x408ED6354d4973f66138C91495F2f2FCbd8724C3", 100n, 25554834n],
  value: 1_000_000_000_000_000n,
});
const receipt = await client.waitForTransactionReceipt({ hash, status: "ACCEPTED", interval: 10000, retries: 90 });
const reviewHash = await client.writeContract({ address, functionName: "review", args: [id], value: 0n });
const reviewReceipt = await client.waitForTransactionReceipt({ hash: reviewHash, status: "ACCEPTED", interval: 10000, retries: 120 });
const review = await client.readContract({ address, functionName: "get_review", args: [id] });
console.log(JSON.stringify({
  id,
  request: { hash, status: receipt.status_name ?? receipt.status, execution: receipt.consensus_data?.leader_receipt?.[0]?.execution_result },
  reviewTx: { hash: reviewHash, status: reviewReceipt.status_name ?? reviewReceipt.status, execution: reviewReceipt.consensus_data?.leader_receipt?.[0]?.execution_result },
  review,
}, null, 2));
