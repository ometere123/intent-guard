import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getActions, getRebuttals, getReview } from "@/lib/genlayer/data-source";
import { buildApparatus } from "@/lib/apparatus";
import {
  REBUTTAL_STATUS_TEXT,
  REVIEW_STATUS_TEXT,
  UNDECODABLE_GATE_TEXT,
} from "@/lib/contract-types";
import { displayTime, formatGen, mandateParagraphs, shortenHex, titleText } from "@/lib/format";
import { governorLabel } from "@/lib/governors";
import { mainnetAddressUrl, mainnetBlockUrl } from "@/lib/genlayer/config";
import { Apparatus, ApparatusLegend } from "@/components/apparatus";
import { ReviewActions } from "@/components/review-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const reviewResult = await getReview(id);
  if (reviewResult.kind !== "AVAILABLE") return { title: id };
  const review = reviewResult.value;
  return {
    title: `${id} · ${titleText(review.mandate_title) || "untitled mandate"}`,
    description: review.rationale.slice(0, 180) || undefined,
  };
}

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reviewResult = await getReview(id);
  if (reviewResult.kind === "NOT_FOUND") notFound();
  if (reviewResult.kind !== "AVAILABLE") {
    return <ReadUnavailable subject={`review ${id}`} detail={reviewResult.error} />;
  }
  const review = reviewResult.value;

  const [actionsResult, rebuttalsResult] = await Promise.all([getActions(id), getRebuttals(id)]);
  const actions = actionsResult.kind === "AVAILABLE" ? actionsResult.value : [];
  const rebuttals = rebuttalsResult.kind === "AVAILABLE" ? rebuttalsResult.value : [];
  const model = actionsResult.kind === "AVAILABLE" ? buildApparatus(review, actions) : null;
  const status = REVIEW_STATUS_TEXT[review.status];
  const vetoCleared = review.status === "DIVERGENT" && !review.veto_flag;

  return (
    <article className="flex flex-col gap-10">
      {/* ---- Colophon ---- */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <p className="ig-calldata">{review.id}</p>
          <p className="ig-label">
            {governorLabel(review.governor)} · proposal {review.proposal_id}
          </p>
          <Link href="/reviews" className="ig-label ig-label-ink underline decoration-1 underline-offset-4">
            back to the ledger
          </Link>
        </div>
        <h1 className="ig-display max-w-[34ch]">
          {titleText(review.mandate_title) || "No mandate title was recorded"}
        </h1>
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <p className={`ig-heading ${status.vetoes && review.veto_flag ? "ig-rubric" : ""}`}>
            {status.word}
          </p>
          <p className="ig-label">
            {review.veto_flag
              ? "veto flag set"
              : vetoCleared
                ? "veto cleared"
                : status.vetoes
                  ? "veto flag not set"
                  : "no veto"}
          </p>
          <p className="ig-label">reviewed {displayTime(review.reviewed_at)}</p>
        </div>
        <p className="ig-body max-w-[68ch]">{status.meaning}</p>
        <p className="ig-aside max-w-[68ch] opacity-85">{status.limit}</p>
      </header>

      {/* ---- The finding, printed as a running foot would be ---- */}
      <p
        className="ig-heading max-w-[70ch] pl-4"
        style={{
          borderLeft: `3px solid ${review.veto_flag ? "var(--rubric)" : "var(--thread)"}`,
          color: review.veto_flag ? "var(--rubric)" : undefined,
        }}
      >
        {model?.finding ?? "The review exists, but its decoded actions are currently unavailable."}
      </p>

      {vetoCleared ? (
        <section className="border border-[var(--rule-strong)] px-4 py-4">
          <p className="ig-label">the override rule</p>
          <p className="ig-body mt-2 max-w-[68ch]">
            This review found a divergence, and its veto no longer stands.{" "}
            {review.override_vote_ref
              ? "A fresh governance vote cleared it."
              : "A rebuttal cleared it."}{" "}
            Intent Guard raises objections; it never decides.
          </p>
          {review.override_vote_ref ? (
            <p className="ig-calldata-sm mt-2 break-all">{review.override_vote_ref}</p>
          ) : null}
        </section>
      ) : null}

      {review.status === "UNDECODABLE" ? (
        <section
          className="pl-4"
          style={{ borderLeft: "3px solid var(--thread)" }}
          aria-labelledby="gate-head"
        >
          <h2 id="gate-head" className="ig-label">
            which gate failed
          </h2>
          <p className="ig-heading mt-2">
            {(review.undecodable_gate ?? "").replaceAll("_", " ").toLowerCase() ||
              "the contract did not record which gate failed"}
          </p>
          <p className="ig-body mt-2 max-w-[68ch]">
            {review.undecodable_gate
              ? UNDECODABLE_GATE_TEXT[review.undecodable_gate]
              : "The record names no gate. Treat this record as incomplete rather than as a finding."}
          </p>
          <p className="ig-aside mt-2 max-w-[68ch]">
            Undecodable is a refusal, not a judgment. No verdict was written, no veto flag was set,
            and the bond was returned. Re-running the review is the correct response.
          </p>
        </section>
      ) : null}

      {/* ---- The apparatus ---- */}
      <section aria-labelledby="apparatus-head" className="flex flex-col gap-6">
        {!model ? (
          <ReadUnavailable subject="decoded actions" detail={"error" in actionsResult ? actionsResult.error : "not found"} compact />
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <h2 id="apparatus-head" className="ig-heading">
                The apparatus
              </h2>
              <p className="ig-aside max-w-[74ch]">
                The mandate on the left, the calldata on the right, and in the gutter between them a
                thread for every clause that authorises an action. Focus a clause or an action and its
                counterpart is marked. Each card also states its relationship in words.
              </p>
              <ApparatusLegend model={model} />
              {!model.mandateTextAvailable ? (
                <p className="ig-aside max-w-[74ch] pl-3" style={{ borderLeft: "3px solid var(--thread)" }}>
                  The contract records the mandate by digest and title rather than as prose, because 7,141 bytes of
                  markdown do not belong in contract storage. The verso therefore carries clause
                  anchors rather than quotations. The full description lives in the governor&apos;s
                  ProposalCreated log{review.creation_block ? ` at block ${review.creation_block}` : ""}.
                </p>
              ) : null}
            </div>

            <Apparatus model={model} review={review} />
          </>
        )}
      </section>

      {/* ---- The mandate as recorded ---- */}
      {review.mandate_text ? (
        <section aria-labelledby="mandate-head" className="flex flex-col gap-3">
          <h2 id="mandate-head" className="ig-heading">
            The mandate, in full
          </h2>
          <p className="ig-aside max-w-[74ch]">
            As read from the governor&apos;s ProposalCreated log. The title above is the first
            markdown heading, extracted deterministically by the same rule the contract uses.
          </p>
          <div className="ig-prose max-w-[74ch] pt-2">
            {mandateParagraphs(review.mandate_text).map((paragraph, index) => (
              <p key={index} className={paragraph.startsWith("#") ? "ig-heading" : "ig-body"}>
                {paragraph.replace(/^#+\s*/, "")}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- The rationale ---- */}
      {review.rationale ? (
        <section aria-labelledby="rationale-head" className="flex flex-col gap-3">
          <h2 id="rationale-head" className="ig-heading">
            Consensus rationale
          </h2>
          <p className="ig-aside max-w-[74ch]">
            Written by the validators that ran this round, on the decoded and corroborated action
            list above. The model never saw raw calldata hex.
          </p>
          <blockquote className="ig-body max-w-[74ch] pl-4" style={{ borderLeft: "1px solid var(--rule-strong)" }}>
            {review.rationale}
          </blockquote>
        </section>
      ) : null}

      {/* ---- Rebuttals ---- */}
      <section aria-labelledby="rebuttal-head" className="flex flex-col gap-3">
        <h2 id="rebuttal-head" className="ig-heading">
          Right of reply
        </h2>
        {rebuttalsResult.kind !== "AVAILABLE" ? (
          <ReadUnavailable subject="rebuttals" detail={"error" in rebuttalsResult ? rebuttalsResult.error : "not found"} compact />
        ) : rebuttals.length === 0 ? (
          <p className="ig-aside max-w-[74ch]">
            No rebuttal has been filed.{" "}
            {review.status === "DIVERGENT" ? (
              <>
                The proposer may{" "}
                <Link href={`/rebut/${review.id}`} className="underline decoration-1 underline-offset-4">
                  answer this finding
                </Link>{" "}
                by bonding exactly {formatGen(review.bond)} GEN, the same amount the reviewer
                bonded.
              </>
            ) : (
              "A rebuttal may only answer a divergent review."
            )}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
            {rebuttals.map((rebuttal) => (
              <li key={rebuttal.id} className="py-4">
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <p className="ig-calldata">{rebuttal.id}</p>
                  <p className="ig-label ig-label-ink">{rebuttal.status.replaceAll("_", " ").toLowerCase()}</p>
                  <p className="ig-label">bond {formatGen(rebuttal.bond)} GEN</p>
                  <p className="ig-label">
                    rebutter {shortenHex(rebuttal.rebutter)}
                  </p>
                  {rebuttal.settled_at ? (
                    <p className="ig-label">settled {displayTime(rebuttal.settled_at)}</p>
                  ) : null}
                </div>
                <p className="ig-body mt-2 max-w-[70ch]">
                  {REBUTTAL_STATUS_TEXT[rebuttal.status]}
                </p>
                {rebuttal.argument_url ? (
                  <a
                    className="ig-calldata-sm mt-2 block break-all underline decoration-1 underline-offset-4"
                    href={rebuttal.argument_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {rebuttal.argument_url}
                  </a>
                ) : null}
                {rebuttal.rationale ? (
                  <blockquote
                    className="ig-aside mt-3 max-w-[70ch] pl-4"
                    style={{ borderLeft: "1px solid var(--rule-strong)" }}
                  >
                    {rebuttal.rationale}
                  </blockquote>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Writes ---- */}
      <ReviewActions review={review} rebuttals={rebuttals} />

      {/* ---- The record ---- */}
      <section aria-labelledby="record-head" className="flex flex-col gap-3">
        <h2 id="record-head" className="ig-heading">
          The record
        </h2>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Field label="governor">
            <a
              href={mainnetAddressUrl(review.governor)}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-1 underline-offset-4"
            >
              {review.governor}
            </a>
          </Field>
          <Field label="proposal id">{review.proposal_id}</Field>
          <Field label="creation block">
            {review.creation_block ? (
              <a
                href={mainnetBlockUrl(review.creation_block)}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-1 underline-offset-4"
              >
                {review.creation_block}
              </a>
            ) : (
              "not recorded"
            )}
          </Field>
          <Field label="requester">{review.requester}</Field>
          <Field label="bond">{formatGen(review.bond)} GEN</Field>
          <Field label="action count">{review.action_count}</Field>
          <Field label="mandate digest">{review.mandate_digest || "not recorded"}</Field>
          <Field label="actions digest">{review.actions_digest || "not recorded"}</Field>
        </dl>
        <p className="ig-aside max-w-[74ch]">
          Both digests are what makes this record auditable. The mandate digest pins the exact text
          that was read; the actions digest pins the canonical decoded action set that both
          explorers agreed on. If either changes, the review no longer applies.
        </p>
      </section>
    </article>
  );
}

function ReadUnavailable({ subject, detail, compact = false }: { subject: string; detail: string; compact?: boolean }) {
  return <section className={compact ? "border-l-2 border-[var(--rubric)] pl-3" : "flex max-w-[70ch] flex-col gap-3 border border-[var(--rule-strong)] p-5"}><p className="ig-heading">Live {subject} could not be retrieved.</p><p className="ig-body">This is not evidence that the record or its children are empty.</p><p className="ig-calldata-sm break-all">{detail}</p></section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="ig-label">{label}</dt>
      <dd className="ig-calldata mt-1 break-all">{children}</dd>
    </div>
  );
}
