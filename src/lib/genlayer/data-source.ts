/**
 * The one gate between fixtures and the deployed contract.
 *
 * Every page and component in the app reads through this module and nothing else.
 * Flip `NEXT_PUBLIC_INTENT_GUARD_DATA=live` (with a contract address set) and every
 * function below stops returning fixtures and starts returning contract state. No
 * other file changes, and no other file branches on the mode.
 */

import type { DecodedAction, Rebuttal, Review } from "../contract-types";
import { MOCK_REBUTTALS, MOCK_REVIEWS, MOCK_ACTIONS_BY_ID } from "../mock-data";
import { CONTRACT_ADDRESS, DATA_MODE, IS_LIVE } from "./config";
import * as live from "./contract";

export type DataMode = "live" | "fixtures";

export const dataMode: DataMode = IS_LIVE ? "live" : "fixtures";

/** What the banner at the top of every page says, and why. */
export function dataProvenance(): { mode: DataMode; line: string } {
  if (IS_LIVE) {
    return {
      mode: "live",
      line: `Reading the Intent Guard contract at ${CONTRACT_ADDRESS}. Every number on this page is contract state.`,
    };
  }
  if (DATA_MODE === "live") {
    return {
      mode: "fixtures",
      line: "Live mode is requested but no contract address is configured, so these are bundled fixtures. Nothing here is on-chain state.",
    };
  }
  return {
    mode: "fixtures",
    line: "These are bundled fixtures, not contract state. The action sets, selectors and keccak verifications are real; bonds, digests, timestamps and addresses marked illustrative are not.",
  };
}

export async function listReviews(): Promise<Review[]> {
  if (IS_LIVE) return live.listReviews();
  return MOCK_REVIEWS;
}

export async function getReview(id: string): Promise<Review | undefined> {
  if (IS_LIVE) return live.getReview(id);
  return MOCK_REVIEWS.find((review) => review.id === id);
}

export async function getActions(id: string): Promise<DecodedAction[]> {
  if (IS_LIVE) return live.getActions(id);
  return MOCK_ACTIONS_BY_ID[id] ?? [];
}

export async function getRebuttals(reviewId: string): Promise<Rebuttal[]> {
  if (IS_LIVE) return live.getRebuttals(reviewId);
  return MOCK_REBUTTALS.filter((rebuttal) => rebuttal.review_id === reviewId);
}

export async function getRebuttal(id: string): Promise<Rebuttal | undefined> {
  if (IS_LIVE) return live.getRebuttal(id);
  return MOCK_REBUTTALS.find((rebuttal) => rebuttal.id === id);
}

/**
 * The integration surface, read the same way an executor bot would read it. In
 * fixture mode this is computed from the fixture ledger rather than guessed, so
 * the answer matches what the reviews page shows.
 */
export async function isVetoed(
  governor: string,
  proposalId: string,
): Promise<{ vetoed: boolean; review?: Review; known: boolean; unavailable: boolean; note: string }> {
  if (IS_LIVE) {
    const answer = await live.isVetoed(governor, proposalId);
    if (!answer) return { vetoed: false, known: false, unavailable: true, note: "The contract read was unavailable; no judgment is implied." };
    const review = answer.review_id ? await live.getReview(answer.review_id) : undefined;
    return {
      vetoed: answer.vetoed === true,
      review,
      known: answer.reviewed === true,
      unavailable: false,
      note: answer.note ?? "",
    };
  }
  const review = MOCK_REVIEWS.find(
    (item) =>
      item.governor.toLowerCase() === governor.toLowerCase() && item.proposal_id === proposalId,
  );
  return {
    vetoed: Boolean(review?.veto_flag),
    review,
    known: review !== undefined && review.status !== "PENDING",
    unavailable: false,
    note: review ? (review.status === "PENDING" ? "A review was requested but has not run." : "") : "No review is recorded for this governor and proposal.",
  };
}

export async function ledgerCounts() {
  const reviews = await listReviews();
  const by = (status: Review["status"]) => reviews.filter((r) => r.status === status).length;
  return {
    total: reviews.length,
    aligned: by("ALIGNED"),
    divergent: by("DIVERGENT"),
    underspecified: by("UNDERSPECIFIED"),
    undecodable: by("UNDECODABLE"),
    pending: by("PENDING"),
    standingVetoes: reviews.filter((r) => r.veto_flag).length,
  };
}
