"use client";

import { useState } from "react";
import type { Rebuttal, Review } from "@/lib/contract-types";
import { findGovernor } from "@/lib/governors";
import { useWriteRunner } from "@/components/write-runner";
import { Lifecycle } from "@/components/lifecycle";

export function ReviewActions({
  review,
  rebuttals,
}: {
  review: Review;
  rebuttals: Rebuttal[];
}) {
  const { state, run, reset, walletGate } = useWriteRunner();
  const [voteRef, setVoteRef] = useState("");
  const [showProgram, setShowProgram] = useState(false);

  const governor = findGovernor(review.governor);
  const openRebuttal = rebuttals.find((rebuttal) => rebuttal.status === "OPEN");
  const busy = state.phase !== "idle";

  async function runReview(functionName: "review" | "rereview") {
    setShowProgram(true);
    await run({
      label: `${functionName}(${review.id})`,
      functionName,
      args: [review.id],
      reviewId: review.id,
      preflight: () => {
        if (walletGate) return `${walletGate} Running a review is a write.`;
        if (!governor) {
          return `${review.governor} is not in the adapter registry. The contract would revert this before reading anything, so it is refused here for free.`;
        }
        if (!governor.supported) {
          return `${governor.label} uses an adapter that is not shipped yet. Unknown governors are refused rather than guessed at.`;
        }
        if (functionName === "review" && review.status !== "PENDING") {
          return `This review is already ${review.status.toLowerCase()}. review() only runs on a pending record — use rereview() to run it again against current chain state.`;
        }
        if (functionName === "rereview" && review.status === "PENDING") {
          return "Nothing has been reviewed yet, so there is nothing to re-run. Use review().";
        }
        return null;
      },
    });
  }

  return (
    <section aria-labelledby="writes-head" className="flex flex-col gap-4">
      <div>
        <h2 id="writes-head" className="ig-heading">
          Act on this record
        </h2>
        <p className="ig-aside mt-1 max-w-[74ch]">
          Every button below states what it does and what it will cost before you sign. Requests
          that a deterministic guard would reject are refused here, for free, without a signature.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="ig-btn"
          disabled={busy}
          onClick={() => runReview("review")}
        >
          run review
        </button>
        <button
          type="button"
          className="ig-btn-quiet"
          disabled={busy}
          onClick={() => runReview("rereview")}
        >
          re-review against current state
        </button>
        <button
          type="button"
          className="ig-btn-quiet"
          disabled={busy}
          onClick={() => {
            setShowProgram(false);
            run({
              label: `adjudicate_rebuttal(${openRebuttal?.id ?? "—"})`,
              functionName: "adjudicate_rebuttal",
              args: [openRebuttal?.id ?? ""],
              reviewId: review.id,
              preflight: () => {
                if (walletGate) return `${walletGate} Adjudicating is a write.`;
                if (!openRebuttal) {
                  return "There is no open rebuttal on this review, so there is nothing to adjudicate.";
                }
                return null;
              },
            });
          }}
        >
          adjudicate the open rebuttal
        </button>
      </div>

      <p className="ig-aside max-w-[74ch]">
        <span className="ig-label mr-2">permissionless</span>
        review(), rereview() and adjudicate_rebuttal() may be called by anyone. Nobody has to be
        trusted to run the check, which is the point.
      </p>

      {/* ---- The override. Led with, not buried. ---- */}
      <div className="mt-2 border border-[var(--rule-strong)] px-4 py-4">
        <p className="ig-label">clear a standing veto by vote</p>
        <p className="ig-body mt-2 max-w-[70ch]">
          A veto that a DAO cannot override is not a safety mechanism, it is a new unelected
          veto-holder. Recording a fresh governance vote here clears the flag. This call is
          deliberately not a consensus call — governance overrides the machine, never the reverse.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="vote-ref">
            Reference to the overriding vote
          </label>
          <input
            id="vote-ref"
            className="ig-input"
            value={voteRef}
            placeholder="snapshot id, tx hash, or proposal url"
            onChange={(event) => setVoteRef(event.target.value)}
          />
          <button
            type="button"
            className="ig-btn-rubric shrink-0"
            disabled={busy}
            onClick={() => {
              setShowProgram(false);
              run({
                label: `clear_veto_by_vote(${review.id})`,
                functionName: "clear_veto_by_vote",
                args: [review.id, voteRef.trim()],
                reviewId: review.id,
                preflight: () => {
                  if (walletGate) return `${walletGate} Clearing a veto is a write.`;
                  if (!review.veto_flag) {
                    return "No veto flag is set on this review, so there is nothing to clear.";
                  }
                  if (voteRef.trim().length < 8) {
                    return "A vote reference is required. Clearing a veto without recording what overrode it would make the record unauditable.";
                  }
                  return null;
                },
              });
            }}
          >
            clear the veto
          </button>
        </div>
      </div>

      <Lifecycle state={state} program={showProgram} />

      {state.phase === "settled" ? (
        <button type="button" className="ig-btn-quiet self-start" onClick={reset}>
          done
        </button>
      ) : null}
    </section>
  );
}
