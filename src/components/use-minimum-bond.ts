"use client";

import { useEffect, useState } from "react";
import { minimumReviewBond } from "@/lib/genlayer/data-source";
import type { MinimumBond } from "@/lib/minimum-bond";

/**
 * Reads the contract's bond floor once, on mount.
 *
 * It starts as `reading` rather than as some optimistic default, because the first
 * paint of a form is exactly when someone might click submit, and at that moment the
 * honest answer is that the floor is not known yet. `bondRefusal` treats `reading`
 * as a refusal, so the gap is closed rather than papered over.
 */
export function useMinimumBond(): MinimumBond {
  const [minimum, setMinimum] = useState<MinimumBond>({ kind: "reading" });

  useEffect(() => {
    let live = true;
    minimumReviewBond()
      .then((result) => {
        if (live) setMinimum(result);
      })
      .catch((error: unknown) => {
        if (!live) return;
        setMinimum({
          kind: "unreadable",
          reason: error instanceof Error ? `${error.message}.` : `${String(error)}.`,
        });
      });
    return () => {
      live = false;
    };
  }, []);

  return minimum;
}
