/**
 * The apparatus: which mandate clause authorises which decoded action, and where
 * a thread is missing.
 *
 * Everything here is derived from the review record the contract wrote. The
 * contract states, machine-readably, *which* action diverges (`diverging_index`)
 * and *by what kind* (`divergence_kind`). That is precisely enough to say whether
 * a thread reaches an action, and whether it lands or breaks:
 *
 *   intact  — a clause cites this action, its selector verified by keccak, and the
 *             verdict does not fault it.
 *   broken  — a clause cites this action, but the thread cannot be confirmed to
 *             land: either the verdict faults this exact action, or its selector
 *             never verified, so what the bytes call is not established.
 *   absent  — no clause cites this action. There is no thread. That absence *is*
 *             the divergence, and nothing else in the page is allowed to say it.
 *
 * No inference happens in this file. Both fault conditions come from the record:
 * `diverging_index` for the verdict, `resolved` for the arithmetic.
 */

import type { DecodedAction, DivergenceKind, MandateClause, Review } from "./contract-types";
import { divergingIndex } from "./contract-types";
import { toIndex } from "./format";

export type ThreadKind = "intact" | "broken" | "absent";

/** Divergence kinds that mean "the mandate never authorised this action at all". */
const UNCITED_KINDS: DivergenceKind[] = ["EXTRA_ACTION", "UNAUTHORISED_SCOPE"];

export type ApparatusAction = {
  action: DecodedAction;
  index: number;
  thread: ThreadKind;
  /** Ordinals of the clauses that cite this action. Empty when `thread === "absent"`. */
  citedBy: number[];
  /** True when this is the action the verdict names. */
  faulted: boolean;
};

export type ApparatusClause = MandateClause & {
  /** Action indices this clause cites that actually exist in the decoded set. */
  resolvedCites: number[];
};

export type Apparatus = {
  clauses: ApparatusClause[];
  actions: ApparatusAction[];
  /** The one action the verdict names, or null. */
  faultedIndex: number | null;
  /** Actions with no thread, in document order. Mobile collects these last. */
  unmandated: number[];
  /** True when the verso prose came from the contract record rather than a fixture. */
  mandateTextAvailable: boolean;
  /** The single-line finding printed under the spread. */
  finding: string;
};

export function buildApparatus(review: Review, actions: DecodedAction[]): Apparatus {
  const faultedIndex = divergingIndex(review);
  const kind = review.divergence_kind ?? "NONE";
  const uncited = faultedIndex !== null && UNCITED_KINDS.includes(kind);

  const ordered = [...actions].sort((a, b) => toIndex(a.index) - toIndex(b.index));

  // Clause list: authored in the fixture, or synthesised one-per-authorised-action
  // when the contract records the mandate by digest only.
  const authored = review.mandate_clauses;
  const clauses: ApparatusClause[] = (authored ?? synthesiseClauses(review, ordered, faultedIndex, uncited)).map(
    (clause) => ({
      ...clause,
      resolvedCites: clause.cites.filter((i) => i >= 0 && i < ordered.length && !(uncited && i === faultedIndex)),
    }),
  );

  const citedBy = new Map<number, number[]>();
  for (const clause of clauses) {
    for (const target of clause.resolvedCites) {
      citedBy.set(target, [...(citedBy.get(target) ?? []), clause.ordinal]);
    }
  }

  const apparatusActions: ApparatusAction[] = ordered.map((action, position) => {
    const index = toIndex(action.index ?? String(position));
    const cites = citedBy.get(index) ?? [];
    const faulted = faultedIndex === index;
    let thread: ThreadKind = "intact";
    if (cites.length === 0) thread = "absent";
    else if (faulted || !action.resolved) thread = "broken";
    return { action, index, thread, citedBy: cites, faulted };
  });

  return {
    clauses,
    actions: apparatusActions,
    faultedIndex,
    unmandated: apparatusActions.filter((entry) => entry.thread === "absent").map((entry) => entry.index),
    mandateTextAvailable: Boolean(review.mandate_text),
    finding: findingLine(review, faultedIndex),
  };
}

/**
 * With no mandate prose on hand, the verso still needs anchors for the threads to
 * come from. One anchor per authorised action, labelled as an anchor rather than
 * dressed up as a quotation. The anchor never invents wording: it states which
 * action the mandate was found to authorise, and nothing more.
 */
function synthesiseClauses(
  review: Review,
  actions: DecodedAction[],
  faultedIndex: number | null,
  uncited: boolean,
): MandateClause[] {
  return actions
    .map((action, position) => ({ index: toIndex(action.index ?? String(position)), position }))
    .filter(({ index }) => !(uncited && index === faultedIndex))
    .map(({ index }, ordinal) => ({
      ordinal,
      text:
        `Clause anchor. The mandate recorded under digest ${review.mandate_digest || "not recorded"} was found to ` +
        `authorise action ${index + 1}. The full description is not stored on chain; this anchor stands in its place.`,
      cites: [index],
    }));
}

function findingLine(review: Review, faultedIndex: number | null): string {
  switch (review.status) {
    case "PENDING":
      return "No review round has run. Nothing has been read, decoded or judged.";
    case "ALIGNED":
      return "Every decoded action is cited. No action falls outside the mandate.";
    case "UNDECODABLE":
      return "Refused. A deterministic gate failed before any judgment, so no verdict was written.";
    case "UNDERSPECIFIED":
      return "Advisory. The mandate does not reach these bytes in either direction. No veto set.";
    case "DIVERGENT": {
      if (faultedIndex === null) {
        return "Divergent, but no action index was recorded. Treat this record as incomplete.";
      }
      const kind = review.divergence_kind;
      if (kind === "EXTRA_ACTION" || kind === "UNAUTHORISED_SCOPE") {
        return `Veto raised. Divergence at action ${faultedIndex + 1}. No mandate clause cites it.`;
      }
      return `Veto raised. Divergence at action ${faultedIndex + 1}. The clause cites it; its ${
        kind === "WRONG_TARGET" ? "target" : kind === "OPAQUE_NESTED" ? "nested payload" : "arguments"
      } do not match.`;
    }
    default:
      return "";
  }
}

/** The relationship, stated in words, so it survives with no visual connectors. */
export function threadSentence(entry: ApparatusAction): string {
  if (entry.thread === "absent") return "No mandate clause cites this action.";
  const list = entry.citedBy.map((ordinal) => `clause ${ordinal + 1}`).join(" and ");
  if (entry.thread === "broken") {
    if (!entry.action.resolved) {
      return `Cited by ${list}, and its selector never verified, so what it calls is not established.`;
    }
    return `Authorised by ${list}, and the verdict faults it.`;
  }
  return `Authorised by ${list}.`;
}

/** Why a thread breaks, for the annotation printed in the gutter. */
export function breakReason(entry: ApparatusAction, review: Review): string {
  if (!entry.action.resolved) return "selector unverified";
  const kind = review.divergence_kind;
  if (kind === "WRONG_TARGET") return "target does not match";
  if (kind === "PARAM_MISMATCH") return "argument does not match";
  if (kind === "OPAQUE_NESTED") return "nested payload does not match";
  return "does not match";
}
