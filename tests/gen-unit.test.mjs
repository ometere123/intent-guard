/**
 * The GEN unit, printed exactly once.
 *
 * `formatGen` carries its own unit: it returns `"0.001 GEN"`, not `"0.001"`. Six call
 * sites in this app appended a second literal " GEN" anyway, so the deployed ledger read
 * `bond 0.001 GEN GEN` on every record. Nothing failed, nothing threw, and no existing
 * test looked at the rendered string, which is exactly why it survived to production.
 *
 * The rule these tests enforce is the one the function's contract already implies:
 * whoever prints a GEN amount either calls `formatGen` or writes the unit, never both.
 * Getting it wrong is a rendering bug that no type can catch, so it is caught here.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { formatGen } from "../src/lib/format.ts";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

/** Every .ts/.tsx file under src/, as src-relative POSIX paths. */
function sourceFiles(dir = SRC, found = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (/\.tsx?$/.test(entry)) found.push(path.relative(SRC, full).split(path.sep).join("/"));
  }
  return found;
}

const FILES = sourceFiles();
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");

test("formatGen returns the amount with its unit attached", () => {
  assert.equal(formatGen("1000000000000000"), "0.001 GEN");
  assert.equal(formatGen("2000000000000000000"), "2 GEN");
  assert.equal(formatGen("0"), "0 GEN");
  assert.equal(formatGen(undefined), "0 GEN");
});

test("no call site appends a second GEN to what formatGen already printed", () => {
  // Matches `{formatGen(x)} GEN`, `{formatGen(x)} GEN,`, and the identifier form
  // `{bondText} GEN` where that identifier was assigned from formatGen in the same file.
  const offenders = [];

  for (const rel of FILES) {
    const text = read(rel);

    for (const hit of text.match(/formatGen\([^)]*\)\s*\}?\s*GEN\b/g) ?? []) {
      offenders.push(`${rel}: ${hit.replace(/\s+/g, " ")}`);
    }

    // An amount held in a local first, then printed. `formatGen` is the only thing in
    // this app that produces a GEN string, so any local assigned from it is one.
    for (const [, name] of text.matchAll(/const\s+(\w+)\s*=\s*formatGen\(/g)) {
      const printed = new RegExp(`\\{\\s*${name}\\s*\\}\\s*GEN\\b`, "g");
      for (const hit of text.match(printed) ?? []) {
        offenders.push(`${rel}: ${hit.replace(/\s+/g, " ")} (${name} came from formatGen)`);
      }
    }
  }

  assert.deepEqual(offenders, [], `these print the unit twice:\n  ${offenders.join("\n  ")}`);
});

test("every GEN amount in the app is printed through formatGen", () => {
  // The other direction: a hand-rolled `${wei / 10n ** 18n} GEN` would print correctly
  // today and drift the first time the token's scale is referenced somewhere else.
  const offenders = [];
  for (const rel of FILES) {
    if (rel === "lib/format.ts") continue; // where the scale is allowed to live
    const text = read(rel);
    for (const hit of text.match(/10n?\s*\*\*\s*18n?|1_?000_?000_?000_?000_?000_?000n?\b/g) ?? []) {
      offenders.push(`${rel}: ${hit}`);
    }
  }
  // minimum-bond.ts legitimately holds the scale to print an untrimmed opening bond.
  assert.deepEqual(offenders, ["lib/minimum-bond.ts: 10n ** 18n"], offenders.join("\n"));
});
