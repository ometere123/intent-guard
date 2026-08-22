/**
 * The fixture gate, enforced rather than asserted.
 *
 * `src/lib/genlayer/data-source.ts` claims in its own header comment to be "the one
 * gate between fixtures and the deployed contract", and that "every page and
 * component in the app reads through this module and nothing else". That is the kind
 * of claim that is true on the day it is written and quietly false six commits later,
 * when someone imports a fixture constant directly to get a page rendering.
 *
 * These tests read the real sources and fail if the claim stops holding: the fixture
 * modules may be reached from the gate and nowhere else, and no reader in the gate may
 * return a fixture without first checking that live mode is off.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const GATE = "lib/genlayer/data-source.ts";
const FIXTURE_MODULES = ["lib/mock-data.ts", "lib/mock-actions.ts"];

/** Every .ts/.tsx file under src/, as repo-relative POSIX paths. */
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

test("the app has the source layout these tests assume", () => {
  assert.ok(FILES.length > 20, `only found ${FILES.length} source files`);
  for (const rel of [GATE, ...FIXTURE_MODULES]) {
    assert.ok(FILES.includes(rel), `${rel} is missing`);
  }
});

test("the fixture modules are reachable only from the gate", () => {
  const importers = { "lib/mock-data.ts": [], "lib/mock-actions.ts": [] };
  for (const rel of FILES) {
    const text = read(rel);
    // Match the module specifier of a real import, not a mention in prose.
    for (const spec of text.match(/^\s*import[\s\S]*?from\s+"([^"]+)"/gm) ?? []) {
      const target = spec.match(/from\s+"([^"]+)"$/)?.[1] ?? "";
      if (/(^|\/)mock-data$/.test(target)) importers["lib/mock-data.ts"].push(rel);
      if (/(^|\/)mock-actions$/.test(target)) importers["lib/mock-actions.ts"].push(rel);
    }
  }
  assert.deepEqual(importers["lib/mock-data.ts"], [GATE]);
  assert.deepEqual(importers["lib/mock-actions.ts"], ["lib/mock-data.ts"]);
});

test("no page or component names a fixture constant", () => {
  for (const rel of FILES) {
    if (rel === GATE || FIXTURE_MODULES.includes(rel)) continue;
    assert.doesNotMatch(read(rel), /\bMOCK_[A-Z_]+\b/, `${rel} reaches past the gate`);
  }
});

test("every fixture return in the gate sits behind the live check", () => {
  const gate = read(GATE);
  const lines = gate.split("\n");
  let seenLiveCheck = false;
  let fixtureUses = 0;

  for (const [index, line] of lines.entries()) {
    if (/^import\b/.test(line)) continue; // the import names them; it does not read them
    if (/^export (async )?function /.test(line)) seenLiveCheck = false;
    if (/\bIS_LIVE\b/.test(line)) seenLiveCheck = true;
    if (!/\bMOCK_[A-Z_]+\b/.test(line)) continue;
    fixtureUses += 1;
    assert.ok(
      seenLiveCheck,
      `${GATE}:${index + 1} reads a fixture before checking IS_LIVE: ${line.trim()}`,
    );
  }

  assert.ok(fixtureUses >= 6, `expected the gate to serve several fixture reads, saw ${fixtureUses}`);
});

test("the bond floor has no fixture branch that invents a number", () => {
  const gate = read(GATE);
  const body = gate.slice(gate.indexOf("export async function minimumReviewBond"));
  const fn = body.slice(0, body.indexOf("\nexport "));
  assert.doesNotMatch(fn, /\bMOCK_/, "the minimum bond must never come from fixtures");
  assert.match(fn, /min_review_bond_wei/, "the minimum bond must come from contract stats");
  assert.match(fn, /kind: "unreadable"/, "fixture mode must report the minimum as unreadable");
});

test("live mode is decided in one place and the banner cannot lie about it", () => {
  const config = read("lib/genlayer/config.ts");
  assert.match(config, /export const IS_LIVE/);
  // A requested-but-unconfigured live mode must resolve to fixtures with that stated.
  const gate = read(GATE);
  assert.match(gate, /DATA_MODE === "live"/);
  assert.match(gate, /Live mode is requested but no contract address is configured/);
  assert.match(gate, /Nothing here is on-chain state\./);
});
