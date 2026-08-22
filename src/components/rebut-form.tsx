"use client";

import { useState } from "react";
import type { Review } from "@/lib/contract-types";
import { formatGen } from "@/lib/format";
import { useWriteRunner } from "@/components/write-runner";
import { Lifecycle } from "@/components/lifecycle";

export function RebutForm({ review, hasOpen }: { review: Review; hasOpen: boolean }) {
  const { state, run, reset, walletGate } = useWriteRunner();
  const [rebuttalId, setRebuttalId] = useState(`${review.id}-REB-1`);
  const [url, setUrl] = useState("");
  const busy = state.phase !== "idle";
  const bondText = formatGen(review.bond);

  // The wei this form will send, taken straight from the review record. Deriving it
  // from `bondText` instead would round-trip through a display string that trims to
  // four decimals, so a 0.00012 GEN review would be answered with 0.0001 and the
  // contract would refuse the asymmetry. Parsed once here so the preflight can refuse
  // an unreadable record before a signature is requested.
  let bondWei: bigint | null;
  try {
    bondWei = BigInt(review.bond || "0");
  } catch {
    bondWei = null;
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        className="grid gap-x-8 gap-y-5 spread:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          run({
            label: `rebut(${rebuttalId.trim()})`,
            functionName: "rebut",
            args: [rebuttalId.trim(), review.id, url.trim()],
            value: bondWei ?? 0n,
            reviewId: review.id,
            preflight: () => {
              if (walletGate) return `${walletGate} A rebuttal is a payable write.`;
              if (review.status !== "DIVERGENT") {
                return `A rebuttal answers a divergence. This review is ${review.status.toLowerCase()}, so there is no finding to answer and the contract would revert.`;
              }
              if (!review.veto_flag) {
                return "This review's veto has already been cleared. There is nothing left to rebut.";
              }
              if (hasOpen) {
                return "A rebuttal is already open on this review. It must be adjudicated before another is filed.";
              }
              if (!/^[A-Za-z0-9-]{3,40}$/.test(rebuttalId.trim())) {
                return "A rebuttal id is 3 to 40 characters of letters, digits and hyphens.";
              }
              if (!/^https?:\/\/\S+\.\S+/.test(url.trim())) {
                return "An argument URL is required, and it must be fetchable. The adjudicating round renders it; a link nobody can read cannot defeat a finding.";
              }
              if (bondWei === null || bondWei <= 0n) {
                return "The review's bond could not be read as an amount, so the symmetric bond cannot be sent. Nothing is signed against a bond this page had to guess at.";
              }
              return null;
            },
          });
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="ig-label">rebuttal id</span>
          <input
            className="ig-input"
            value={rebuttalId}
            onChange={(event) => setRebuttalId(event.target.value)}
          />
          <span className="ig-aside opacity-80">Your identifier for this reply.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="ig-label">argument url</span>
          <input
            className="ig-input"
            value={url}
            placeholder="https://gov.example.org/t/…"
            onChange={(event) => setUrl(event.target.value)}
          />
          <span className="ig-aside max-w-[46ch] opacity-80">
            The adjudicating round fetches and renders this page, then reads it against the stated
            divergence. Link the argument, not a summary of it.
          </span>
        </label>

        <div>
          <p className="ig-label">bond</p>
          <p className="ig-display mt-1">{bondText}</p>
          <p className="ig-aside mt-1 max-w-[46ch] opacity-80">
            Fixed at exactly the reviewer&apos;s bond. Not adjustable, by design.
          </p>
        </div>

        <div className="flex items-end">
          <button type="submit" className="ig-btn" disabled={busy}>
            file the rebuttal
          </button>
        </div>
      </form>

      <Lifecycle state={state} />

      {state.phase === "settled" ? (
        <button type="button" className="ig-btn-quiet self-start" onClick={reset}>
          done
        </button>
      ) : null}
    </div>
  );
}
