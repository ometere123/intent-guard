import assert from "node:assert/strict";
import test from "node:test";
import { applyTransactionSnapshot, normalizeStoredTransactions, shouldRefreshTransaction } from "../src/lib/transaction-state.ts";

const base = { hash: "0xabc", label: "review", createdAt: "2026-08-21T10:00:00.000Z", status: "ACCEPTED", functionName: "review", reviewId: "IG-1" };

test("persisted ACCEPTED restores as ACCEPTED", () => assert.equal(normalizeStoredTransactions([base], Date.parse("2026-08-21T10:30:00Z"))[0].status, "ACCEPTED"));
test("restored ACCEPTED resumes polling", () => assert.equal(shouldRefreshTransaction(base, Date.parse("2026-08-21T10:30:00Z")), true));
test("ACCEPTED can transition to FINALIZED plus SUCCESS", () => { const result = applyTransactionSnapshot(base, { statusName: "FINALIZED", consensus_data: { leader_receipt: [{ execution_result: "SUCCESS" }] } }); assert.equal(result.status, "FINALIZED"); assert.equal(result.executionResult, "SUCCESS"); });
test("ACCEPTED can transition to FINALIZED plus ROLLBACK", () => { const result = applyTransactionSnapshot(base, { statusName: "FINALIZED", consensus_data: { leader_receipt: [{ execution_result: "ROLLBACK" }] } }); assert.equal(result.status, "FINALIZED"); assert.equal(result.executionResult, "ROLLBACK"); });
test("ACCEPTED alone never marks the write successful", () => { const result = applyTransactionSnapshot(base, { statusName: "ACCEPTED" }); assert.equal(result.status, "ACCEPTED"); assert.equal(result.executionResult, undefined); });
test("retryable network failure preserves ACCEPTED", () => assert.deepEqual(applyTransactionSnapshot(base, undefined), base));
test("malformed snapshots preserve last known state", () => { assert.deepEqual(applyTransactionSnapshot(base, { statusName: 9 }), base); assert.deepEqual(applyTransactionSnapshot(base, "malformed"), base); });
test("old ACCEPTED becomes UNDETERMINED only after the stale deadline", () => assert.equal(normalizeStoredTransactions([base], Date.parse("2026-08-21T13:00:00Z"))[0].status, "UNDETERMINED"));
