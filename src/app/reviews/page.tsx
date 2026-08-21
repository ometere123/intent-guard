import Link from "next/link";
import type { Metadata } from "next";
import { ledgerCounts, listReviews } from "@/lib/genlayer/data-source";
import { ReviewIndexClient } from "@/components/review-index-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ledger",
  description:
    "Every review Intent Guard has recorded, by governor, verdict and veto state — including the refusals.",
};

export default async function ReviewsPage() {
  const [reviews, counts] = await Promise.all([listReviews(), ledgerCounts()]);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <p className="ig-label">the ledger</p>
        <h1 className="ig-display max-w-[30ch]">Every review, including the refusals.</h1>
        <p className="ig-body max-w-[72ch]">
          A mechanism that only publishes its findings is not auditable. Undecodable refusals and
          underspecified advisories are listed here beside the vetoes, because the rate at which a
          checker declines to answer is part of what it is worth.
        </p>
        <Link href="/reviews/new" className="ig-btn self-start">
          request a review
        </Link>
      </header>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 spread:grid-cols-6">
        <Count label="records" value={counts.total} />
        <Count label="aligned" value={counts.aligned} />
        <Count label="divergent" value={counts.divergent} rubric />
        <Count label="underspecified" value={counts.underspecified} />
        <Count label="undecodable" value={counts.undecodable} />
        <Count label="vetoes standing" value={counts.standingVetoes} rubric />
      </dl>

      <ReviewIndexClient reviews={reviews} />
    </div>
  );
}

function Count({ label, value, rubric }: { label: string; value: number; rubric?: boolean }) {
  return (
    <div>
      <dt className="ig-label">{label}</dt>
      <dd className={`ig-display mt-1 ${rubric && value > 0 ? "ig-rubric" : ""}`}>{value}</dd>
    </div>
  );
}
