/**
 * The bond floor, taken from the contract instead of written down here.
 *
 * The contract's `MIN_REVIEW_BOND_WEI` is the only authority on what a bond has to
 * be, and `stats()` publishes it as `min_review_bond_wei`. This module deliberately
 * contains no number: it takes whatever the contract said and compares against that.
 * A copy of the constant kept in the frontend would be correct until the day the
 * contract was redeployed with a different one, and then it would be a form that
 * cheerfully collects a signature the contract is going to refuse.
 *
 * Failing closed is the other half. If the minimum has not arrived yet, or could not
 * be read at all, that is not treated as "no minimum" — the write is refused in this
 * browser, because a bond validated against nothing is not validated.
 */

import { formatGen, genToWei } from "./format.ts";

/** One GEN in wei. The token's own scale, not a policy figure. */
const WEI = 10n ** 18n;

export type MinimumBond =
  /** `stats()` answered. `wei` is what the contract will accept, inclusive. */
  | { kind: "known"; wei: bigint }
  /** The read is in flight. Nothing can be signed yet. */
  | { kind: "reading" }
  /** The read failed, or there is no contract to read. Nothing can be signed. */
  | { kind: "unreadable"; reason: string };

/**
 * Why this bond cannot be submitted, in plain language, or null if it can.
 *
 * Pure, and takes the minimum as an argument rather than fetching it, so the same
 * function can be tested against several different minimums. That is the property
 * worth having: change the contract's floor and the refusal moves with it.
 */
export function bondRefusal(bond: string, minimum: MinimumBond): string | null {
  let bondWei: bigint;
  try {
    bondWei = genToWei(bond);
  } catch {
    return "A bond is a decimal amount of GEN, for example 0.001 or 2.5.";
  }

  if (minimum.kind === "reading") {
    return "The contract's minimum bond has not been read yet. Nothing is signed until it is, because a bond checked against nothing is not checked.";
  }
  if (minimum.kind === "unreadable") {
    return `The contract's minimum bond could not be read: ${minimum.reason} Rather than guess at the figure, this write is refused here. No signature was requested.`;
  }

  if (bondWei < minimum.wei) {
    return `The contract requires at least ${formatGen(minimum.wei.toString())}, and would refuse ${formatGen(bondWei.toString())}. That minimum is read from the contract, not set by this page.`;
  }
  return null;
}

/** What the field says the floor is. Never a literal, so it cannot drift. */
export function minimumBondLabel(minimum: MinimumBond): string {
  if (minimum.kind === "known") return `Minimum bond: ${formatGen(minimum.wei.toString())}`;
  if (minimum.kind === "reading") return "Minimum bond: reading it from the contract";
  return "Minimum bond: could not be read from the contract";
}

/**
 * What an untouched bond field shows: the contract's own floor once it is known, and
 * `fallback` until then. Derived rather than stored, so the field adopts the contract's
 * figure the moment `stats()` answers without a second render writing over anything
 * the person has typed.
 *
 * Rendered at full precision rather than through `formatGen`, which trims to four
 * decimals for display. A trimmed figure would be *below* a minimum with more decimals
 * than that, and a field that opens at a bond the contract would refuse is worse than
 * one that opens blank.
 */
export function openingBond(minimum: MinimumBond, fallback: string): string {
  if (minimum.kind !== "known") return fallback;
  const whole = minimum.wei / WEI;
  const fraction = (minimum.wei % WEI).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}
