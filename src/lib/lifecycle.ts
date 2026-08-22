/**
 * The lifecycle of a write, named stage by stage.
 *
 * Two different things are being shown, and the UI is careful not to conflate
 * them:
 *
 *   1. `CLIENT_PHASES` — stages this browser genuinely observes: it validated the
 *      request, it asked for a signature, it got a hash, it is waiting on
 *      consensus, it settled.
 *
 *   2. `REVIEW_PROGRAM` — the work the contract performs inside the consensus
 *      window. A GenLayer node reports a consensus *status*, not per-phase
 *      progress, so these are rendered as a program of work known in advance,
 *      each row naming the source it reads and whether it is deterministic. They
 *      are never animated as if they were live telemetry, because they are not.
 *
 * The point of naming `corroborating` and `decoding` separately is didactic: a
 * reviewer watching this sees that all of the byte-level work is finished before
 * any inference begins, and that the inference is not doing the decoding.
 */

export type PhaseKey =
  | "validating"
  | "wallet-pending"
  | "submitted"
  | "consensus-running"
  | "settled";

export type ClientPhase = {
  key: PhaseKey;
  label: string;
  detail: string;
  /** Does reaching this phase cost the user a signature? */
  costsSignature: boolean;
};

export const CLIENT_PHASES: ClientPhase[] = [
  {
    key: "validating",
    label: "validating",
    detail:
      "Checked here, before anything is signed: the governor is in the adapter registry, the bond is above zero, the block hint is plausible. A malformed request is refused for free.",
    costsSignature: false,
  },
  {
    key: "wallet-pending",
    label: "wallet pending",
    detail: "Your wallet has been asked for a signature. Nothing has been sent yet.",
    costsSignature: true,
  },
  {
    key: "submitted",
    label: "submitted",
    detail: "The transaction hash exists and is linked below. Consensus has not run yet.",
    costsSignature: true,
  },
  {
    key: "consensus-running",
    label: "consensus running",
    detail:
      "Validators are executing the contract. The node reports the consensus stage; the program of work below is what the contract does inside that window.",
    costsSignature: true,
  },
  {
    key: "settled",
    label: "settled",
    detail: "Finalized, and the leader receipt has been re-read to confirm the execution result.",
    costsSignature: true,
  },
];

export type ProgramStep = {
  key: string;
  label: string;
  detail: string;
  /** Named out loud. "Never a bare spinner: name the source or don't show the row." */
  source: string;
  kind: "deterministic" | "network" | "inference";
};

export const REVIEW_PROGRAM: ProgramStep[] = [
  {
    key: "fetching-mandate",
    label: "fetching mandate",
    detail:
      "Validators independently read the ProposalCreated log for this proposal, from the caller's verified block hint. The decoded proposal id must equal the id requested, or the log is discarded rather than trusted.",
    source: "eth.blockscout.com/api/eth-rpc · eth_getLogs",
    kind: "network",
  },
  {
    key: "fetching-actions",
    label: "fetching actions",
    detail:
      "The Governor's getActions(uint256), selector 0x328dd982, is read from two independent explorers, so no single provider can decide what the proposal contains.",
    source: "two independent explorers · eth_call",
    kind: "network",
  },
  {
    key: "corroborating",
    label: "corroborating",
    detail:
      "Both action sets are canonicalised and hashed. The hashes must be equal. If they are not, the round refuses with UNDECODABLE and no inference is spent. No judgment is ever made on data that has not first been corroborated.",
    source: "byte comparison in the contract",
    kind: "deterministic",
  },
  {
    key: "decoding",
    label: "decoding",
    detail:
      "ABI decode: offsets, lengths, dynamic arrays, nested bytes to depth two. Each 4-byte selector is looked up and then verified by hashing: keccak256(text_signature)[:4] must equal the selector, or the signature is discarded and the action is treated as opaque.",
    source: "4byte.directory, verified by keccak. Deterministic, no inference",
    kind: "deterministic",
  },
  {
    key: "consensus-running",
    label: "scope correspondence",
    detail:
      "Only now does a model see anything, and what it sees is the decoded, selector-verified, corroborated action list, never raw calldata hex. It is asked one question: does the mandate authorise that? The answer is then re-checked deterministically, and a named index outside the action set is rejected as an error rather than written as a veto.",
    source: "validator inference",
    kind: "inference",
  },
];

/* -------------------------------------------------------------------------- */
/* Outcomes                                                                   */
/* -------------------------------------------------------------------------- */

export type OutcomeClass = "verdict" | "expected" | "external" | "transient" | "llm-error";

export type Outcome = {
  tag: string;
  headline: string;
  body: string;
  /** What happened to the bond. Success states always carry their limit. */
  ledger: string;
  retry: boolean;
};

/**
 * The distinction between an external fault and a rejection is the single most
 * important visual decision in this system, so it is also the most explicit one
 * in the copy. An external fault is not a finding about a proposal.
 */
export const OUTCOMES: Record<Exclude<OutcomeClass, "verdict">, Outcome> = {
  expected: {
    tag: "[EXPECTED]",
    headline: "Refused before anything was spent.",
    body: "The contract declined the call on a deterministic guard: an unknown governor, a proposal already reviewed, a bond that does not match, or a block hint that cannot hold this proposal's log. This is the mechanism working.",
    ledger: "No consensus ran. No bond moved.",
    retry: false,
  },
  external: {
    tag: "[EXTERNAL]",
    headline: "An explorer did not answer.",
    body: "A source the round depends on was unreachable, so the facts were never established. No verdict was written and no veto flag was set. This says nothing whatsoever about the proposal.",
    ledger: "Bond untouched. Re-running the review is the correct response.",
    retry: true,
  },
  transient: {
    tag: "[TRANSIENT]",
    headline: "A retryable consensus state, not a failure.",
    body: "Validators did not reach a determination within the round, either a timeout or an undetermined outcome. The round judged nothing and wrote nothing. It may simply be re-run.",
    ledger: "Bond untouched. Nothing was decided in either direction.",
    retry: true,
  },
  "llm-error": {
    tag: "[LLM_ERROR]",
    headline: "Validators could not agree, so nothing was written.",
    body: "Either the inference did not return a usable answer, or it named a diverging action that does not exist in the decoded set and the deterministic re-check rejected it. The round fails closed: no veto is ever written on an answer that failed its own re-check.",
    ledger: "Bond untouched. No veto flag set.",
    retry: true,
  },
};
