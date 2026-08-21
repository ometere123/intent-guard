"use client";

import Link from "next/link";
import { useTransactions } from "@/components/transaction-provider";
import { CONSENSUS_STAGES, RETRYABLE_STAGES } from "@/lib/contract-types";
import { explorerTxUrl } from "@/lib/genlayer/config";
import { displayTime, shortenHex } from "@/lib/format";

const STAGE_NOTE: Record<string, string> = {
  PENDING: "queued at the node; no validator has been assigned",
  PROPOSING: "a leader is executing the contract and proposing a result",
  COMMITTING: "validators are committing sealed votes",
  REVEALING: "validators are revealing their votes",
  ACCEPTED: "accepted by consensus; awaiting finality",
  READY_TO_FINALIZE: "accepted; finality is a formality now",
  FINALIZED: "final. the leader receipt has been re-read",
  CANCELED: "canceled before execution",
  APPEAL_COMMITTING: "an appeal round is committing",
  APPEAL_REVEALING: "an appeal round is revealing",
  UNDETERMINED: "no determination was reached in the round",
  VALIDATORS_TIMEOUT: "validators did not answer in time",
  LEADER_TIMEOUT: "the leader did not answer in time",
  UNINITIALIZED: "submitted, not yet seen by the node",
};

export function TransactionRail({ onClose }: { onClose?: () => void }) {
  const { transactions, clear } = useTransactions();

  return (
    <aside className="border border-[var(--rule-strong)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3">
        <div>
          <p className="ig-label">ledger of writes</p>
          <p className="ig-aside mt-1 max-w-[62ch]">
            Kept in this browser and refreshed from the node every 15 seconds while a stage is
            still in flight. A row still active after two hours is marked undetermined rather than
            left spinning.
          </p>
        </div>
        <div className="flex gap-2">
          {transactions.length > 0 ? (
            <button type="button" className="ig-btn-quiet" onClick={clear}>
              clear
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className="ig-btn-quiet" onClick={onClose}>
              close
            </button>
          ) : null}
        </div>
      </div>

      <div className="ig-rule">
        {transactions.length === 0 ? (
          <p className="ig-aside px-4 py-4">
            Nothing yet. Requesting a review, running one, rebutting or adjudicating will appear
            here with its hash the moment the hash exists.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--rule)]">
            {transactions.map((tx) => {
              const retryable = RETRYABLE_STAGES.has(tx.status);
              const reached = CONSENSUS_STAGES.indexOf(tx.status);
              return (
                <li key={tx.hash} className="px-4 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="ig-body">{tx.label}</p>
                    <p className={`ig-calldata-sm ${retryable ? "" : "ig-label-ink"}`}>
                      {tx.status.replaceAll("_", " ").toLowerCase()}
                    </p>
                  </div>

                  <div
                    className="mt-3 flex gap-1"
                    role="img"
                    aria-label={`Consensus stage: ${tx.status.replaceAll("_", " ").toLowerCase()}`}
                  >
                    {CONSENSUS_STAGES.map((stage, index) => (
                      <span
                        key={stage}
                        title={stage.toLowerCase()}
                        className="h-[3px] flex-1"
                        style={{
                          background:
                            reached >= 0 && index <= reached
                              ? "var(--ink)"
                              : retryable
                                ? "var(--thread)"
                                : "var(--rule)",
                        }}
                      />
                    ))}
                  </div>

                  <p className="ig-aside mt-2">{STAGE_NOTE[tx.status] ?? tx.status.toLowerCase()}</p>

                  {retryable ? (
                    <p
                      className="ig-aside mt-2 max-w-[62ch] pl-3"
                      style={{ borderLeft: "3px solid var(--thread)" }}
                    >
                      This is a retryable consensus state, not a failure. The round judged nothing
                      and wrote nothing; validators may re-run it.
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                    <a
                      className="ig-calldata-sm underline decoration-1 underline-offset-4"
                      href={explorerTxUrl(tx.hash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortenHex(tx.hash, 10, 8)}
                    </a>
                    <span className="ig-label">{tx.functionName}</span>
                    <span className="ig-label">{displayTime(tx.createdAt)}</span>
                    {tx.reviewId ? (
                      <Link
                        href={`/reviews/${tx.reviewId}`}
                        className="ig-label ig-label-ink underline decoration-1 underline-offset-4"
                      >
                        {tx.reviewId}
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
