"use client";

import { CLIENT_PHASES, OUTCOMES, REVIEW_PROGRAM } from "@/lib/lifecycle";
import type { OutcomeClass } from "@/lib/lifecycle";
import type { WriteState } from "@/components/write-runner";
import { explorerTxUrl } from "@/lib/genlayer/config";
import { REVIEW_STATUS_TEXT } from "@/lib/contract-types";
import type { ReviewStatus } from "@/lib/contract-types";

const KIND_MARK: Record<string, string> = {
  deterministic: "arithmetic",
  network: "network i/o",
  inference: "inference",
};

/**
 * The lifecycle of one write, in the open. Every row names what it is waiting on;
 * no row is a bare spinner.
 */
export function Lifecycle({
  state,
  program = false,
}: {
  state: WriteState;
  /** Show the contract's program of work — only meaningful for `review`/`rereview`. */
  program?: boolean;
}) {
  const activeIndex = CLIENT_PHASES.findIndex((phase) => phase.key === state.phase);
  const running = state.phase !== "idle";
  const outcome = state.outcome;

  if (!running && !outcome) return null;

  return (
    <section className="mt-6 border border-[var(--rule-strong)]" aria-live="polite">
      <ol className="divide-y divide-[var(--rule)]">
        {CLIENT_PHASES.map((phase, index) => {
          const done = activeIndex > index;
          const active = activeIndex === index;
          return (
            <li
              key={phase.key}
              className={`flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-6 ${
                active ? "ig-recto" : ""
              }`}
            >
              <div className="flex min-w-[11rem] shrink-0 items-baseline gap-2">
                <span
                  aria-hidden
                  className={`ig-calldata-sm ${done ? "ig-verified" : active ? "ig-stage-active" : "opacity-40"}`}
                >
                  {done ? "✓" : active ? "▸" : "·"}
                </span>
                <span className={`ig-label ${active || done ? "ig-label-ink" : ""}`}>
                  {phase.label}
                </span>
              </div>
              <p className={`ig-aside max-w-[64ch] ${active || done ? "" : "opacity-55"}`}>
                {phase.detail}
              </p>
            </li>
          );
        })}
      </ol>

      {state.hash ? (
        <div className="ig-rule px-4 py-3">
          <p className="ig-label">transaction</p>
          <a
            className="ig-calldata mt-1 block break-all underline decoration-1 underline-offset-4"
            href={explorerTxUrl(state.hash)}
            target="_blank"
            rel="noreferrer"
          >
            {state.hash}
          </a>
        </div>
      ) : null}

      {program ? (
        <div className="ig-rule px-4 py-4">
          <p className="ig-label">
            program of work inside the consensus window
          </p>
          <p className="ig-aside mt-1 max-w-[68ch]">
            A GenLayer node reports the consensus stage, not per-phase progress, so these five
            steps are listed rather than animated. They run in this order, and the first four
            finish before the fifth begins.
          </p>
          <ol className="mt-3 divide-y divide-[var(--rule)] border-t border-[var(--rule)]">
            {REVIEW_PROGRAM.map((step, index) => (
              <li key={step.key} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
                <div className="min-w-[11rem] shrink-0">
                  <span className="ig-calldata-sm mr-2 opacity-55">{index + 1}</span>
                  <span className="ig-label ig-label-ink">{step.label}</span>
                  <p
                    className={`ig-calldata-sm mt-1 ${
                      step.kind === "deterministic" ? "ig-verified" : "opacity-70"
                    }`}
                  >
                    {KIND_MARK[step.kind]}
                  </p>
                </div>
                <div className="max-w-[64ch]">
                  <p className="ig-aside">{step.detail}</p>
                  <p className="ig-calldata-sm mt-1 opacity-70">source · {step.source}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {outcome ? <OutcomePanel outcome={outcome} message={state.message} /> : null}
    </section>
  );
}

/**
 * The four non-verdict endings, each rendered differently. `[EXTERNAL]` and
 * `[TRANSIENT]` are bordered in thread grey and say plainly that nothing was
 * judged; only a real rejection is rubricated.
 */
export function OutcomePanel({
  outcome,
  message,
}: {
  outcome: OutcomeClass;
  message?: string;
}) {
  if (outcome === "verdict") return null;
  const copy = OUTCOMES[outcome];
  const rubricated = outcome === "expected";
  return (
    <div
      role="status"
      className="ig-rule px-4 py-4"
      style={{
        borderLeft: `3px solid ${rubricated ? "var(--rubric)" : "var(--thread)"}`,
      }}
    >
      <p className={`ig-calldata ${rubricated ? "ig-rubric" : ""}`}>{copy.tag}</p>
      <p className="ig-heading mt-1">{copy.headline}</p>
      <p className="ig-aside mt-2 max-w-[68ch]">{copy.body}</p>
      <p className="ig-aside mt-2 max-w-[68ch]">{copy.ledger}</p>
      {message ? (
        <details className="mt-3">
          <summary className="ig-label cursor-pointer">the exact message</summary>
          <p className="ig-calldata-sm mt-2 max-w-[80ch] break-words">{message}</p>
        </details>
      ) : null}
      {copy.retry ? (
        <p className="ig-aside mt-3">
          This is safe to retry. Nothing was written, so a second attempt is not a second opinion —
          it is a first one.
        </p>
      ) : null}
    </div>
  );
}

/** The four verdicts, for the reference section on /docs. */
export function VerdictLegend() {
  const order: ReviewStatus[] = ["ALIGNED", "DIVERGENT", "UNDERSPECIFIED", "UNDECODABLE"];
  return (
    <dl className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
      {order.map((status) => {
        const text = REVIEW_STATUS_TEXT[status];
        return (
          <div key={status} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-8">
            <dt className="min-w-[12rem] shrink-0">
              <span className={`ig-heading ${text.vetoes ? "ig-rubric" : ""}`}>{text.word}</span>
              <p className="ig-label mt-1">{text.vetoes ? "sets a veto flag" : "no veto"}</p>
            </dt>
            <dd className="max-w-[64ch]">
              <p className="ig-body">{text.meaning}</p>
              <p className="ig-aside mt-1 opacity-80">{text.limit}</p>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
