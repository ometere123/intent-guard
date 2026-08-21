import assert from "node:assert/strict";
import test from "node:test";
import { assertSuccessfulGenVMExecution, inspectGenVMExecution } from "../src/lib/genlayer/execution.ts";

for (const [name, tx, expected] of [
  ["SUCCESS is explicit", { consensus_data: { leader_receipt: [{ execution_result: "SUCCESS" }] } }, "SUCCESS"],
  ["ROLLBACK fails closed", { consensus_data: { leader_receipt: [{ execution_result: "ROLLBACK" }] } }, "ROLLBACK"],
  ["ERROR fails closed", { consensus_data: { leader_receipt: [{ execution_result: "ERROR" }] } }, "ERROR"],
  ["missing execution_result fails closed", { consensus_data: { leader_receipt: [{}] } }, "UNKNOWN"],
  ["malformed execution_result fails closed", { consensus_data: { leader_receipt: [{ execution_result: 7 }] } }, "UNKNOWN"],
  ["missing receipt fails closed", { consensus_data: {} }, "UNKNOWN"],
  ["missing transaction fails closed", undefined, "UNKNOWN"],
  ["malformed transaction fails closed", "bad", "UNKNOWN"],
]) test(name, () => assert.equal(inspectGenVMExecution(tx).executionResult, expected));

test("only SUCCESS satisfies application success", () => {
  assert.doesNotThrow(() => assertSuccessfulGenVMExecution({ consensus_data: { leader_receipt: [{ execution_result: "SUCCESS" }] } }, "0xsuccess"));
  for (const execution_result of ["ROLLBACK", "ERROR", undefined, "MALFORMED"]) {
    assert.throws(() => assertSuccessfulGenVMExecution({ consensus_data: { leader_receipt: [{ execution_result }] } }, "0xfail"), /execution failed/);
  }
});
