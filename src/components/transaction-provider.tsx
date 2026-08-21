"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { StoredTransaction, TxStage } from "@/lib/contract-types";
import { RETRYABLE_STAGES } from "@/lib/contract-types";
import { readTransactions, writeTransactions } from "@/lib/storage";
import { createReadClient } from "@/lib/genlayer/read-client";
import type { TransactionHash } from "genlayer-js/types";
import { inspectGenVMExecution } from "@/lib/genlayer/execution";

type TransactionContextValue = {
  transactions: StoredTransaction[];
  clear: () => void;
  track: (tx: StoredTransaction) => void;
  update: (hash: StoredTransaction["hash"], status: TxStage, executionResult?: StoredTransaction["executionResult"], executionError?: string) => void;
};

const TransactionContext = createContext<TransactionContextValue | null>(null);

const COMPLETE_STATUSES = ["FINALIZED", "CANCELED", "UNDETERMINED"] as const;
const ACTIVE_STATUSES = [
  "PENDING",
  "PROPOSING",
  "COMMITTING",
  "REVEALING",
  "READY_TO_FINALIZE",
  "APPEAL_COMMITTING",
  "APPEAL_REVEALING",
] as const;

/** After two hours a still-active row is not in flight, it is abandoned. */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

function shouldRefresh(tx: StoredTransaction) {
  if (!ACTIVE_STATUSES.includes(tx.status as never)) return false;
  const created = Date.parse(tx.createdAt);
  return Number.isNaN(created) || Date.now() - created < STALE_AFTER_MS;
}

function normalizeStoredTransactions(items: StoredTransaction[]) {
  return items.map((tx) =>
    COMPLETE_STATUSES.includes(tx.status as never) || shouldRefresh(tx)
      ? tx
      : { ...tx, status: "UNDETERMINED" as TxStage },
  );
}

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<StoredTransaction[]>(() =>
    typeof window === "undefined" ? [] : normalizeStoredTransactions(readTransactions()),
  );

  const persist = useCallback((items: StoredTransaction[]) => {
    setTransactions(items);
    writeTransactions(items);
  }, []);

  const track = useCallback(
    (tx: StoredTransaction) => {
      persist([tx, ...readTransactions().filter((item) => item.hash !== tx.hash)]);
    },
    [persist],
  );

  const update = useCallback(
    (hash: StoredTransaction["hash"], status: TxStage, executionResult?: StoredTransaction["executionResult"], executionError?: string) => {
      persist(readTransactions().map((item) => (item.hash === hash ? { ...item, status, executionResult, executionError } : item)));
    },
    [persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  useEffect(() => {
    const staleMarked = normalizeStoredTransactions(readTransactions());
    writeTransactions(staleMarked);
    const pending = staleMarked.filter(shouldRefresh);
    if (pending.length === 0) return;
    const client = createReadClient();
    let cancelled = false;

    async function refresh() {
      const refreshed = await Promise.all(
        pending.map(async (tx) => {
          try {
            const onchain = await client.getTransaction({ hash: tx.hash as TransactionHash });
            const status = String(onchain?.statusName ?? tx.status).toUpperCase() as TxStage;
            const outcome = status === "FINALIZED" ? inspectGenVMExecution(onchain) : {};
            return { ...tx, status, ...outcome };
          } catch {
            const created = Date.parse(tx.createdAt);
            if (!Number.isNaN(created) && Date.now() - created >= STALE_AFTER_MS) {
              return { ...tx, status: "UNDETERMINED" as TxStage };
            }
            return tx;
          }
        }),
      );
      if (cancelled) return;
      const current = readTransactions();
      const byHash = new Map(refreshed.map((tx) => [tx.hash, tx]));
      persist(current.map((tx) => byHash.get(tx.hash) ?? tx));
    }

    refresh();
    const interval = window.setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [persist]);

  const value = useMemo(
    () => ({ transactions, clear, track, update }),
    [clear, track, transactions, update],
  );
  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
}

export function useTransactions() {
  const value = useContext(TransactionContext);
  if (!value) throw new Error("useTransactions must be used inside TransactionProvider");
  return value;
}

export function isRetryableStage(status: string) {
  return RETRYABLE_STAGES.has(status);
}
