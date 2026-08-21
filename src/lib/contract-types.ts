/**
 * Every shape the Intent Guard Intelligent Contract exposes, exactly as its views
 * return them.
 *
 * Two things about the wire format that the whole app depends on:
 *
 *   1. `u256` fields arrive from views as decimal **strings**, not numbers. GEN
 *      amounts are wei-scaled strings; proposal ids, block numbers and action
 *      counts are unscaled integer strings. Nothing here is typed `number`.
 *   2. `diverging_index` uses a 0xFF..F sentinel to mean "no diverging action".
 *      Read it through `divergingIndex()` below, never directly.
 */

export type ReviewStatus =
  | "PENDING"
  | "ALIGNED"
  | "DIVERGENT"
  | "UNDERSPECIFIED"
  | "UNDECODABLE";

export type DivergenceKind =
  | "EXTRA_ACTION"
  | "PARAM_MISMATCH"
  | "WRONG_TARGET"
  | "UNAUTHORISED_SCOPE"
  | "OPAQUE_NESTED"
  | "NONE";

export type RebuttalStatus = "OPEN" | "UPHELD" | "WITHDRAWN_VETO" | "UNCLEAR";

/** One decoded entry of the Governor's `calldatas[]`, after the contract's
 *  deterministic ABI decode and keccak selector verification. */
export type DecodedAction = {
  index: string;
  target: string;
  /** wei, as a decimal string */
  value: string;
  selector: string;
  /**
   * The 4-byte signature's text form, and it is only ever populated when
   * `keccak(signature)[:4] == selector`. An empty string means the contract
   * refused to trust 4byte.directory's answer, so the action is opaque.
   */
  signature: string;
  resolved: boolean;
  nested_selector: string;
  nested_signature: string;
  nested_target: string;
  arg_summary: string;
};

export type Review = {
  id: string;
  requester: string;
  governor: string;
  proposal_id: string;
  creation_block: string;
  /** wei, as a decimal string */
  bond: string;
  status: ReviewStatus;
  mandate_digest: string;
  mandate_title: string;
  actions_digest: string;
  action_count: string;
  /** 0xFF..F sentinel when there is no diverging action. Use `divergingIndex()`. */
  diverging_index: string;
  divergence_kind: DivergenceKind;
  rationale: string;
  veto_flag: boolean;
  reviewed_at: string;
  override_vote_ref: string;

  /**
   * NOT part of the v1 contract surface. The contract records the mandate by
   * `mandate_digest` and `mandate_title` only — it never stores 7,141 bytes of
   * markdown on chain. Fixtures carry the prose so the apparatus can be read in
   * full; against the live contract this is `undefined` and the verso renders
   * the recorded mandate plus the clauses the verdict cites, saying so plainly.
   */
  mandate_text?: string;
  /** Optional, same caveat as `mandate_text`: which action each clause authorises. */
  mandate_clauses?: MandateClause[];
  /** Optional: which deterministic gate produced an UNDECODABLE refusal. */
  undecodable_gate?: UndecodableGate;
  /** Additional fields returned by the live contract state machine. */
  nondet_ops?: string;
  rebuttal_id?: string;
  rebuttal_deadline?: string;
  contested?: boolean;
  bond_settled?: boolean;
  bounty_paid?: boolean;
  rebuttable?: boolean;
  rereviewable?: boolean;
};

export type Rebuttal = {
  id: string;
  review_id: string;
  rebutter: string;
  argument_url: string;
  /** wei, as a decimal string */
  bond: string;
  status: RebuttalStatus;
  divergence_addressed?: string;
  rationale: string;
  settled_at: string;
  created_at?: string;
  bond_settled?: boolean;
};

/** The contract deliberately returns more than a bool: false can mean
 * "reviewed and clear" or "never reviewed". */
export type VetoState = {
  vetoed: boolean;
  reviewed: boolean;
  status: ReviewStatus | "";
  review_id: string;
  divergence_kind: DivergenceKind | "";
  diverging_index: string;
  override_vote_ref: string;
  note: string;
};

/**
 * A clause of the mandate, and the action indices it authorises. This is the
 * verso half of the apparatus: `cites` is what a connector thread is drawn from.
 */
export type MandateClause = {
  /** 0-based position in the mandate, used for the citation mark ①②③. */
  ordinal: number;
  text: string;
  /** Action indices this clause authorises. Empty means the clause is prose only. */
  cites: number[];
};

/** `UNDECODABLE` must always name the gate that failed. "Something went wrong"
 *  is not an acceptable output for a mechanism asking to be trusted with a veto. */
export type UndecodableGate =
  | "EXPLORER_UNREACHABLE"
  | "EXPLORER_DISAGREEMENT"
  | "PROPOSAL_ID_MISMATCH"
  | "SELECTOR_UNVERIFIABLE"
  | "DEPTH_LIMITED";

export const UNDECODABLE_GATE_TEXT: Record<UndecodableGate, string> = {
  EXPLORER_UNREACHABLE: "One of the two explorers did not answer. No bytes were compared.",
  EXPLORER_DISAGREEMENT:
    "Both explorers answered, and their decoded action sets did not hash identically. The facts were not established, so no judgment was made.",
  PROPOSAL_ID_MISMATCH:
    "The proposal id decoded out of the ProposalCreated log did not equal the id requested. The log was discarded rather than trusted.",
  SELECTOR_UNVERIFIABLE:
    "A 4-byte selector could not be confirmed by hashing, so the action was treated as opaque rather than named on a guess.",
  DEPTH_LIMITED:
    "The payload nests deeper than the contract's decode limit of two levels. Reported rather than silently ignored.",
};

