"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Apparatus as ApparatusModel, ApparatusAction } from "@/lib/apparatus";
import type { Review } from "@/lib/contract-types";
import { citationMark, citationWord } from "@/lib/format";
import { ActionCard } from "@/components/action-card";

type Line = { key: string; y1: number; y2: number; kind: "intact" | "broken"; order: number };

/**
 * The facing-page apparatus.
 *
 * Verso carries the mandate. Recto carries the calldata. The 96px gutter between
 * them carries the connector threads, and it is the widest space on the page. A
 * thread is drawn only where a mandate clause authorises a decoded action; where
 * an action has no thread, the gutter is left empty, because that absence is the
 * finding and nothing may stand in for it.
 *
 * Every relationship the threads express is also stated in words on each card, so
 * the page is complete with no SVG rendered at all.
 */
export function Apparatus({
  model,
  review,
}: {
  model: ApparatusModel;
  review: Review;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const clauseNodes = useRef(new Map<number, HTMLElement>());
  const actionNodes = useRef(new Map<number, HTMLElement>());
  const [lines, setLines] = useState<Line[]>([]);
  const [gutter, setGutter] = useState(96);
  const [height, setHeight] = useState(0);
  const [activeAction, setActiveAction] = useState<number | null>(null);
  const [activeClause, setActiveClause] = useState<number | null>(null);

  const measure = useCallback(() => {
    const root = container.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    setHeight(box.height);
    const gutterEl = root.querySelector<HTMLElement>("[data-gutter]");
    setGutter(gutterEl?.getBoundingClientRect().width ?? 0);

    const next: Line[] = [];
    let order = 0;
    for (const entry of model.actions) {
      if (entry.thread === "absent") continue;
      const actionNode = actionNodes.current.get(entry.index);
      if (!actionNode) continue;
      const actionBox = actionNode.getBoundingClientRect();
      const y2 = actionBox.top - box.top + 28;
      for (const ordinal of entry.citedBy) {
        const clauseNode = clauseNodes.current.get(ordinal);
        if (!clauseNode) continue;
        const clauseBox = clauseNode.getBoundingClientRect();
        next.push({
          key: `${ordinal}-${entry.index}`,
          y1: clauseBox.top - box.top + Math.min(clauseBox.height / 2, 24),
          y2,
          kind: entry.thread,
          order: order++,
        });
      }
    }
    setLines(next);
  }, [model.actions]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(root);
    for (const node of actionNodes.current.values()) observer.observe(node);
    for (const node of clauseNodes.current.values()) observer.observe(node);
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const registerClause = (ordinal: number) => (node: HTMLElement | null) => {
    if (node) clauseNodes.current.set(ordinal, node);
    else clauseNodes.current.delete(ordinal);
  };
  const registerAction = (index: number) => (node: HTMLElement | null) => {
    if (node) actionNodes.current.set(index, node);
    else actionNodes.current.delete(index);
  };

  const clauseHighlights = new Set<number>();
  if (activeAction !== null) {
    const entry = model.actions.find((item) => item.index === activeAction);
    entry?.citedBy.forEach((ordinal) => clauseHighlights.add(ordinal));
  }
  const actionHighlights = new Set<number>();
  if (activeClause !== null) {
    const clause = model.clauses.find((item) => item.ordinal === activeClause);
    clause?.resolvedCites.forEach((index) => actionHighlights.add(index));
  }

  return (
    <>
      {/* ---- The spread. 900px and up. ---- */}
      <div
        ref={container}
        className="relative hidden grid-cols-[minmax(0,1fr)_var(--gutter)_minmax(0,1fr)] spread:grid"
      >
        <section className="ig-verso pr-2" aria-labelledby="verso-head">
          <h2 id="verso-head" className="ig-label mb-4">
            verso — the mandate
          </h2>
          <ol className="flex flex-col gap-5">
            {model.clauses.map((clause) => (
              <li
                key={clause.ordinal}
                ref={registerClause(clause.ordinal)}
                tabIndex={0}
                onFocus={() => setActiveClause(clause.ordinal)}
                onBlur={() => setActiveClause(null)}
                onMouseEnter={() => setActiveClause(clause.ordinal)}
                onMouseLeave={() => setActiveClause(null)}
                aria-current={clauseHighlights.has(clause.ordinal) ? "true" : undefined}
                data-thread-active={
                  clauseHighlights.has(clause.ordinal) || activeClause === clause.ordinal
                    ? "true"
                    : undefined
                }
                className="pl-3"
              >
                <p className="ig-body">{clause.text}</p>
                <p className="ig-label mt-1">
                  {clause.resolvedCites.length === 0 ? (
                    "prose only — authorises no action"
                  ) : (
                    <>
                      authorises{" "}
                      {clause.resolvedCites.map((index, position) => (
                        <span key={index}>
                          {position > 0 ? " and " : ""}
                          <span aria-hidden>{citationMark(index)}</span>
                          <span className="sr-only">{citationWord(index)}</span>
                        </span>
                      ))}
                    </>
                  )}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---- The apparatus gutter. ---- */}
        <div data-gutter className="ig-fold relative" aria-hidden>
          <svg
            width={gutter}
            height={height}
            viewBox={`0 0 ${Math.max(gutter, 1)} ${Math.max(height, 1)}`}
            className="absolute inset-0"
            role="presentation"
          >
            {lines.map((line) => {
              const w = Math.max(gutter, 1);
              const path = `M 0 ${line.y1} C ${w * 0.42} ${line.y1}, ${w * 0.58} ${line.y2}, ${w} ${line.y2}`;
              return (
                <g key={line.key} style={{ ["--thread-order" as string]: line.order }}>
                  <path
                    d={path}
                    className="ig-thread"
                    pathLength={1}
                    fill="none"
                    stroke={line.kind === "broken" ? "var(--rubric)" : "var(--thread)"}
                    strokeWidth={line.kind === "broken" ? 1.25 : 1}
                  />
                  {line.kind === "broken" ? (
                    <g className="ig-thread-break">
                      <path
                        d={`M ${w - 9} ${line.y2 - 4.5} L ${w - 1} ${line.y2 + 4.5}`}
                        stroke="var(--rubric)"
                        strokeWidth={1.4}
                      />
                      <path
                        d={`M ${w - 1} ${line.y2 - 4.5} L ${w - 9} ${line.y2 + 4.5}`}
                        stroke="var(--rubric)"
                        strokeWidth={1.4}
                      />
                    </g>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>

        <section className="ig-recto pl-2" aria-labelledby="recto-head">
          <h2 id="recto-head" className="ig-label mb-4">
            recto — the execution
          </h2>
          <ol className="flex flex-col gap-5">
            {model.actions.map((entry) => (
              <li key={entry.index}>
                <ActionCard
                  entry={entry}
                  review={review}
                  active={actionHighlights.has(entry.index) || activeAction === entry.index}
                  anchorRef={registerAction(entry.index)}
                  onFocusChange={setActiveAction}
                />
              </li>
            ))}
            {model.actions.length === 0 ? (
              <li className="ig-aside">
                No action set is recorded for this review. Nothing has been decoded.
              </li>
            ) : null}
          </ol>
        </section>
      </div>

      {/* ---- Below 900px: one interleaved column, unmandated actions last. ---- */}
      <MobileApparatus model={model} review={review} />
    </>
  );
}

function MobileApparatus({ model, review }: { model: ApparatusModel; review: Review }) {
  const mandated = model.actions.filter((entry) => entry.thread !== "absent");
  const unmandated = model.actions.filter((entry) => entry.thread === "absent");

  return (
    <div className="flex flex-col gap-8 spread:hidden">
      <ol className="flex flex-col gap-8">
        {model.clauses.map((clause) => (
          <li key={clause.ordinal} className="flex flex-col gap-4">
            <div className="ig-verso">
              <p className="ig-label mb-1">mandate</p>
              <p className="ig-body">{clause.text}</p>
            </div>
            {clause.resolvedCites.length === 0 ? (
              <p className="ig-label">authorises no action</p>
            ) : (
              <div className="ig-recto flex flex-col gap-4 p-3">
                <p className="ig-label">authorises</p>
                {clause.resolvedCites.map((index) => {
                  const entry = mandated.find((item) => item.index === index);
                  if (!entry) return null;
                  return <ActionCard key={index} entry={entry} review={review} active={false} />;
                })}
              </div>
            )}
          </li>
        ))}
      </ol>

      {unmandated.length > 0 ? (
        <section className="pt-2" style={{ borderTop: "1px solid var(--rubric)" }}>
          <h2 className="ig-label ig-rubric mt-3">no mandate found</h2>
          <p className="ig-aside mt-1 max-w-[60ch]">
            {unmandated.length === 1 ? "This action is" : "These actions are"} in the calldata and
            in no sentence of the mandate.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {unmandated.map((entry) => (
              <ActionCard key={entry.index} entry={entry} review={review} active={false} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function ApparatusLegend({ model }: { model: ApparatusModel }) {
  const items: [string, string, string][] = [
    ["intact", "var(--thread)", "a clause cites this action and the verdict does not fault it"],
    ["broken", "var(--rubric)", "cited, and either faulted or its selector never verified"],
    ["absent", "transparent", "no clause cites it — there is no thread, and that is the finding"],
  ];
  const present = new Set<ApparatusAction["thread"]>(model.actions.map((entry) => entry.thread));
  return (
    <ul className="flex flex-wrap gap-x-8 gap-y-2">
      {items.map(([name, colour, meaning]) => (
        <li key={name} className={`flex items-baseline gap-2 ${present.has(name as never) ? "" : "opacity-40"}`}>
          <svg width="28" height="8" aria-hidden className="shrink-0 translate-y-[2px]">
            {colour === "transparent" ? (
              <line x1="0" y1="4" x2="28" y2="4" stroke="var(--rule)" strokeDasharray="2 3" />
            ) : (
              <line x1="0" y1="4" x2="28" y2="4" stroke={colour} strokeWidth="1.2" />
            )}
          </svg>
          <span className="ig-label ig-label-ink">{name}</span>
          <span className="ig-aside">{meaning}</span>
        </li>
      ))}
    </ul>
  );
}
