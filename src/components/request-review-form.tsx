"use client";

import { useState } from "react";
import { GOVERNORS, findGovernor } from "@/lib/governors";
import { genToWei } from "@/lib/format";
import { bondRefusal, minimumBondLabel, openingBond } from "@/lib/minimum-bond";
import { useMinimumBond } from "@/components/use-minimum-bond";
import { useWriteRunner } from "@/components/write-runner";
import { Lifecycle } from "@/components/lifecycle";

/** The window the PRD's evidence sits in, used to sanity-check a block hint. */
const PLAUSIBLE_BLOCK_MIN = 10_000_000n;
const PLAUSIBLE_BLOCK_MAX = 40_000_000n;

/**
 * The bond the field opens with, before the contract has answered. It is a starting
 * value in a text box, not the rule: `bondRefusal` compares against whatever
 * `stats().min_review_bond_wei` says, and once that arrives an untouched field shows it
 * instead. Chosen to be the cheapest bond the deployed contract accepts, because a form
 * that opens at 2 GEN quietly asks for two thousand times the floor.
 */
const OPENING_BOND = "0.001";

export function RequestReviewForm() {
  const { state, run, reset, walletGate } = useWriteRunner();
  const minimum = useMinimumBond();
  const [id, setId] = useState("");
  const [governor, setGovernor] = useState(GOVERNORS[0]?.address ?? "");
  const [proposalId, setProposalId] = useState("");
  const [block, setBlock] = useState("");
  const [typedBond, setTypedBond] = useState<string | null>(null);

  // Derived, not stored: an untouched field shows the contract's floor as soon as
  // `stats()` answers, and anything typed wins from that keystroke onwards.
  const bond = typedBond ?? openingBond(minimum, OPENING_BOND);

  const entry = findGovernor(governor);
  const busy = state.phase !== "idle";

  function preflight(): string | null {
    if (walletGate) return `${walletGate} Requesting a review is a payable write.`;
    if (!/^[A-Za-z0-9-]{3,40}$/.test(id.trim())) {
      return "A review id is 3 to 40 characters of letters, digits and hyphens. It is the record's primary key, so it has to be stable.";
    }
    if (!entry) {
      return `${governor} is not in the adapter registry. The contract refuses unknown governors rather than guessing at their ABI, so this is refused here before you sign.`;
    }
    if (!entry.supported) {
      return `${entry.label} uses a governance implementation whose adapter is not shipped yet. It is refused rather than guessed at.`;
    }
    if (!/^\d+$/.test(proposalId.trim()) || BigInt(proposalId.trim()) === 0n) {
      return "A proposal id is a positive integer, as the Governor stores it.";
    }
    if (!/^\d+$/.test(block.trim())) {
      return "A creation block is an integer. It is a hint, and the contract verifies it: the decoded log's proposal id must equal the id above, or the log is discarded.";
    }
    const blockValue = BigInt(block.trim());
    if (blockValue < PLAUSIBLE_BLOCK_MIN || blockValue > PLAUSIBLE_BLOCK_MAX) {
      return `Block ${blockValue} is outside the plausible range for Ethereum mainnet. The contract applies the same check before it fetches anything.`;
    }
    return bondRefusal(bond, minimum);
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        className="grid gap-x-8 gap-y-5 spread:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          run({
            label: `request_review(${id.trim()})`,
            functionName: "request_review",
            args: [id.trim(), governor, BigInt(proposalId.trim() || "0"), BigInt(block.trim() || "0")],
            value: (() => {
              try {
                return genToWei(bond);
              } catch {
                return 0n;
              }
            })(),
            reviewId: id.trim(),
            preflight,
          });
        }}
      >
        <Field label="review id" hint="Your own identifier for this record, for example IG-UNI-100.">
          <input className="ig-input" value={id} onChange={(e) => setId(e.target.value)} />
        </Field>

        <Field
          label="governor"
          hint="Only governors in the adapter registry can be reviewed. An unknown address reverts before any network call."
        >
          <select className="ig-select" value={governor} onChange={(e) => setGovernor(e.target.value)}>
            {GOVERNORS.map((item) => (
              <option key={item.address} value={item.address}>
                {item.label} {item.supported ? "" : "(adapter not shipped)"}
              </option>
            ))}
          </select>
          {entry ? (
            <p className="ig-calldata-sm mt-1 break-all opacity-75">{entry.address}</p>
          ) : null}
        </Field>

        <Field label="proposal id" hint="As the Governor stores it.">
          <input
            className="ig-input"
            inputMode="numeric"
            value={proposalId}
            onChange={(e) => setProposalId(e.target.value)}
          />
        </Field>

        <Field
          label="creation block"
          hint="A hint that bounds the eth_getLogs window. It cannot forge a review: the decoded log's id must equal the id above."
        >
          <input
            className="ig-input"
            inputMode="numeric"
            value={block}
            onChange={(e) => setBlock(e.target.value)}
          />
        </Field>

        <Field
          label="bond, in GEN"
          hint="Returned on every honest verdict. Returned plus a bounty if a real divergence is found. A rebuttal must match it exactly."
        >
          <input
            className="ig-input"
            value={bond}
            onChange={(e) => setTypedBond(e.target.value)}
          />
          <p className="ig-calldata-sm mt-1 opacity-75">{minimumBondLabel(minimum)}</p>
        </Field>

        <div className="flex items-end">
          <button type="submit" className="ig-btn" disabled={busy}>
            request the review
          </button>
        </div>
      </form>

      <section className="border-t border-[var(--rule)] pt-4">
        <p className="ig-label">what this call checks, deterministically, before it costs anything</p>
        <ol className="ig-aside mt-2 flex max-w-[74ch] flex-col gap-1">
          <li>1 · the governor is in the adapter registry</li>
          <li>2 · this proposal has not already been reviewed</li>
          <li>3 · the bond meets the minimum the contract publishes</li>
          <li>4 · the block hint is plausible</li>
        </ol>
        <p className="ig-aside mt-2 max-w-[74ch]">
          No consensus runs here, and no explorer is contacted. A malformed request never reaches
          the expensive part of the mechanism. The same four checks run in this browser first, so a
          bad request does not cost you a signature either.
        </p>
      </section>

      <Lifecycle state={state} />

      {state.phase === "settled" ? (
        <button type="button" className="ig-btn-quiet self-start" onClick={reset}>
          request another
        </button>
      ) : null}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="ig-label">{label}</span>
      {children}
      <span className="ig-aside max-w-[46ch] opacity-80">{hint}</span>
    </label>
  );
}
