import { createAccount, createClient } from "genlayer-js";
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

const address = process.env.NEXT_PUBLIC_INTENT_GUARD_CONTRACT;
const required = [
  "request_review", "fund_bounty_pool", "review", "rereview", "rebut",
  "adjudicate_rebuttal", "expire_rebuttal_window", "clear_veto_by_vote",
  "get_review", "get_actions", "list_reviews", "get_rebuttal", "get_rebuttals",
  "is_vetoed", "supported_governors", "verify_event_topic", "decoder_fingerprint",
  "keccak_self_test", "decoder_self_test", "stats",
];

if (!address) {
  console.error("NEXT_PUBLIC_INTENT_GUARD_CONTRACT is not set.");
  process.exit(1);
}

const client = createClient({
  chain: studionet,
  account: createAccount(),
  endpoint: process.env.NEXT_PUBLIC_GENLAYER_ENDPOINT ?? "https://studio.genlayer.com/api",
});
const schema = await client.getContractSchema(address);
const missing = required.filter((method) => !schema.methods?.[method]);
if (missing.length) {
  console.error(`Missing methods: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`Intent Guard schema verified for ${address} (${required.length} methods).`);
