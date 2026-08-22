import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bondRefusal, minimumBondLabel, openingBond } from "../src/lib/minimum-bond.ts";

/**
 * The bond floor belongs to the contract. These tests hold the frontend to that:
 * the boundary moves when the contract's figure moves, a floor that has not been
 * read yet blocks the write rather than waving it through, and no number in this
 * suite is also written down in the app.
 */

const MIN = 1_000_000_000_000_000n; // 0.001 GEN, what the deployed contract publishes
const known = (wei) => ({ kind: "known", wei });
const deployed = known(MIN);

test("a zero bond is refused, and the refusal states the contract's figure", () => {
  const refusal = bondRefusal("0", deployed);
  assert.match(refusal, /at least 0\.001 GEN/);
  assert.match(refusal, /read from the contract/);
});

test("a hundredth of the minimum is refused", () => {
  assert.match(bondRefusal("0.0001", deployed), /at least 0\.001 GEN/);
});

test("one wei below the minimum is refused", () => {
  assert.match(bondRefusal("0.000999999999999999", deployed), /at least 0\.001 GEN/);
});

test("0.000999 is refused, which is the case a bond-above-zero check would have passed", () => {
  assert.match(bondRefusal("0.000999", deployed), /would refuse 0\.0009 GEN/);
});

test("exactly the minimum is allowed", () => {
  assert.equal(bondRefusal("0.001", deployed), null);
});

test("more than the minimum is allowed", () => {
  assert.equal(bondRefusal("2", deployed), null);
  assert.equal(bondRefusal("0.0011", deployed), null);
});

test("the boundary is the contract's number, not this page's", () => {
  // The same bond, judged against two different contracts. If the threshold were
  // written down in the frontend, these two lines could not disagree.
  assert.equal(bondRefusal("0.001", known(MIN)), null);
  assert.match(bondRefusal("0.001", known(2n * 10n ** 18n)), /at least 2 GEN/);
  assert.equal(bondRefusal("2", known(2n * 10n ** 18n)), null);
});

test("a minimum that has not arrived yet blocks the write", () => {
  const refusal = bondRefusal("5", { kind: "reading" });
  assert.match(refusal, /has not been read yet/);
});

test("a minimum that could not be read blocks the write, and says why", () => {
  const refusal = bondRefusal("5", {
    kind: "unreadable",
    reason: "the stats read was unavailable (rate limited).",
  });
  assert.match(refusal, /could not be read/);
  assert.match(refusal, /rate limited/);
  assert.match(refusal, /No signature was requested/);
});

test("an unreadable minimum blocks even a generous bond", () => {
  assert.notEqual(bondRefusal("1000", { kind: "unreadable", reason: "no contract." }), null);
});

test("a bond that is not a number is refused before the minimum is consulted", () => {
  assert.match(bondRefusal("two GEN", deployed), /decimal amount of GEN/);
  assert.match(bondRefusal("two GEN", { kind: "reading" }), /decimal amount of GEN/);
});

test("the label beside the field prints the contract's figure", () => {
  assert.equal(minimumBondLabel(deployed), "Minimum bond: 0.001 GEN");
  assert.equal(minimumBondLabel(known(2n * 10n ** 18n)), "Minimum bond: 2 GEN");
  assert.match(minimumBondLabel({ kind: "reading" }), /reading it from the contract/);
  assert.match(minimumBondLabel({ kind: "unreadable", reason: "x" }), /could not be read/);
});

test("an untouched field opens at the contract's floor, and its own value would be accepted", () => {
  assert.equal(openingBond(deployed, "0.001"), "0.001");
  assert.equal(openingBond(known(2n * 10n ** 18n), "0.001"), "2");
  // Whatever the field opens at has to be a bond the contract would take, or the
  // form opens already refusing itself. Including a floor with more decimals than
  // the display format trims to, which is where a formatted figure would fall short.
  for (const wei of [MIN, 2n * 10n ** 18n, 5n * 10n ** 15n, 123_456_789_012_345_678n, 1n]) {
    assert.equal(bondRefusal(openingBond(known(wei), "0.001"), known(wei)), null, `${wei}`);
  }
});

test("before the contract answers, the field opens at the fallback and stays blocked", () => {
  assert.equal(openingBond({ kind: "reading" }, "0.001"), "0.001");
  assert.equal(openingBond({ kind: "unreadable", reason: "x" }, "0.001"), "0.001");
  assert.notEqual(bondRefusal(openingBond({ kind: "reading" }, "0.001"), { kind: "reading" }), null);
});

/* --------------------------------------------------------------------------- *
 * The floor is not written down anywhere in the app.
 *
 * A source scan rather than a behavioural check, because the failure it guards
 * against is someone reintroducing the constant for convenience. The form is
 * allowed to open at 0.001 as a starting value in a text box; it is not allowed
 * to contain the wei figure, and it is not allowed to open at 2 GEN.
 * --------------------------------------------------------------------------- */

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("no frontend file carries the minimum as a wei literal", () => {
  for (const path of [
    "../src/lib/minimum-bond.ts",
    "../src/components/request-review-form.tsx",
    "../src/components/use-minimum-bond.ts",
    "../src/lib/genlayer/data-source.ts",
  ]) {
    const text = source(path);
    assert.doesNotMatch(text, /1000000000000000/, `${path} hardcodes the minimum in wei`);
    assert.doesNotMatch(text, /10\s*\*\*\s*15/, `${path} hardcodes the minimum as a power of ten`);
  }
});

test("the request form reads the minimum from the contract and opens at it", () => {
  const form = source("../src/components/request-review-form.tsx");
  assert.match(form, /useMinimumBond\(\)/, "the form does not read the contract minimum");
  assert.match(form, /bondRefusal\(bond, minimum\)/, "the form does not enforce the minimum");
  assert.match(form, /OPENING_BOND = "0\.001"/, "the form does not open at 0.001 GEN");
  assert.match(
    form,
    /openingBond\(minimum, OPENING_BOND\)/,
    "the form does not adopt the contract's floor once it is read",
  );
  assert.doesNotMatch(
    form,
    /useState\("2"\)|useState\("100"\)/,
    "the form still defaults to the old bond",
  );
});

test("the minimum is sourced from stats().min_review_bond_wei", () => {
  const dataSource = source("../src/lib/genlayer/data-source.ts");
  assert.match(dataSource, /min_review_bond_wei/);
  assert.match(dataSource, /kind: "unreadable"/, "an unreadable stats call must not become zero");
});