/** 2^256 - 1, the "no diverging action" sentinel. */
export const NO_DIVERGENCE_SENTINEL =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

/** Reads `diverging_index` through the sentinel. Returns null for "none". */
export function divergingIndex(review: Pick<Review, "diverging_index">): number | null {
  const raw = (review.diverging_index ?? "").trim();
  if (!raw) return null;
  if (raw === NO_DIVERGENCE_SENTINEL) return null;
  // Tolerate the hex form of the same sentinel.
  if (/^0x[fF]{64}$/.test(raw)) return null;
  try {
    const value = BigInt(raw);
    // Anything at or above the sentinel-ish range is "none", not an index.
    if (value > 1_000_000n) return null;
    return Number(value);
  } catch {
    return null;
  }
}

export type StatusVerdict = {
  /** The word printed in the apparatus. */
  word: string;
  /** Does the status set a veto flag? */
  vetoes: boolean;
  /** One line: what the status means. */
  meaning: string;
  /** One line: what the status explicitly does not prove. Success carries its limit. */
  limit: string;
};

export const REVIEW_STATUS_TEXT: Record<ReviewStatus, StatusVerdict> = {
  PENDING: {
    word: "Pending",
    vetoes: false,
    meaning: "Requested and bonded. No review round has run yet.",
    limit: "Nothing has been read, decoded or judged. Absence of a veto here means nothing at all.",
  },
  ALIGNED: {
    word: "Aligned",
    vetoes: false,
    meaning: "Every decoded action is cited by the mandate, and no action falls outside it.",
    limit:
      "This says the bytes match the text. It does not say the proposal is good policy, that the recipients deserve funds, or that the parameters are wise.",
  },
  DIVERGENT: {
    word: "Divergent",
    vetoes: true,
    meaning:
      "One named action diverges from the mandate, by one named kind. A veto flag is set and a bounty paid.",
    limit:
      "A veto is a finding about text. It does not block execution on its own, and a fresh governance vote clears it.",
  },
  UNDERSPECIFIED: {
    word: "Underspecified",
    vetoes: false,
    meaning:
      "The mandate is too vague to authorise these particular bytes. Advisory flag only, no veto.",
    limit:
      "This is not an accusation. It records that the text does not reach the bytes either way, in either direction.",
  },
  UNDECODABLE: {
    word: "Undecodable",
    vetoes: false,
    meaning:
      "A deterministic gate failed before any judgment. No verdict, no veto, bond returned. A refusal, not a finding.",
    limit:
      "Nothing was judged. A flaky explorer is not evidence about a proposal, and this state is deliberately not a verdict.",
  },
};

export const DIVERGENCE_KIND_TEXT: Record<DivergenceKind, string> = {
  EXTRA_ACTION: "The action set contains an action the mandate never describes.",
  PARAM_MISMATCH: "The right function, with an argument the mandate does not authorise.",
  WRONG_TARGET: "The right function, aimed at an address the mandate does not name.",
  UNAUTHORISED_SCOPE: "The action exercises a power the mandate does not grant.",
  OPAQUE_NESTED: "The nested payload does not do what the outer description says it does.",
  NONE: "No diverging action was named.",
};

export const REBUTTAL_STATUS_TEXT: Record<RebuttalStatus, string> = {
  OPEN: "Bonded and awaiting an adversarial round. The veto stands while it is open.",
  UPHELD: "The rebuttal failed to defeat the stated divergence. The veto stands, and the rebutter's bond moved to the reviewer.",
  WITHDRAWN_VETO:
    "The rebuttal defeated the stated divergence. The veto is cleared, and the reviewer's bond compensated the proposer for the delay.",
  UNCLEAR:
    "Genuinely contested. The veto stands and is marked contested; both bonds were returned. Hard cases are not penalised.",
};

/* ------------------------------------------------------------------------- */
/* Transaction lifecycle                                                      */
/* ------------------------------------------------------------------------- */

/** `statusName` as reported by `getTransaction()` on a GenLayer node. */
export type TxStage =
  | "UNINITIALIZED"
  | "PENDING"
  | "PROPOSING"
  | "COMMITTING"
  | "REVEALING"
  | "ACCEPTED"
  | "UNDETERMINED"
  | "FINALIZED"
  | "CANCELED"
  | "APPEAL_REVEALING"
  | "APPEAL_COMMITTING"
  | "READY_TO_FINALIZE"
  | "VALIDATORS_TIMEOUT"
  | "LEADER_TIMEOUT";

/** The six stages a healthy round walks through, in order. */
export const CONSENSUS_STAGES: TxStage[] = [
  "PENDING",
  "PROPOSING",
  "COMMITTING",
  "REVEALING",
  "ACCEPTED",
  "FINALIZED",
];

/**
 * Not failures. A round that lands here has judged nothing and touched no bond;
 * validators may simply re-run it. Rendered in a visually distinct treatment
 * from a rejection everywhere in the app.
 */
export const RETRYABLE_STAGES = new Set<string>([
  "UNDETERMINED",
  "VALIDATORS_TIMEOUT",
  "LEADER_TIMEOUT",
]);

export const TERMINAL_STAGES = new Set<string>(["ACCEPTED", "FINALIZED", "CANCELED"]);

export type StoredTransaction = {
  hash: `0x${string}`;
  label: string;
  createdAt: string;
  status: TxStage;
  functionName: string;
  /** Which review the transaction belongs to, so the rail can link back. */
  reviewId?: string;
};

/** The client-side phase of a write, before and around the on-chain stages. */
export type WritePhase =
  | "idle"
  | "validating"
  | "wallet-pending"
  | "submitted"
  | "consensus-running"
  | "settled"
  | "expected"
  | "external"
  | "transient"
  | "llm-error";
