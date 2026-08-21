import type { Metadata } from "next";
import { REVIEW_PROGRAM } from "@/lib/lifecycle";
import { RequestReviewForm } from "@/components/request-review-form";

export const metadata: Metadata = {
  title: "Request a review",
  description:
    "Bond a review of a governance proposal: pick the governor, name the proposal, and hint at its creation block.",
};

export default function NewReviewPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <p className="ig-label">request a review</p>
        <h1 className="ig-display max-w-[30ch]">
          Name a proposal. Bond it. Anyone can then run the check.
        </h1>
        <p className="ig-body max-w-[72ch]">
          Requesting a review records the proposal and holds a bond. It runs no consensus and reads
          no explorer — it only validates. The review itself is permissionless: once a record
          exists, anybody may run it, so nobody has to be trusted to run it.
        </p>
      </header>

      <RequestReviewForm />

      <section className="flex flex-col gap-3">
        <h2 className="ig-heading">What happens when someone runs it</h2>
        <ol className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
          {REVIEW_PROGRAM.map((step, index) => (
            <li key={step.key} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-8">
              <div className="min-w-[12rem] shrink-0">
                <span className="ig-calldata-sm mr-2 opacity-55">{index + 1}</span>
                <span className="ig-label ig-label-ink">{step.label}</span>
                <p
                  className={`ig-calldata-sm mt-1 ${
                    step.kind === "deterministic" ? "ig-verified" : "opacity-70"
                  }`}
                >
                  {step.kind === "deterministic"
                    ? "arithmetic"
                    : step.kind === "network"
                      ? "network i/o"
                      : "inference"}
                </p>
              </div>
              <div className="max-w-[66ch]">
                <p className="ig-body">{step.detail}</p>
                <p className="ig-calldata-sm mt-1 opacity-70">source · {step.source}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="ig-aside max-w-[74ch]">
          The expensive semantic call runs last, on data that has already survived four
          deterministic gates. A proposal whose explorers disagree never reaches the prompt.
        </p>
      </section>
    </div>
  );
}
