import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRebuttals, getReview } from "@/lib/genlayer/data-source";
import { REVIEW_STATUS_TEXT } from "@/lib/contract-types";
import { displayTime, formatGen, titleText } from "@/lib/format";
import { governorLabel } from "@/lib/governors";
import { RebutForm } from "@/components/rebut-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Answer ${id}`,
    description: `File a bonded rebuttal against Intent Guard review ${id}.`,
  };
}

export default async function RebutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reviewResult = await getReview(id);
  if (reviewResult.kind === "NOT_FOUND") notFound();
  if (reviewResult.kind !== "AVAILABLE") {
    return (
      <section className="flex max-w-[70ch] flex-col gap-3 border border-[var(--rule-strong)] p-5">
        <p className="ig-heading">Live review {id} could not be retrieved.</p>
        <p className="ig-body">
          This is not evidence that the record is absent. Nothing may be bonded against a record
          that has not been read, so the form is withheld rather than shown against a guess.
        </p>
        <p className="ig-calldata-sm break-all">{reviewResult.error}</p>
      </section>
    );
  }

  const review = reviewResult.value;
  const rebuttalsResult = await getRebuttals(id);
  const rebuttals = rebuttalsResult.kind === "AVAILABLE" ? rebuttalsResult.value : [];
  const openRebuttal = rebuttals.find((rebuttal) => rebuttal.status === "OPEN");
  const status = REVIEW_STATUS_TEXT[review.status];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <p className="ig-label">right of reply</p>
        <h1 className="ig-display max-w-[32ch]">Answer the finding with an equal bond.</h1>
        <p className="ig-body max-w-[72ch]">
          A rebuttal is not an appeal to a moderator. It bonds exactly what the reviewer bonded and
          opens a second consensus round that reads your argument against the stated divergence. The
          round can uphold the finding, withdraw the veto, or record that it cannot tell.
        </p>
      </header>

      {/* ---- The record being answered ---- */}
      <section aria-labelledby="answering-head" className="flex flex-col gap-3">
        <h2 id="answering-head" className="ig-heading">
          The review this answers
        </h2>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <p className="ig-calldata">{review.id}</p>
          <p className="ig-label">
            {governorLabel(review.governor)} · proposal {review.proposal_id}
          </p>
          <p className={`ig-label ${review.veto_flag ? "ig-rubric" : ""}`}>
            {status.word} · {review.veto_flag ? "veto flag set" : "no veto standing"}
          </p>
          <p className="ig-label">reviewed {displayTime(review.reviewed_at) || "not yet run"}</p>
          <Link
            href={`/reviews/${review.id}`}
            className="ig-label ig-label-ink underline decoration-1 underline-offset-4"
          >
            read the full record
          </Link>
        </div>
        <p className="ig-heading max-w-[70ch] pl-4" style={{ borderLeft: "3px solid var(--thread)" }}>
          {titleText(review.mandate_title) || "No mandate title was recorded"}
        </p>
        {review.rationale ? (
          <blockquote
            className="ig-body max-w-[74ch] pl-4"
            style={{ borderLeft: "1px solid var(--rule-strong)" }}
          >
            {review.rationale}
          </blockquote>
        ) : null}
      </section>

      {review.status !== "DIVERGENT" ? (
        <p className="ig-aside max-w-[74ch] pl-3" style={{ borderLeft: "3px solid var(--rubric)" }}>
          A rebuttal answers a divergence, and this review is {review.status.toLowerCase()}. There
          is no finding here to contest, so the contract would reject the call. The form below is
          left in place so the refusal is legible rather than hidden, and it will refuse before
          asking for a signature.
        </p>
      ) : null}

      {openRebuttal ? (
        <p className="ig-aside max-w-[74ch] pl-3" style={{ borderLeft: "3px solid var(--rubric)" }}>
          Rebuttal {openRebuttal.id} is already open on this review. One reply is adjudicated before
          another may be filed, so that a finding cannot be buried under volume.
        </p>
      ) : null}

      <RebutForm review={review} hasOpen={Boolean(openRebuttal)} />

      <p className="ig-aside max-w-[74ch]">
        The bond is fixed at {formatGen(review.bond)}, the amount the reviewer put up. Symmetry
        is the whole mechanism: a reply that costs nothing is not a reply, and a reply that costs
        more than the finding would price out the party being objected to.
      </p>
    </div>
  );
}
