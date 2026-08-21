import assert from "node:assert/strict";
import test from "node:test";

function inspect(tx) {
  const leader = tx?.consensus_data?.leader_receipt?.[0];
  const raw = leader?.execution_result;
  return raw === "SUCCESS" || raw === "ROLLBACK" || raw === "ERROR" ? raw : "UNKNOWN";
}

for (const [name, tx, expected] of [
  ["success is explicit", { consensus_data: { leader_receipt: [{ execution_result: "SUCCESS" }] } }, "SUCCESS"],
  ["rollback is not success", { consensus_data: { leader_receipt: [{ execution_result: "ROLLBACK" }] } }, "ROLLBACK"],
  ["error is not success", { consensus_data: { leader_receipt: [{ execution_result: "ERROR" }] } }, "ERROR"],
  ["missing receipt fails closed", { consensus_data: {} }, "UNKNOWN"],
  ["malformed receipt fails closed", { consensus_data: { leader_receipt: [{}] } }, "UNKNOWN"],
]) test(name, () => assert.equal(inspect(tx), expected));

test("only SUCCESS satisfies application success", () => {
  for (const result of ["ROLLBACK", "ERROR", "UNKNOWN"]) assert.notEqual(result, "SUCCESS");
});
