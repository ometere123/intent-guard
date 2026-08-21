/**
 * Fixtures.
 *
 * These are the shapes the contract's views return, filled in so the apparatus can
 * be read end to end before a deployment exists. Read `src/lib/genlayer/config.ts`
 * for the one switch that replaces this file with live reads.
 *
 * What here is real, verified on chain:
 *
 *   - Uniswap Governor Bravo `0x408ED6354d4973f66138C91495F2f2FCbd8724C3`.
 *   - `proposalCount()` = `0xda35c664` returned `0x64` = 100.
 *   - `getActions(uint256)` = `0x328dd982`, `state(uint256)` = `0x3e4f49e6`.
 *   - Proposal-creation block window 25518228–25608228, two `ProposalCreated` logs,
 *     `topic0 = 0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0`.
 *   - The flagship action set: target `0x1a07cc4bd17e0118bdb54d70990d2158abad7a2d`
 *     (Arbitrum Delayed Inbox), selector `0x679b6ded` =
 *     `createRetryableTicket(address,uint256,uint256,address,address,uint256,uint256,bytes)`,
 *     keccak-verified, nested depth-1 payloads to L2 targets
 *     `0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f` and
 *     `0x1f7d7550b1b028f7571e69a784071f0205fd2efa`.
 *   - Every `selector` below with `resolved: true` really is `keccak(signature)[:4]`.
 *
 * What here is illustrative: mandate prose (the on-chain description for proposal
 * 100 is 7,141 bytes; this is an abridged stand-in), digests, requester addresses,
 * bonds, timestamps, and the six non-flagship reviews. The app states that it is
 * reading fixtures on every page while `DATA_MODE` is `fixtures`, so no number here
 * is ever presented as an on-chain fact.
 */

import type { DecodedAction } from "./contract-types";
import { NO_DIVERGENCE_SENTINEL } from "./contract-types";

const UNI = "0x408ED6354d4973f66138C91495F2f2FCbd8724C3";
const COMP = "0xc0Da02939E1441F497fd74F78cE7Decb17B66529";

const INBOX = "0x1a07cc4bd17e0118bdb54d70990d2158abad7a2d";
const L2_A = "0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f";
const L2_B = "0x1f7d7550b1b028f7571e69a784071f0205fd2efa";
const UNI_TIMELOCK = "0x1a9C8182C09F50C8318d769245beA52c32BE35BC";
const UNI_TOKEN = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
const COMPTROLLER = "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B";
const CUSDC = "0x39AA39c021dfbaE8faC545936693aC917d5E7563";

const NONE = NO_DIVERGENCE_SENTINEL;
const GEN = (whole: string) => `${whole}000000000000000000`;

/* -------------------------------------------------------------------------- */
/* Mandates                                                                    */
/* -------------------------------------------------------------------------- */

const MANDATE_100 = `# Activate v4 Protocol Fees (Part 1/2)

## Summary

This proposal is the first of two transactions that together activate protocol fees on
Uniswap v4 deployments on Arbitrum One. Part 1 sets the protocol fee controller on the two
v4 PoolManager deployments already live on Arbitrum. Part 2, which will be submitted
separately once Part 1 has executed, sets the per-pool fee schedule.

Nothing in this proposal moves treasury assets, changes governance parameters, or alters
any Ethereum mainnet contract. The only mainnet interaction is with the Arbitrum Delayed
Inbox, which forwards the two L2 calls.

## Motivation

The fee switch has been discussed since the v4 launch. The community consensus recorded in
the temperature check is that fee activation should begin on a single L2, on a small number
of pools, with a controller the DAO can replace by a later vote. Arbitrum was selected
because it carries the largest share of v4 volume outside mainnet and because the delayed
inbox path is already exercised by prior executed proposals.

## Specification

The Timelock will send two retryable tickets through the Arbitrum Delayed Inbox at
\`0x1a07cc4b…7a2d\`.

The first ticket calls \`setProtocolFeeController\` on the v4 PoolManager at
\`0x8bceaa40…937f\`, setting the controller to the DAO-owned controller contract. The
second ticket calls \`setProtocolFeeController\` on the second v4 PoolManager at
\`0x1f7d7550…2efa\`, setting the same controller.

Both tickets carry zero L2 call value. Submission cost and gas parameters are set from the
current Arbitrum estimates with headroom, and the excess fee refund address and call value
refund address are both the Uniswap Timelock, so any unspent gas returns to the treasury.

## Explicitly out of scope

This proposal does not set any fee value. It does not grant the controller authority over
mainnet pools. It does not change the Timelock admin, the Governor, or the UNI token. Any
later change to the fee schedule requires its own vote.

## Risks

If a retryable ticket is not redeemed within the retryable window, it expires and no state
changes on L2. In that case the proposal is a no-op and can be resubmitted. The controller
remains replaceable by a subsequent governance vote at all times.`;

