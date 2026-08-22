/**
 * The fixture review ledger. Shapes and caveats: see `mock-actions.ts`.
 *
 * Between them these nine records cover every state the UI has to render: each of
 * the five statuses, all five divergence kinds, a veto standing, a veto contested,
 * a veto cleared by rebuttal, a veto cleared by a fresh vote, an unverifiable
 * selector, and a review with no mandate prose available at all.
 */

import type { MandateClause, Rebuttal, Review } from "./contract-types";
import { MANDATES, MOCK_ACTIONS, NONE, GEN, UNI, COMP } from "./mock-actions";

const clauses = (...items: [string, number[]][]): MandateClause[] =>
  items.map(([text, cites], ordinal) => ({ ordinal, text, cites }));

const REQUESTER_A = "0x4C21e9A7bD3f8E5c1B0a9D8e7F6a5B4c3D2e1F09";
const REQUESTER_B = "0x8dF1c2A3b4E5d6C7a8B9c0D1e2F3a4B5c6D7e8F9";
const REQUESTER_C = "0x2b7A9c8D5e4F3a2B1c0D9e8F7a6B5c4D3e2F1a0B";
const PROPOSER = "0x6E5d4C3b2A1f0E9d8C7b6A5f4E3d2C1b0A9f8E7d";

export const MOCK_REVIEWS: Review[] = [
  {
    id: "IG-UNI-104",
    requester: REQUESTER_B,
    governor: UNI,
    proposal_id: "104",
    creation_block: "25601442",
    bond: GEN("2"),
    status: "PENDING",
    mandate_digest: "",
    mandate_title: "",
    actions_digest: "",
    action_count: "0",
    diverging_index: NONE,
    divergence_kind: "NONE",
    rationale: "",
    veto_flag: false,
    reviewed_at: "",
    override_vote_ref: "",
  },
  {
    id: "IG-UNI-100",
    requester: REQUESTER_A,
    governor: UNI,
    proposal_id: "100",
    creation_block: "25554834",
    bond: GEN("5"),
    status: "ALIGNED",
    mandate_digest: "0x9c1f4d7a2b8e5306af41c9d2e7b03518fa6d94c07e2b8153da4f60c9187be32d",
    mandate_title: "# Activate v4 Protocol Fees (Part 1/2)",
    actions_digest: "0x4e7b21c8d59a0f36e1b74dc082a951fd3e6b704c19d8a25370fbe61c84d29073",
    action_count: "2",
    diverging_index: NONE,
    divergence_kind: "NONE",
    rationale:
      "Two actions, both retryable tickets through the Delayed Inbox. The Specification section names the inbox, both PoolManager addresses and the function set on each, and the decoded nested selector on each ticket is setProtocolFeeController, keccak-verified. Both refund addresses are the Timelock the mandate names. The out-of-scope paragraph excludes fee values, mainnet pool authority and any admin change; no decoded action touches any of them.",
    veto_flag: false,
    reviewed_at: "2026-08-14T09:12:44Z",
    override_vote_ref: "",
    mandate_text: MANDATES["IG-UNI-100"],
    mandate_clauses: clauses(
      [
        "The Timelock will send two retryable tickets through the Arbitrum Delayed Inbox at 0x1a07cc4b…7a2d.",
        [0, 1],
      ],
      [
        "The first ticket calls setProtocolFeeController on the v4 PoolManager at 0x8bceaa40…937f, setting the controller to the DAO-owned controller contract.",
        [0],
      ],
      [
        "The second ticket calls setProtocolFeeController on the second v4 PoolManager at 0x1f7d7550…2efa, setting the same controller.",
        [1],
      ],
      [
        "Both tickets carry zero L2 call value, and the excess fee refund address and call value refund address are both the Uniswap Timelock, so any unspent gas returns to the treasury.",
        [0, 1],
      ],
      [
        "This proposal does not set any fee value. It does not grant the controller authority over mainnet pools. It does not change the Timelock admin, the Governor, or the UNI token.",
        [],
      ],
    ),
  },
  {
    id: "IG-UNI-91",
    requester: REQUESTER_A,
    governor: UNI,
    proposal_id: "91",
    creation_block: "25204118",
    bond: GEN("5"),
    status: "DIVERGENT",
    mandate_digest: "0x71ad3e9c05b8f2461d7ea0c39b5482f16c0d7e93ab254608df19c7b3025ea4f8",
    mandate_title: "# Sweep stranded router balances to the treasury",
    actions_digest: "0xb3097e51ca2d846f0b7e93125d8a4c60ef317ba9d452081c6e7f39ab04d15c27",
    action_count: "2",
    diverging_index: "1",
    divergence_kind: "WRONG_TARGET",
    rationale:
      "The mandate names one recipient for swept funds, the Uniswap Timelock at 0x1a9C8182C09F50C8318d769245beA52c32BE35BC, and states that recovered funds go there and nowhere else. Action 1 sweeps to 0x1a9C8182C09F50C8318d769245beA52c32BE35BB. The recipient differs from the mandated address in its final character. Action 0 sweeps to the mandated address and is unobjectionable.",
    veto_flag: true,
    reviewed_at: "2026-07-30T16:41:02Z",
    override_vote_ref: "",
    mandate_text: MANDATES["IG-UNI-91"],
    mandate_clauses: clauses(
      [
        "The Timelock will call sweepToken on the router, sweeping the stranded balance to the Uniswap Timelock at 0x1a9C8182C09F50C8318d769245beA52c32BE35BC.",
        [0, 1],
      ],
      ["Recovered funds go to the Timelock and nowhere else. No other recipient is authorised by this proposal.", [0, 1]],
    ),
  },
  {
    id: "IG-UNI-68",
    requester: REQUESTER_C,
    governor: UNI,
    proposal_id: "68",
    creation_block: "24118907",
    bond: GEN("3"),
    status: "DIVERGENT",
    mandate_digest: "0x2fa8c15d94e07b3612cd8a0f5b93e746210c8df95a3b7e0416cd982a7f5b301e",
    mandate_title: "# Fund the v3 Grants Committee (Wave 4)",
    actions_digest: "0x8c40b7e2159da638f0c47b21e9d5038a6f1cb724e05938da2c71b6f0e483a91d",
    action_count: "3",
    diverging_index: "2",
    divergence_kind: "EXTRA_ACTION",
    rationale:
      "The mandate describes two changes: a UNI transfer and a fee-recipient update. Both appear, at actions 0 and 1, with the amount and recipient the text names. Action 2 calls setOwner(address) on the fee collector, transferring ownership to 0xB2d81E4f…9293. No sentence of the mandate cites it, and the out-of-scope paragraph states that the proposal does not change ownership of any contract or transfer any administrative right. The action set exceeds the mandate by one action.",
    veto_flag: true,
    reviewed_at: "2026-06-11T11:03:58Z",
    override_vote_ref: "",
    mandate_text: MANDATES["IG-UNI-68"],
    mandate_clauses: clauses(
      [
        "The Timelock will call transfer on the UNI token at 0x1f9840a8…F984, sending 250,000 UNI to the Grants Committee multisig.",
        [0],
      ],
      [
        "The Timelock will then call setFeeRecipient on the fee collector, setting the recipient to the Grants Committee multisig treasury address.",
        [1],
      ],
      [
        "This proposal does not change ownership of any contract. It does not alter the Timelock admin or transfer any administrative right.",
        [],
      ],
    ),
  },
  {
    id: "IG-UNI-83",
    requester: REQUESTER_A,
    governor: UNI,
    proposal_id: "83",
    creation_block: "24802651",
    bond: GEN("4"),
    status: "DIVERGENT",
    mandate_digest: "0x5d18b7a3e29c04f6178be05d2a93c471fe6082db35c9147ae0b26f3d8c15904a",
    mandate_title: "# Renew the Arbitrum liquidity incentive program",
    actions_digest: "0xe07c4b2915da836f0b17ec4d952a308f6b1d7c249e5038ab7c61f0d3e984a512",
    action_count: "1",
    diverging_index: "0",
    divergence_kind: "OPAQUE_NESTED",
    rationale:
      "The outer action is a retryable ticket, and its selector verifies. The mandate says the ticket calls the incentive distributor's top-up function and that no ownership or administrative right is transferred. The nested depth-1 payload decodes to setOwner(address), keccak-verified, aimed at the L2 distributor at 0x1f7d7550…2efa. The nested call is not a top-up, and it is the kind of change the mandate expressly excludes.",
    veto_flag: false,
    reviewed_at: "2026-07-02T08:55:19Z",
    override_vote_ref: "",
    mandate_text: MANDATES["IG-UNI-83"],
    mandate_clauses: clauses(
      [
        "The Timelock will send one retryable ticket through the Arbitrum Delayed Inbox calling the incentive distributor's top-up function on L2.",
        [0],
      ],
      ["No parameters other than the top-up amount change, and no ownership or administrative right is transferred.", [0]],
    ),
  },
  {
    id: "IG-COMP-238",
    requester: REQUESTER_B,
    governor: COMP,
    proposal_id: "238",
    creation_block: "25370904",
    bond: GEN("2"),
    status: "DIVERGENT",
    mandate_digest: "0xc38f0a7d192b5e46c07d3ba815e9427f60d8c135ea9b7204f1c6d83b0759ae24",
    mandate_title: "# Raise the cUSDC reserve factor to 10 basis points",
    actions_digest: "0x1f6b03c8d47a259e0b83fc16d5a2470e9c81bd35f602a7148de93c0b57a2e46f",
    action_count: "1",
    diverging_index: "0",
    divergence_kind: "PARAM_MISMATCH",
    rationale:
      "The mandate states 10 basis points, twice, and describes the change as one tenth of one percent. The decoded argument newReserveFactorMantissa is 1000. In a function scaled to 1e4, 1000 is 10 percent, not 10 basis points, which is a factor of one hundred. The function and the market are the ones the mandate names; only the magnitude diverges.",
    veto_flag: true,
    reviewed_at: "2026-08-02T14:27:36Z",
    override_vote_ref: "",
    mandate_text: MANDATES["IG-COMP-238"],
    mandate_clauses: clauses([
      "Call _setReserveFactor on the cUSDC market, setting the reserve factor to 10 basis points.",
      [0],
    ]),
  },
  {
    id: "IG-COMP-243",
    requester: REQUESTER_C,
    governor: COMP,
    proposal_id: "243",
    creation_block: "25498330",
    bond: GEN("2"),
    status: "DIVERGENT",
    mandate_digest: "0x7b2e05c1a38f6d940ec27b15d8a3f0426e91cd07b53f2a8146de0c937b52a108",
    mandate_title: "# Set the pending admin for the new Comptroller",
    actions_digest: "0xa4c197e0b25d38f6014ecb7d29a5038f1b6c0d47e59a2831fc07bd6e4a93150c",
    action_count: "2",
    diverging_index: "1",
    divergence_kind: "UNAUTHORISED_SCOPE",
    rationale:
      "The mandate authorises the first step of an implementation handover and says so explicitly: this proposal performs the first step only. Action 0 matches it. Action 1 calls setPendingAdmin(address), which begins a handover of the Comptroller admin key rather than the implementation. No clause grants that power, and the mandate's own limiting sentence forecloses it.",
    veto_flag: false,
    reviewed_at: "2026-08-06T10:18:07Z",
    override_vote_ref:
      "compound.eth/proposal/0x4f21c8b7e05d3a9612fc0b7d84e5a3901c6d27fb350e94a8172bd0c6e39f5a41",
    mandate_text: MANDATES["IG-COMP-243"],
    mandate_clauses: clauses(
      ["Call _setPendingImplementation on the Comptroller with the audited implementation address.", [0]],
      ["This proposal performs the first step only.", []],
    ),
  },
  {
    id: "IG-UNI-72",
    requester: REQUESTER_C,
    governor: UNI,
    proposal_id: "72",
    creation_block: "24261773",
    bond: GEN("1"),
    status: "UNDERSPECIFIED",
    mandate_digest: "0x0e93b7c5a2d18f460b7ce3d915a2408f6bd1c07e29a53f8140cb6d72e05a9317",
    mandate_title: "# Optimise treasury operations",
    actions_digest: "0x6d0a4b17c29e5f38014bd7ec3a95028f6c1b0d74e93a5218fb07cd6e4a25391f",
    action_count: "2",
    diverging_index: NONE,
    divergence_kind: "NONE",
    rationale:
      "The mandate authorises a working group to optimise treasury operations and names no contract, function, amount or recipient. Action 0 withdraws 4,000,000 USDC. Action 1's selector could not be verified by hashing, so what it calls is not established. The text neither authorises these calls nor forbids them; there is nothing in it to compare them against. This is recorded as advisory. No veto flag is set, and no divergence is alleged.",
    veto_flag: false,
    reviewed_at: "2026-06-19T13:44:51Z",
    override_vote_ref: "",
    mandate_text: MANDATES["IG-UNI-72"],
    mandate_clauses: clauses([
      "The working group is empowered to take the operational steps it judges necessary.",
      [0, 1],
    ]),
  },
  {
    id: "IG-COMP-231",
    requester: REQUESTER_B,
    governor: COMP,
    proposal_id: "231",
    creation_block: "25102558",
    bond: GEN("2"),
    status: "UNDECODABLE",
    mandate_digest: "",
    mandate_title: "",
    actions_digest: "",
    action_count: "0",
    diverging_index: NONE,
    divergence_kind: "NONE",
    rationale:
      "Both explorers answered. Their decoded action sets did not hash identically: one returned three calldatas, the other four. The corroboration gate rejected the round before any prompt executed. No verdict was written, no veto flag set, and the bond was returned. Re-running the review is the correct response, not treating this as a finding about the proposal.",
    veto_flag: false,
    reviewed_at: "2026-07-21T19:07:12Z",
    override_vote_ref: "",
    undecodable_gate: "EXPLORER_DISAGREEMENT",
  },
];

