"use client";

import { useCallback, useState } from "react";
import type { CalldataEncodable, TransactionHash } from "genlayer-js/types";
import { useWallet } from "@/components/wallet-provider";
import { useTransactions } from "@/components/transaction-provider";
import { waitAccepted, writeContract } from "@/lib/genlayer/contract";
import { IS_LIVE } from "@/lib/genlayer/config";
import type { OutcomeClass } from "@/lib/lifecycle";
import type { PhaseKey } from "@/lib/lifecycle";

export type WriteState = {
  phase: PhaseKey | "idle";
  hash?: TransactionHash;
  /** Set only when the round did not produce a verdict. */
  outcome?: OutcomeClass;
  /** The exact message, kept verbatim. Never replaced with "something went wrong". */
  message?: string;
};

const IDLE: WriteState = { phase: "idle" };

/**
 * Classifies a thrown error into the four non-verdict outcome classes. The class
 * decides how the failure is *rendered* — an external fault must never look like a
 * rejection — and the original message is always shown alongside it.
 */
function classify(message: string): OutcomeClass {
  const text = message.toLowerCase();
  if (
    text.includes("user rejected") ||
    text.includes("user denied") ||
    text.includes("request rejected")
  ) {
    return "expected";
  }
  if (text.includes("undetermined") || text.includes("timeout") || text.includes("rotation")) {
    return "transient";
  }
  if (
    text.includes("unreachable") ||
    text.includes("explorer") ||
    text.includes("network") ||
    text.includes("fetch failed") ||
    text.includes("rate limit")
  ) {
    return "external";
  }
  if (
    text.includes("could not agree") ||
    text.includes("llm") ||
    text.includes("out of range") ||
    text.includes("malformed")
  ) {
    return "llm-error";
  }
  return "expected";
}

/** The injected-wallet hint rainline learned the hard way; kept verbatim in spirit. */
function writeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("does not support") || message.includes("Unsupported method")) {
    return `${message} — some injected wallets do not implement the GenLayer RPC methods. A browser wallet from the signing panel will work.`;
  }
  return message;
}

export function useWriteRunner() {
  const wallet = useWallet();
  const { track, update } = useTransactions();
  const [state, setState] = useState<WriteState>(IDLE);

  const reset = useCallback(() => setState(IDLE), []);

  /**
   * `preflight` runs entirely in this browser and must return a plain-language
   * refusal string, or null. A cheap rejection never costs a signature.
   */
  const run = useCallback(
    async (options: {
      label: string;
      functionName: string;
      args: CalldataEncodable[];
      value?: bigint;
      reviewId?: string;
      preflight?: () => string | null;
    }) => {
      setState({ phase: "validating" });
      const refusal = options.preflight?.() ?? null;
      if (refusal) {
        setState({ phase: "idle", outcome: "expected", message: refusal });
        return { ok: false as const };
      }

      if (!IS_LIVE) {
        setState({
          phase: "idle",
          outcome: "expected",
          message:
            "No Intent Guard contract is configured, so this write was refused here rather than sent nowhere. Set NEXT_PUBLIC_INTENT_GUARD_CONTRACT and NEXT_PUBLIC_INTENT_GUARD_DATA=live to send it. Validation above ran for real.",
        });
        return { ok: false as const };
      }

      try {
        setState({ phase: "wallet-pending" });
        const client = await wallet.getWriteClient();
        const hash = await writeContract(
          client,
          options.functionName,
          options.args,
          options.value ?? 0n,
        );
        setState({ phase: "submitted", hash });
        track({
          hash,
          label: options.label,
          createdAt: new Date().toISOString(),
          status: "PENDING",
          functionName: options.functionName,
          reviewId: options.reviewId,
        });
        setState({ phase: "consensus-running", hash });
        const outcome = await waitAccepted(client, hash);
        update(hash, "FINALIZED", outcome.executionResult, outcome.executionError);
        setState({ phase: "settled", hash });
        return { ok: true as const, hash };
      } catch (error) {
        const message = writeErrorMessage(error);
        setState((previous) => ({
          phase: "idle",
          hash: previous.hash,
          outcome: classify(message),
          message,
        }));
        return { ok: false as const };
      }
    },
    [track, update, wallet],
  );

  return { state, run, reset, connected: wallet.mode !== "none" };
}
