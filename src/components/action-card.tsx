"use client";

import type { ApparatusAction } from "@/lib/apparatus";
import { breakReason, threadSentence } from "@/lib/apparatus";
import type { Review } from "@/lib/contract-types";
import { DIVERGENCE_KIND_TEXT } from "@/lib/contract-types";
import { citationMark, citationWord, formatGen, shortenHex } from "@/lib/format";
import { targetLabel } from "@/lib/governors";
import { mainnetAddressUrl } from "@/lib/genlayer/config";

/** `arg_summary` is the contract's bounded deterministic rendering: `name = value`
 *  per line. Parsed, never reinterpreted. */
function argRows(summary: string): { name: string; value: string }[] {
  return summary
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf(" = ");
      if (at === -1) return { name: "", value: line };
      return { name: line.slice(0, at), value: line.slice(at + 3) };
    });
}

/**
 * Which argument rows carry the vermilion mark. This decides *where* an emphasis
 * is placed and never *whether* there is a divergence — that comes from the
 * contract's `diverging_index`. A row is marked when the verdict faults this
 * action and the row's own name appears in the contract's rationale.
 */
function faultedRows(entry: ApparatusAction, review: Review, rows: { name: string }[]) {
  if (!entry.faulted) return new Set<string>();
  const rationale = review.rationale.toLowerCase();
  const marked = rows.filter((row) => row.name && rationale.includes(row.name.toLowerCase()));
  if (marked.length > 0) return new Set(marked.map((row) => row.name));
  return new Set<string>();
}

function Row({
  label,
  children,
  marked = false,
}: {
  label: string;
  children: React.ReactNode;
  marked?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-1 sm:flex-row sm:gap-4">
      <span className={`ig-label min-w-[8.5rem] shrink-0 ${marked ? "ig-rubric" : ""}`}>
        {label}
      </span>
      <span className={`ig-calldata break-all ${marked ? "ig-rubric" : ""}`}>{children}</span>
    </div>
  );
}

function Address({ value }: { value: string }) {
  const label = targetLabel(value);
  return (
    <>
      <a
        href={mainnetAddressUrl(value)}
        target="_blank"
        rel="noreferrer"
        className="underline decoration-1 underline-offset-4"
        title={value}
      >
        {shortenHex(value, 10, 4)}
      </a>
      {label ? <span className="ig-aside ml-2 opacity-75">({label})</span> : null}
    </>
  );
}

/** `✓ verified by keccak` — the badge that says the naming is arithmetic, not a guess. */
export function KeccakSigil({ resolved }: { resolved: boolean }) {
  if (resolved) {
    return (
      <span className="ig-calldata-sm ig-verified ml-3 whitespace-nowrap">
        <span aria-hidden>✓</span> verified by keccak
      </span>
    );
  }
  return (
    <span className="ig-calldata-sm ig-rubric ml-3 whitespace-nowrap">
      <span aria-hidden>✗</span> not verified
    </span>
  );
}

export function ActionCard({
  entry,
  review,
  active,
  anchorRef,
  onFocusChange,
}: {
  entry: ApparatusAction;
  review: Review;
  active: boolean;
  anchorRef?: (node: HTMLElement | null) => void;
  onFocusChange?: (index: number | null) => void;
}) {
  const { action } = entry;
  const rows = argRows(action.arg_summary);
  const marked = faultedRows(entry, review, rows);
  const nested = Boolean(action.nested_target);

  const verdictWord =
    entry.thread === "absent"
      ? "unmandated"
      : entry.faulted
        ? review.divergence_kind.replaceAll("_", " ").toLowerCase()
        : !action.resolved
          ? "opaque"
          : "cited";

  const rubricated = entry.thread !== "intact";

  return (
    <article
      ref={anchorRef}
      id={`action-${entry.index}`}
      tabIndex={0}
      onFocus={() => onFocusChange?.(entry.index)}
      onBlur={() => onFocusChange?.(null)}
      onMouseEnter={() => onFocusChange?.(entry.index)}
      onMouseLeave={() => onFocusChange?.(null)}
      data-thread-active={active ? "true" : undefined}
      data-thread-kind={entry.thread}
      aria-current={active ? "true" : undefined}
      className="border border-[var(--rule-strong)] px-4 py-3"
      style={rubricated ? { borderLeft: "3px solid var(--rubric)" } : undefined}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-2">
        <h3 className="ig-heading">
          <span className={`mr-2 ${rubricated ? "ig-rubric" : ""}`} aria-hidden>
            {citationMark(entry.index)}
          </span>
          <span className="sr-only">{citationWord(entry.index)}: </span>
          {action.resolved ? action.signature : "unresolved selector"}
        </h3>
        <p className={`ig-label ${rubricated ? "ig-rubric" : ""}`}>{verdictWord}</p>
      </header>

      <div className="ig-rule pt-2">
        <Row label="target">
          <Address value={action.target} />
        </Row>
        <Row label="value">{formatGen(action.value)} GEN</Row>
        <Row label="selector">
          {action.selector}
          <KeccakSigil resolved={action.resolved} />
        </Row>
        {action.resolved ? (
          <Row label="signature">{action.signature}</Row>
        ) : (
          <Row label="signature" marked>
            none. 4byte.directory&apos;s answer failed keccak verification, so it was discarded
            rather than shown as a fact.
          </Row>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="ig-rule mt-2 pt-2">
          <p className="ig-label mb-1">decoded arguments</p>
          {rows.map((row, index) => (
            <Row key={`${row.name}-${index}`} label={row.name || "unnamed"} marked={marked.has(row.name)}>
              {row.value}
              {marked.has(row.name) ? (
                <span className="ig-calldata-sm ig-rubric ml-3" aria-hidden>
                  ✗ {breakReason(entry, review)}
                </span>
              ) : null}
            </Row>
          ))}
        </div>
      ) : null}

      {nested ? (
        <details className="ig-rule mt-2 pt-2" open={entry.faulted}>
          <summary className="ig-label cursor-pointer">nested payload · depth 1</summary>
          <div className="mt-1">
            <Row label="l2 target" marked={entry.faulted && review.divergence_kind === "OPAQUE_NESTED"}>
              <Address value={action.nested_target} />
            </Row>
            <Row label="selector">
              {action.nested_selector}
              <KeccakSigil resolved={Boolean(action.nested_signature)} />
            </Row>
            <Row
              label="signature"
              marked={entry.faulted && review.divergence_kind === "OPAQUE_NESTED"}
            >
              {action.nested_signature || "unresolved"}
            </Row>
          </div>
          <p className="ig-aside mt-2 max-w-[54ch]">
            The contract decodes two levels and no further. A payload nesting deeper is reported as
            depth-limited, never silently ignored.
          </p>
        </details>
      ) : null}

      <footer className="ig-rule mt-2 pt-2">
        <p className={`ig-aside ${rubricated ? "ig-rubric" : ""}`}>{threadSentence(entry)}</p>
        {entry.faulted ? (
          <p className="ig-aside mt-1">
            <span className="ig-label ig-rubric mr-2">
              {review.divergence_kind.replaceAll("_", " ").toLowerCase()}
            </span>
            {DIVERGENCE_KIND_TEXT[review.divergence_kind]}
          </p>
        ) : null}
      </footer>
    </article>
  );
}