export const MOCK_REBUTTALS: Rebuttal[] = [
  {
    id: "IG-REB-68-1",
    review_id: "IG-UNI-68",
    rebutter: PROPOSER,
    argument_url: "https://gov.uniswap.org/t/grants-wave-4-ownership-transfer-context/24118",
    bond: GEN("3"),
    status: "OPEN",
    rationale: "",
    settled_at: "",
  },
  {
    id: "IG-REB-238-1",
    review_id: "IG-COMP-238",
    rebutter: PROPOSER,
    argument_url: "https://www.comp.xyz/t/cusdc-reserve-factor-mantissa-scaling/5581",
    bond: GEN("2"),
    status: "UPHELD",
    rationale:
      "The rebuttal argues that 1000 is the correct mantissa because the market's scaling is 1e5. The cUSDC reserve factor mantissa is scaled to 1e4, which the rebuttal does not dispute and does not address. The stated divergence is not defeated. The veto stands and the rebutter's bond moved to the reviewer.",
    settled_at: "2026-08-05T09:31:20Z",
  },
  {
    id: "IG-REB-83-1",
    review_id: "IG-UNI-83",
    rebutter: PROPOSER,
    argument_url: "https://gov.uniswap.org/t/arbitrum-incentives-renewal-distributor-migration/24802",
    bond: GEN("4"),
    status: "WITHDRAWN_VETO",
    rationale:
      "The rebuttal shows that the L2 distributor at 0x1f7d7550…2efa is a proxy whose owner is the L2 alias of the Timelock, that the nested setOwner call re-points it at the newly deployed distributor named in the linked forum post, and that the top-up is Part 2 of the same renewal. The nested call is an administrative step within the renewal the mandate describes, and the mandate's exclusion was read too narrowly. The veto is cleared and the reviewer's bond compensates the proposer for the delay.",
    settled_at: "2026-07-04T15:12:48Z",
  },
];

export const MOCK_ACTIONS_BY_ID = MOCK_ACTIONS;
