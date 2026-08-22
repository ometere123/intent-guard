"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Review } from "@/lib/contract-types";
import { REVIEW_STATUS_TEXT, divergingIndex } from "@/lib/contract-types";
import { citationMark, displayTime, formatGen, titleText } from "@/lib/format";
import { GOVERNORS, governorLabel } from "@/lib/governors";

type VerdictFilter = "all" | Review["status"];
type VetoFilter = "all" | "standing" | "cleared" | "none";

export function ReviewIndexClient({ reviews }: { reviews: Review[] }) {
  const [governor, setGovernor] = useState("all");
  const [verdict, setVerdict] = useState<VerdictFilter>("all");
  const [veto, setVeto] = useState<VetoFilter>("all");

  const filtered = useMemo(
    () =>
      reviews.filter((review) => {
        if (governor !== "all" && review.governor.toLowerCase() !== governor.toLowerCase()) {
          return false;
        }
        if (verdict !== "all" && review.status !== verdict) return false;
        if (veto === "standing" && !review.veto_flag) return false;
        if (veto === "cleared" && !(review.status === "DIVERGENT" && !review.veto_flag)) return false;
        if (veto === "none" && (review.veto_flag || review.status === "DIVERGENT")) return false;
        return true;
      }),
    [governor, reviews, verdict, veto],
  );

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-wrap gap-x-8 gap-y-4" aria-label="Filter the ledger">
        <label className="flex flex-col gap-1">
          <span className="ig-label">governor</span>
          <select
            className="ig-select"
            value={governor}
            onChange={(event) => setGovernor(event.target.value)}
          >
            <option value="all">any</option>
            {GOVERNORS.map((entry) => (
              <option key={entry.address} value={entry.address}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="ig-label">verdict</span>
          <select
            className="ig-select"
            value={verdict}
            onChange={(event) => setVerdict(event.target.value as VerdictFilter)}
          >
            <option value="all">any</option>
            {(Object.keys(REVIEW_STATUS_TEXT) as Review["status"][]).map((status) => (
              <option key={status} value={status}>
                {REVIEW_STATUS_TEXT[status].word}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="ig-label">veto state</span>
          <select
            className="ig-select"
            value={veto}
            onChange={(event) => setVeto(event.target.value as VetoFilter)}
          >
            <option value="all">any</option>
            <option value="standing">standing</option>
            <option value="cleared">cleared</option>
            <option value="none">never raised</option>
          </select>
        </label>
      </form>

      <p className="ig-label">
        {filtered.length} of {reviews.length} records
      </p>

      {filtered.length === 0 ? (
        <p className="ig-body max-w-[64ch]">
          No record matches those filters. The ledger is not empty. The filters are narrow.
        </p>
      ) : (
        <ol className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
          {filtered.map((review) => {
            const status = REVIEW_STATUS_TEXT[review.status];
            const faulted = divergingIndex(review);
            const cleared = review.status === "DIVERGENT" && !review.veto_flag;
            return (
              <li key={review.id}>
                <Link
                  href={`/reviews/${review.id}`}
                  className="grid gap-x-8 gap-y-2 py-5 no-underline spread:grid-cols-[10rem_1fr_14rem]"
                >
                  <div>
                    <p className="ig-calldata">{review.id}</p>
                    <p className="ig-label mt-1">{governorLabel(review.governor)}</p>
                  </div>
                  <div>
                    <p className="ig-heading">
                      {titleText(review.mandate_title) || "no mandate title recorded"}
                    </p>
                    <p className="ig-aside mt-1 max-w-[74ch] opacity-85">
                      {review.status === "DIVERGENT" && faulted !== null ? (
                        <span className="ig-rubric">
                          divergence at action <span aria-hidden>{citationMark(faulted)}</span>{" "}
                          {review.divergence_kind.replaceAll("_", " ").toLowerCase()} ·{" "}
                        </span>
                      ) : null}
                      {status.meaning}
                    </p>
                  </div>
                  <div className="spread:text-right">
                    <p className={`ig-heading ${review.veto_flag ? "ig-rubric" : ""}`}>
                      {status.word}
                    </p>
                    <p className="ig-label mt-1">
                      {review.veto_flag ? "veto standing" : cleared ? "veto cleared" : "no veto"}
                    </p>
                    <p className="ig-label mt-1">
                      {review.action_count} action{review.action_count === "1" ? "" : "s"} · bond{" "}
                      {formatGen(review.bond)} GEN
                    </p>
                    <p className="ig-label mt-1">{displayTime(review.reviewed_at) || "not yet run"}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
