import assert from "node:assert/strict";
import test from "node:test";
import { performRead } from "../src/lib/genlayer/read-result.ts";

const isRows = (value) => Array.isArray(value) && value.every((row) => typeof row?.id === "string");

test("valid empty list remains AVAILABLE, not unavailable", async () => {
  assert.deepEqual(await performRead(async () => [], isRows, "bad rows"), { kind: "AVAILABLE", value: [] });
});

test("RPC and rate-limit failures remain UNAVAILABLE", async () => {
  for (const message of ["network unavailable", "429 rate limit", "QueuePool limit"]) {
    const result = await performRead(async () => { throw new Error(message); }, isRows, "bad rows");
    assert.equal(result.kind, "UNAVAILABLE");
    assert.match(result.error, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("malformed and schema-mismatched values remain INVALID_RESPONSE", async () => {
  for (const value of [null, {}, [{ nope: true }], "[]"]) {
    assert.deepEqual(await performRead(async () => value, isRows, "bad rows"), { kind: "INVALID_RESPONSE", error: "bad rows" });
  }
});
