import assert from "node:assert/strict";
import test from "node:test";
import { rejectionIn, rejectionReason, returnedValue, returnedFromTransaction } from "../src/lib/genlayer/returned-value.ts";

/**
 * A refused payable call finalizes with GenVM SUCCESS. That is the whole reason this
 * decoder exists, and the reason these tests hold the line between a returned
 * `[REJECTED]` and a revert carrying the same words: the first means the bond came
 * back, the second means it did not.
 *
 * The decoded shapes below are the ones StudioNet actually produced, taken from saved
 * Recourse transactions rather than invented: a returned determination id arrives as
 * `payload.readable` with the JSON quotes still on it, and a raise arrives as a
 * rollback whose payload is the contract's own sentence.
 */

const returned = (readable) => ({
  raw: "AAAA",
  status: "return",
  payload: { raw: [0], readable },
});
const rollback = (message) => ({ raw: "AQAA", status: "rollback", payload: message });

/* --- what a successful call looks like ------------------------------------- */

test("a returned determination id is read as a plain string", () => {
  assert.deepEqual(returnedValue(returned('"d2"')), { kind: "returned", text: "d2" });
  assert.equal(rejectionIn(returned('"d2"')), undefined);
});

test("a returned review id is not mistaken for a refusal", () => {
  assert.equal(rejectionIn(returned('"IG-PROOF-2"')), undefined);
});

test("a call that returns nothing is a return, not an unreadable receipt", () => {
  assert.deepEqual(returnedValue({ raw: "BA==", status: "none", payload: null }), {
    kind: "returned",
    text: "",
  });
  assert.deepEqual(returnedValue({ raw: "AA==", status: "return", payload: null }), {
    kind: "returned",
    text: "",
  });
});

/* --- what a refusal looks like -------------------------------------------- */

test("a returned [REJECTED] is a refusal, and the reason survives intact", () => {
  const receipt = returned('"[REJECTED] Review bond below the minimum of 1000000000000000 wei"');
  assert.deepEqual(returnedValue(receipt), {
    kind: "returned",
    text: "[REJECTED] Review bond below the minimum of 1000000000000000 wei",
  });
  assert.equal(
    rejectionIn(receipt),
    "Review bond below the minimum of 1000000000000000 wei",
  );
});

test("a refusal with no reason still reports as a refusal", () => {
  assert.equal(rejectionIn(returned('"[REJECTED]"')), "no reason was given");
  assert.equal(rejectionIn(returned('"[REJECTED]   "')), "no reason was given");
});

test("the prefix is only honoured at the start of the returned value", () => {
  assert.equal(rejectionIn(returned('"the string [REJECTED] appeared in evidence"')), undefined);
});

/* --- a revert is not a refusal -------------------------------------------- */

test("a rollback is reverted, carrying the contract's own words", () => {
  const receipt = rollback("[EXPECTED] The appeal window for d1 is open until 2026-08-28T14:03:52Z");
  assert.deepEqual(returnedValue(receipt), {
    kind: "reverted",
    message: "[EXPECTED] The appeal window for d1 is open until 2026-08-28T14:03:52Z",
  });
  assert.equal(rejectionIn(receipt), undefined);
});

test("a revert carrying [REJECTED] is still a revert", () => {
  // The two differ in what happened to the caller's GEN. Reporting a revert as a
  // tidy refund would be the exact lie this separation exists to prevent.
  const receipt = rollback("[REJECTED] something raised instead of refunding");
  assert.equal(returnedValue(receipt).kind, "reverted");
  assert.equal(rejectionIn(receipt), undefined);
});

test("contract_error and error are reverts too", () => {
  assert.equal(returnedValue({ status: "contract_error", payload: "boom" }).kind, "reverted");
  assert.equal(returnedValue({ status: "error", payload: "boom" }).kind, "reverted");
});

/* --- the undecoded form --------------------------------------------------- */

test("a raw base64 result is decoded by its leading result code", () => {
  // Code 0 is a return, and a calldata string is length-prefixed, so the text does
  // not begin at byte one. Code 1 is a rollback whose remainder is the raw message.
  assert.equal(rejectionIn(base64(0, "[REJECTED] duplicate id")), "duplicate id");
  assert.deepEqual(returnedValue(base64(1, "[EXPECTED] window still open")), {
    kind: "reverted",
    message: "[EXPECTED] window still open",
  });
  assert.deepEqual(returnedValue(base64(4, "")), { kind: "returned", text: "" });
});

test("a raw return with no rejection prefix keeps its decoded bytes", () => {
  assert.equal(returnedValue(base64(0, "d2")).kind, "returned");
  assert.equal(rejectionIn(base64(0, "d2")), undefined);
});

test("an object that only carries raw base64 falls back to decoding it", () => {
  const receipt = { raw: base64(1, "[EXPECTED] refused") };
  assert.deepEqual(returnedValue(receipt), {
    kind: "reverted",
    message: "[EXPECTED] refused",
  });
});

/* --- nothing readable ----------------------------------------------------- */

test("a missing or unrecognised receipt is unreadable, never a silent success", () => {
  for (const value of [undefined, null, 7, [], { status: "return", payload: 42 }, { status: "?" }]) {
    assert.deepEqual(returnedValue(value), { kind: "unreadable" }, `${JSON.stringify(value)}`);
  }
  assert.deepEqual(returnedValue("not base64 at all !!!"), { kind: "unreadable" });
  assert.deepEqual(returnedValue(""), { kind: "unreadable" });
});

test("an unreadable receipt is not reported as a refusal", () => {
  assert.equal(rejectionReason({ kind: "unreadable" }), undefined);
  assert.equal(rejectionReason({ kind: "reverted", message: "[REJECTED] x" }), undefined);
});

/* --- the whole transaction ------------------------------------------------ */

test("a finalized transaction's refusal is found on its leader receipt", () => {
  const transaction = {
    statusName: "FINALIZED",
    consensus_data: {
      leader_receipt: [
        { execution_result: "SUCCESS", result: returned('"[REJECTED] Unsupported governor"') },
      ],
    },
  };
  // GenVM SUCCESS and a refusal at the same time. This is the case the whole
  // module exists for, and the one a status-only check would get wrong.
  assert.equal(rejectionReason(returnedFromTransaction(transaction)), "Unsupported governor");
});

test("a finalized success carries its returned id, not a refusal", () => {
  const transaction = {
    consensus_data: {
      leader_receipt: [{ execution_result: "SUCCESS", result: returned('"IG-PROOF-2"') }],
    },
  };
  assert.deepEqual(returnedFromTransaction(transaction), { kind: "returned", text: "IG-PROOF-2" });
  assert.equal(rejectionReason(returnedFromTransaction(transaction)), undefined);
});

test("a transaction with no consensus data is unreadable rather than accepted", () => {
  for (const value of [
    undefined,
    {},
    { consensus_data: null },
    { consensus_data: { leader_receipt: [] } },
  ]) {
    assert.deepEqual(returnedFromTransaction(value), { kind: "unreadable" });
  }
});

/** One result code byte followed by a body, as the receipt carries it. */
function base64(code, body) {
  const bytes = Buffer.concat([Buffer.from([code]), Buffer.from(body, "utf8")]);
  return bytes.toString("base64");
}