const MANDATE_68 = `# Fund the v3 Grants Committee (Wave 4)

## Summary

Transfer 250,000 UNI from the Timelock to the Grants Committee multisig for Wave 4, and set
the fee recipient on the deployed fee collector to the same multisig so grant-funded
integrations can be paid from collected fees.

## Specification

The Timelock will call \`transfer\` on the UNI token at \`0x1f9840a8…F984\`, sending
250,000 UNI to the Grants Committee multisig.

The Timelock will then call \`setFeeRecipient\` on the fee collector, setting the recipient
to the Grants Committee multisig treasury address.

## Explicitly out of scope

This proposal does not change ownership of any contract. It does not alter the Timelock
admin or transfer any administrative right.`;

const MANDATE_91 = `# Sweep stranded router balances to the treasury

## Summary

Recover tokens stranded in the v3 SwapRouter and return them to the Uniswap Timelock.

## Specification

The Timelock will call \`sweepToken\` on the router, sweeping the stranded balance to the
Uniswap Timelock at \`0x1a9C8182C09F50C8318d769245beA52c32BE35BC\`.

Recovered funds go to the Timelock and nowhere else. No other recipient is authorised by
this proposal.`;

const MANDATE_238 = `# Raise the cUSDC reserve factor to 10 basis points

## Summary

Increase the reserve factor on cUSDC from its current value to **10 basis points**, a
change of one tenth of one percent, as the first step of a graduated schedule.

## Specification

Call \`_setReserveFactor\` on the cUSDC market, setting the reserve factor to 10 basis
points. The schedule agreed in the forum discussion is 10 bp now, reviewed after ninety
days before any further increase.`;

const MANDATE_83 = `# Renew the Arbitrum liquidity incentive program

## Summary

Extend the existing Arbitrum liquidity incentive program for a further quarter by sending a
single retryable ticket that tops up the incentive distributor on L2.

## Specification

The Timelock will send one retryable ticket through the Arbitrum Delayed Inbox calling the
incentive distributor's top-up function on L2. No parameters other than the top-up amount
change, and no ownership or administrative right is transferred.`;

const MANDATE_243 = `# Set the pending admin for the new Comptroller

## Summary

Begin the two-step admin handover to the newly audited Comptroller implementation by
setting the pending admin. Acceptance is a separate later transaction.

## Specification

Call \`_setPendingImplementation\` on the Comptroller with the audited implementation
address. This proposal performs the first step only.`;

const MANDATE_72 = `# Optimise treasury operations

## Summary

Authorise the treasury working group to optimise treasury operations and improve capital
efficiency over the coming quarter.

## Specification

The working group is empowered to take the operational steps it judges necessary.`;

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

const CRT_SIG =
  "createRetryableTicket(address,uint256,uint256,address,address,uint256,uint256,bytes)";

function retryable(index: number, l2Target: string, nestedSelector: string, nestedSignature: string) {
  return {
    index: String(index),
    target: INBOX,
    value: "10000000000000000",
    selector: "0x679b6ded",
    signature: CRT_SIG,
    resolved: true,
    nested_selector: nestedSelector,
    nested_signature: nestedSignature,
    nested_target: l2Target,
    arg_summary: [
      `to = ${l2Target}`,
      "l2CallValue = 0",
      "maxSubmissionCost = 10000000000000000",
      `excessFeeRefundAddress = ${UNI_TIMELOCK}`,
      `callValueRefundAddress = ${UNI_TIMELOCK}`,
      "gasLimit = 1000000",
      "maxFeePerGas = 100000000",
      `data = ${nestedSelector}… (36 bytes)`,
    ].join("\n"),
  } satisfies DecodedAction;
}

const NO_NEST = { nested_selector: "", nested_signature: "", nested_target: "" };

