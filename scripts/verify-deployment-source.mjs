import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../DEPLOYMENT.json", import.meta.url), "utf8"));
const bytes = readFileSync(new URL(`../${manifest.contractFile}`, import.meta.url));
const actual = createHash("sha256").update(bytes).digest("hex");
if (actual !== manifest.contractSha256) {
  console.error(JSON.stringify({ ok: false, expected: manifest.contractSha256, actual }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, contract: manifest.contract, contractSha256: actual, deployedSourceVerified: manifest.deployedSourceVerified, note: manifest.verificationNote }, null, 2));