export const MOCK_ACTIONS: Record<string, DecodedAction[]> = {
  "IG-UNI-100": [
    retryable(0, L2_A, "0x2d771389", "setProtocolFeeController(address)"),
    retryable(1, L2_B, "0x2d771389", "setProtocolFeeController(address)"),
  ],
  "IG-UNI-68": [
    {
      index: "0",
      target: UNI_TOKEN,
      value: "0",
      selector: "0xa9059cbb",
      signature: "transfer(address,uint256)",
      resolved: true,
      ...NO_NEST,
      arg_summary: ["to = 0x3F7c4e8bBc3B0f9F4F8b0F4D5c4a1b2c3d4e5f60", "amount = 250000000000000000000000"].join("\n"),
    },
    {
      index: "1",
      target: "0x9a9c8f2C3b1E4d5A6b7C8d9E0f1A2b3C4d5E6f70",
      value: "0",
      selector: "0xe74b981b",
      signature: "setFeeRecipient(address)",
      resolved: true,
      ...NO_NEST,
      arg_summary: ["recipient = 0x3F7c4e8bBc3B0f9F4F8b0F4D5c4a1b2c3d4e5f60"].join("\n"),
    },
    {
      index: "2",
      target: "0x9a9c8f2C3b1E4d5A6b7C8d9E0f1A2b3C4d5E6f70",
      value: "0",
      selector: "0x13af4035",
      signature: "setOwner(address)",
      resolved: true,
      ...NO_NEST,
      arg_summary: ["newOwner = 0xB2d81E4f5a6C7b8D9e0F1a2B3c4D5e6F70819293"].join("\n"),
    },
  ],
  "IG-UNI-91": [
    {
      index: "0",
      target: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      value: "0",
      selector: "0xdf2ab5bb",
      signature: "sweepToken(address,uint256,address)",
      resolved: true,
      ...NO_NEST,
      arg_summary: [
        "token = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "amountMinimum = 0",
        "recipient = 0x1a9C8182C09F50C8318d769245beA52c32BE35bC",
      ].join("\n"),
    },
    {
      index: "1",
      target: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      value: "0",
      selector: "0xdf2ab5bb",
      signature: "sweepToken(address,uint256,address)",
      resolved: true,
      ...NO_NEST,
      arg_summary: [
        "token = 0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "amountMinimum = 0",
        "recipient = 0x1a9C8182C09F50C8318d769245beA52c32BE35BB",
      ].join("\n"),
    },
  ],
  "IG-COMP-238": [
    {
      index: "0",
      target: CUSDC,
      value: "0",
      selector: "0xfca7820b",
      signature: "_setReserveFactor(uint256)",
      resolved: true,
      ...NO_NEST,
      arg_summary: ["newReserveFactorMantissa = 1000"].join("\n"),
    },
  ],
  "IG-UNI-83": [
    {
      index: "0",
      target: INBOX,
      value: "10000000000000000",
      selector: "0x679b6ded",
      signature: CRT_SIG,
      resolved: true,
      nested_selector: "0x13af4035",
      nested_signature: "setOwner(address)",
      nested_target: L2_B,
      arg_summary: [
        `to = ${L2_B}`,
        "l2CallValue = 0",
        "maxSubmissionCost = 10000000000000000",
        `excessFeeRefundAddress = ${UNI_TIMELOCK}`,
        `callValueRefundAddress = ${UNI_TIMELOCK}`,
        "gasLimit = 1000000",
        "maxFeePerGas = 100000000",
        "data = 0x13af4035… (36 bytes)",
      ].join("\n"),
    },
  ],
  "IG-COMP-243": [
    {
      index: "0",
      target: COMPTROLLER,
      value: "0",
      selector: "0xe992a041",
      signature: "_setPendingImplementation(address)",
      resolved: true,
      ...NO_NEST,
      arg_summary: ["newPendingImplementation = 0x7C4E9b2A1d3F5c6B8a9D0e1F2a3B4c5D6e7F8091"].join("\n"),
    },
    {
      index: "1",
      target: COMPTROLLER,
      value: "0",
      selector: "0x4dd18bf5",
      signature: "setPendingAdmin(address)",
      resolved: true,
      ...NO_NEST,
      arg_summary: ["newPendingAdmin = 0xB2d81E4f5a6C7b8D9e0F1a2B3c4D5e6F70819293"].join("\n"),
    },
  ],
  "IG-UNI-72": [
    {
      index: "0",
      target: UNI_TIMELOCK,
      value: "0",
      selector: "0xf3fef3a3",
      signature: "withdraw(address,uint256)",
      resolved: true,
      ...NO_NEST,
      arg_summary: [
        "token = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "amount = 4000000000000",
      ].join("\n"),
    },
    {
      index: "1",
      target: "0x5C1f4E9a2B3d6c7A8b9C0d1E2f3A4b5C6d7E8F90",
      value: "0",
      selector: "0x1cff79cd",
      signature: "",
      resolved: false,
      ...NO_NEST,
      arg_summary: "unresolved selector — arguments not decoded",
    },
  ],
  "IG-COMP-231": [],
  "IG-UNI-104": [],
};

/** Mandate prose per review id. Abridged stand-ins; see the header note. */
export const MANDATES: Record<string, string> = {
  "IG-UNI-100": MANDATE_100,
  "IG-UNI-68": MANDATE_68,
  "IG-UNI-91": MANDATE_91,
  "IG-COMP-238": MANDATE_238,
  "IG-UNI-83": MANDATE_83,
  "IG-COMP-243": MANDATE_243,
  "IG-UNI-72": MANDATE_72,
};

export { UNI, COMP, INBOX, L2_A, L2_B, UNI_TIMELOCK, NONE, GEN };
