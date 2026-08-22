"""Veto, rebuttal, override and settlement — the branches StudioNet has not proven.

The on-chain proof recorded in `docs/SUBMISSION.md` establishes the PENDING →
UNDERSPECIFIED path with a real bond and real validators. It cannot establish what
happens when a round comes back DIVERGENT, because that needs a live mainnet proposal
whose executable calls genuinely contradict its own text, and the contract is not
allowed to invent one. These tests drive that branch deterministically instead, and
they assert on the economics — which stake moves, and when — rather than on wording.

Two seams are used, and both are deliberately narrow:

  * `_rpc` is replaced with a router that answers by JSON-RPC method. `mock_web`
    matches on URL and HTTP method only, and this contract POSTs both `eth_getLogs`
    and `eth_call` to the same URL, so a URL-keyed mock cannot answer them
    differently. Everything downstream of the JSON-RPC envelope still runs
    unmodified — `_find_proposal_log`, `_actions_from_call`, `canonical_digest`,
    selector resolution and `_apply_outcome` all work on bytes this file
    ABI-encodes, so the three-way corroboration digest is really computed and really
    has to match.
  * the inference is mocked, because a verdict is the *input* to these tests. What is
    under test is what the contract does with a verdict once it has one, including
    the three places where it overrules one.
"""

import json
import sys

MIN_BOND = 10**15
UNISWAP = "0x408ed6354d4973f66138c91495f2f2fcbd8724c3"
PROPOSER = "0x0000000000000000000000000000000000000001"
TARGET_A = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"
TARGET_B = "0x00000000000000000000000000000000000000de"
SIGNATURE = "transfer(address,uint256)"
ARGUMENT_URL = "https://example.org/rebuttal.md"

PROPOSAL_ID = 100
CREATION_BLOCK = 25_554_834
REBUTTAL_WINDOW_SECONDS = 604_800

MANDATE = (
    "# Fee switch, part 1\n\nThis proposal moves the protocol fee recipient and does "
    "nothing else. It does not transfer treasury funds to any other address."
)

# Distinct substrings of the two prompts. Anchoring on the question each prompt asks
# keeps the mocks from cross-matching when both rounds run in one test.
ALIGNMENT_PROMPT = r"whether a DAO proposal's executable calls match"
REBUTTAL_PROMPT = r"whether a written argument defeats"

NO_DIVERGENCE = 2**256 - 1


# ======================================================================================
# Minimal ABI encoder — enough for ProposalCreated and getActions, nothing more
# ======================================================================================


def _word(value):
    return f"{int(value) & (2**256 - 1):064x}"


def _addr_word(addr):
    return _word(int(addr, 16))


def _bytes_tail(raw_hex):
    body = raw_hex[2:] if raw_hex.startswith("0x") else raw_hex
    return _word(len(body) // 2) + body + "0" * ((-len(body)) % 64)


def _text_tail(text):
    return _bytes_tail(text.encode("utf-8").hex())


def _static_array(words):
    return _word(len(words)) + "".join(words)


def _dynamic_array(tails):
    """Length word, then an offset table relative to the table's own start, then tails."""
    table = ""
    body = ""
    base = 32 * len(tails)
    for tail in tails:
        table += _word(base + len(body) // 2)
        body += tail
    return _word(len(tails)) + table + body


def _with_offsets(static_head_words, tails):
    """Lay dynamic tails out after a head of `static_head_words` slots."""
    offsets = []
    running = 32 * static_head_words
    for tail in tails:
        offsets.append(running)
        running += len(tail) // 2
    return offsets, "".join(tails)


def _action_arrays(actions):
    return [
        _static_array([_addr_word(a["target"]) for a in actions]),
        _static_array([_word(a["value"]) for a in actions]),
        _dynamic_array([_text_tail(a["signature"]) for a in actions]),
        _dynamic_array([_bytes_tail(a["calldata"]) for a in actions]),
    ]


def proposal_created_data(actions, proposal_id=PROPOSAL_ID, description=MANDATE):
    """`ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)`."""
    tails = _action_arrays(actions) + [_text_tail(description)]
    offsets, body = _with_offsets(9, tails)
    head = (
        _word(proposal_id)
        + _addr_word(PROPOSER)
        + _word(offsets[0])
        + _word(offsets[1])
        + _word(offsets[2])
        + _word(offsets[3])
        + _word(CREATION_BLOCK)
        + _word(CREATION_BLOCK + 40_320)
        + _word(offsets[4])
    )
    return "0x" + head + body


def get_actions_return(actions):
    """`getActions(uint256)` → `(address[],uint256[],string[],bytes[])`."""
    tails = _action_arrays(actions)
    offsets, body = _with_offsets(4, tails)
    return "0x" + "".join(_word(o) for o in offsets) + body


# ======================================================================================
# Harness
# ======================================================================================


def module_of(contract):
    return sys.modules[contract.__class__.__module__]


def action_set(module):
    """Two actions sharing one selector, so a single 4byte answer resolves both."""
    selector = module.selector_of(SIGNATURE)
    return [
        {
            "target": TARGET_A,
            "value": 0,
            "signature": "",
            "calldata": selector + _addr_word(TARGET_B) + _word(1_000),
        },
        {
            "target": TARGET_B,
            "value": 0,
            "signature": "",
            "calldata": selector + _addr_word(TARGET_A) + _word(2_000),
        },
    ]


def install_rpc_router(monkeypatch, module, actions, b_actions=None, proposal_id=PROPOSAL_ID):
    """Answer `eth_getLogs` and `eth_call` from the same encoded action set.

    Both providers are given the same bytes by default, which is the point: the
    contract's three-way digest comparison must actually pass for the round to reach a
    verdict at all. Pass `b_actions` to give provider B a different reading.

    `proposal_id` has to reach the encoder as well as the request, because the contract
    finds its proposal by matching the id inside the log rather than trusting whatever
    the provider hands back first.
    """
    logs = [{
        "address": UNISWAP,
        "topics": [module.TOPIC_PROPOSAL_CREATED],
        "data": proposal_created_data(actions, proposal_id=proposal_id),
        "blockNumber": hex(CREATION_BLOCK),
    }]
    call_a = get_actions_return(actions)
    call_b = get_actions_return(b_actions if b_actions is not None else actions)

    def router(url, payload):
        method = json.loads(payload).get("method", "")
        if method == "eth_getLogs":
            result = logs
        elif method == "eth_call":
            result = call_a if url == module.RPC_A else call_b
        else:
            return module.FETCH_UNAVAILABLE
        return json.dumps({"jsonrpc": "2.0", "id": 1, "result": result})

    monkeypatch.setattr(module, "_rpc", router)


def mock_fourbyte(direct_vm, resolvable=True):
    rows = [{"text_signature": SIGNATURE}] if resolvable else []
    direct_vm.mock_web(
        r"4byte\.directory",
        {"method": "GET", "status": 200, "body": json.dumps({"results": rows})},
    )


def mock_alignment(direct_vm, verdict, kind, index, rationale="the fee recipient move"):
    direct_vm.mock_llm(
        ALIGNMENT_PROMPT,
        json.dumps({
            "verdict": verdict,
            "diverging_index": str(index),
            "divergence_kind": kind,
            "rationale": rationale,
        }),
    )


def set_block_time(direct_vm, iso):
    """Move the clock the contract actually reads.

    `direct_vm.warp()` patches `datetime.now()` and the VM's own timestamp, but
    `_refresh_gl_message` only writes `sender_address` and `origin_address` back into
    `gl.message_raw`. This contract takes its clock from
    `gl.message_raw["datetime"]` — deliberately, because a block timestamp is not the
    validator's wall clock — so the warp has to be mirrored there or every deadline is
    computed against real time and the window tests silently pass for the wrong reason.
    """
    direct_vm.warp(iso)
    gl = sys.modules.get("genlayer.gl")
    if gl is not None and getattr(gl, "message_raw", None) is not None:
        gl.message_raw["datetime"] = iso


def request(contract, direct_vm, sender, review_id="IG-V1", proposal_id=PROPOSAL_ID):
    direct_vm.sender = sender
    direct_vm.value = MIN_BOND
    outcome = contract.request_review(review_id, UNISWAP, proposal_id, CREATION_BLOCK)
    direct_vm.value = 0
    assert outcome == review_id, outcome
    return outcome


def divergent_review(
    contract,
    direct_vm,
    monkeypatch,
    reviewer,
    review_id="IG-V1",
    kind="PARAM_MISMATCH",
    index=1,
    resolvable=True,
    verdict="DIVERGENT",
    proposal_id=PROPOSAL_ID,
):
    """Take one review from PENDING to a recorded verdict. Returns the module."""
    module = module_of(contract)
    request(contract, direct_vm, reviewer, review_id=review_id, proposal_id=proposal_id)
    install_rpc_router(monkeypatch, module, action_set(module), proposal_id=proposal_id)
    mock_fourbyte(direct_vm, resolvable=resolvable)
    mock_alignment(direct_vm, verdict, kind, index)
    contract.review(review_id)
    return module


# ======================================================================================
# Veto
# ======================================================================================


def test_divergent_round_records_a_veto_and_keeps_the_bond_at_risk(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/IntentGuard.py")
    divergent_review(contract, direct_vm, monkeypatch, direct_alice)

    r = contract.get_review("IG-V1")
    assert r["status"] == "DIVERGENT"
    assert r["veto_flag"] is True
    assert r["divergence_kind"] == "PARAM_MISMATCH"
    assert r["diverging_index"] == "1"
    assert r["action_count"] == "2"
    # The whole reason `_settle` has an early return: a live claim keeps its stake at
    # risk, because WITHDRAWN_VETO has to have something left to award the rebutter.
    assert r["bond_settled"] is False
    assert r["rebuttable"] is True
    assert r["rebuttal_deadline"] != ""

    # Corroboration really ran: three readings hashed to one digest.
    assert len(r["actions_digest"]) > 0
    assert r["mandate_digest"] != ""

    assert contract.stats()["active_vetoes"] == "1"
    gate = contract.is_vetoed(UNISWAP, PROPOSAL_ID)
    assert gate["reviewed"] is True and gate["vetoed"] is True
    assert gate["review_id"] == "IG-V1" and gate["divergence_kind"] == "PARAM_MISMATCH"


def test_the_deadline_is_exactly_one_window_after_the_review(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/IntentGuard.py")
    set_block_time(direct_vm, "2026-03-01T00:00:00Z")
    divergent_review(contract, direct_vm, monkeypatch, direct_alice)

    r = contract.get_review("IG-V1")
    # 604800s from 2026-03-01 crosses a month boundary, which is the arithmetic the
    # hand-rolled date helper exists to get right.
    assert r["rebuttal_deadline"].startswith("2026-03-08T00:00:00")


# ======================================================================================
# The three overrides — each one fails toward not vetoing
# ======================================================================================


def test_divergent_without_a_usable_index_is_overridden_to_underspecified(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/IntentGuard.py")
    # index 9 against an action_count of 2: a veto that points at nothing.
    divergent_review(contract, direct_vm, monkeypatch, direct_alice, index=9)

    r = contract.get_review("IG-V1")
    assert r["status"] == "UNDERSPECIFIED"
    assert r["veto_flag"] is False
    assert r["divergence_kind"] == "NONE"
    assert r["diverging_index"] == str(NO_DIVERGENCE)
    assert "OVERRIDDEN" in r["rationale"]
    # Not a live claim any more, so the stake goes home in the same transaction.
    assert r["bond_settled"] is True
    assert r["rebuttal_deadline"] == ""
    assert contract.stats()["active_vetoes"] == "0"


def test_divergent_with_no_kind_is_overridden_to_underspecified(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/IntentGuard.py")
    divergent_review(contract, direct_vm, monkeypatch, direct_alice, kind="NONE", index=0)

    r = contract.get_review("IG-V1")
    assert r["status"] == "UNDERSPECIFIED"
    assert r["veto_flag"] is False
    assert "OVERRIDDEN" in r["rationale"]
    assert r["bond_settled"] is True


def test_opaque_nested_never_vetoes_an_action_nobody_could_name(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/IntentGuard.py")
    # 4byte returns nothing, so no selector hash-verifies and action #1 stays opaque.
    # "The nested payload contradicts the text" is then a claim about bytes nobody read.
    divergent_review(
        contract,
        direct_vm,
        monkeypatch,
        direct_alice,
        kind="OPAQUE_NESTED",
        index=1,
        resolvable=False,
    )

    r = contract.get_review("IG-V1")
    assert r["status"] == "UNDERSPECIFIED"
    assert r["veto_flag"] is False
    assert "could not be named at all" in r["rationale"]
    assert r["bond_settled"] is True

    rows = contract.get_actions("IG-V1")
    assert len(rows) == 2
    assert all(row["resolved"] is False for row in rows)


def test_aligned_is_downgraded_when_a_selector_never_resolved(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/IntentGuard.py")
    divergent_review(
        contract,
        direct_vm,
        monkeypatch,
        direct_alice,
        verdict="ALIGNED",
        kind="NONE",
        index=0,
        resolvable=False,
    )

    r = contract.get_review("IG-V1")
    # An unnameable call cannot be certified as authorised, so ALIGNED is not available.
    assert r["status"] == "UNDERSPECIFIED"
    assert "no signature hashes to" in r["rationale"]
    assert r["veto_flag"] is False
    assert r["bond_settled"] is True


def test_a_clean_aligned_round_clears_the_proposal_and_returns_the_bond(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/IntentGuard.py")
    divergent_review(contract, direct_vm, monkeypatch, direct_alice, verdict="ALIGNED", kind="NONE", index=0)

    r = contract.get_review("IG-V1")
    assert r["status"] == "ALIGNED"
    assert r["veto_flag"] is False
    assert r["bond_settled"] is True
    gate = contract.is_vetoed(UNISWAP, PROPOSAL_ID)
    # Reviewed-and-clear is a different fact from nobody-looked, and the gate says which.
    assert gate["reviewed"] is True and gate["vetoed"] is False


# ======================================================================================
# Rebuttal
# ======================================================================================


def test_rebuttal_is_refused_when_there_is_no_live_veto(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob, value_ledger
):
    contract = direct_deploy("contracts/IntentGuard.py")
    divergent_review(contract, direct_vm, monkeypatch, direct_alice, verdict="ALIGNED", kind="NONE", index=0)
    value_ledger.clear()

    direct_vm.sender = direct_bob
    value_ledger.fund(MIN_BOND)
    outcome = contract.rebut("RB-1", "IG-V1", ARGUMENT_URL)
    value_ledger.no_value()

    assert outcome.startswith("[REJECTED]")
    assert "carries no veto" in outcome
    assert value_ledger.paid_to(direct_bob) == MIN_BOND
    assert value_ledger.retained == 0
    assert contract.get_rebuttal("RB-1") == {}
    assert contract.stats()["rebuttals"] == "0"


def test_rebuttal_bond_must_equal_the_review_bond_exactly(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob, value_ledger
):
    contract = direct_deploy("contracts/IntentGuard.py")
    divergent_review(contract, direct_vm, monkeypatch, direct_alice)
    value_ledger.clear()

    direct_vm.sender = direct_bob
    for amount in (MIN_BOND - 1, MIN_BOND * 2):
        value_ledger.fund(amount)
        # Not a minimum and not a multiple: an asymmetric stake would let whichever side
        # held more capital buy the question. The wrong amount comes straight back.
        outcome = contract.rebut("RB-1", "IG-V1", ARGUMENT_URL)
        assert outcome.startswith("[REJECTED]")
        assert "must equal the review bond exactly" in outcome
        assert value_ledger.paid_to(direct_bob) == value_ledger.funded

    value_ledger.fund(MIN_BOND)
    bad_url = contract.rebut("RB-1", "IG-V1", "ftp://example.org/argument")
    assert bad_url.startswith("[REJECTED]")
    assert "must be an http(s) URL" in bad_url

    # Three refusals, three refunds, and nothing written by any of them.
    assert value_ledger.retained == 0
    assert contract.stats()["rebuttals"] == "0"

    refunded_so_far = value_ledger.paid_to(direct_bob)
    accepted = value_ledger.fund(MIN_BOND)
    assert contract.rebut("RB-1", "IG-V1", ARGUMENT_URL) == "RB-1"
    value_ledger.no_value()

    # The accepted bond is the one amount that does *not* come back: it is escrowed.
    assert value_ledger.paid_to(direct_bob) == refunded_so_far
    assert value_ledger.retained == accepted

    rb = contract.get_rebuttal("RB-1")
    assert rb["status"] == "OPEN"
    assert rb["bond"] == str(MIN_BOND)
    assert rb["rebutter"].lower() == "0x" + direct_bob.hex()
    assert rb["divergence_addressed"] == "PARAM_MISMATCH"
    assert rb["bond_settled"] is False

    r = contract.get_review("IG-V1")
    assert r["rebuttal_id"] == "RB-1"
    assert r["contested"] is True
    # One rebuttal per review: a second attempt would be a way to re-ask until the
    # answer changed.
    assert r["rebuttable"] is False
    assert r["rereviewable"] is False

    second = value_ledger.fund(MIN_BOND)
    duplicate = contract.rebut("RB-2", "IG-V1", ARGUMENT_URL)
    value_ledger.no_value()
    assert duplicate.startswith("[REJECTED]")
    assert "already has rebuttal RB-1" in duplicate
    assert value_ledger.paid_to(direct_bob) == refunded_so_far + second
    assert value_ledger.retained == accepted


def mock_argument(direct_vm, disposition, text="The recipient move is in scope."):
    direct_vm.mock_web(
        r"example\.org",
        {"method": "GET", "status": 200, "body": text},
    )
    direct_vm.mock_llm(
        REBUTTAL_PROMPT,
        json.dumps({"disposition": disposition, "rationale": "weighed the argument"}),
    )


def open_rebuttal(contract, direct_vm, monkeypatch, reviewer, rebutter):
    divergent_review(contract, direct_vm, monkeypatch, reviewer)
    direct_vm.sender = rebutter
    direct_vm.value = MIN_BOND
    contract.rebut("RB-1", "IG-V1", ARGUMENT_URL)
    direct_vm.value = 0


# ======================================================================================
# Settlement
# ======================================================================================


def test_upheld_rebuttal_leaves_the_veto_standing_and_settles_both_stakes(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/IntentGuard.py")
    open_rebuttal(contract, direct_vm, monkeypatch, direct_alice, direct_bob)
    mock_argument(direct_vm, "UPHELD")

    contract.adjudicate_rebuttal("RB-1")

    rb = contract.get_rebuttal("RB-1")
    assert rb["status"] == "UPHELD"
    assert rb["bond_settled"] is True
    assert rb["settled_at"] != ""

    r = contract.get_review("IG-V1")
    # The finding survived, so the veto stays and the reviewer's stake is released.
    assert r["status"] == "DIVERGENT"
    assert r["veto_flag"] is True
    assert r["bond_settled"] is True
    assert r["rebuttal_deadline"] == ""
    # No bounty can have been paid: the pool is empty and nothing funded it.
    assert r["bounty_paid"] is False
    assert contract.stats()["active_vetoes"] == "1"
    assert contract.is_vetoed(UNISWAP, PROPOSAL_ID)["vetoed"] is True


def test_withdrawn_veto_clears_the_flag_and_records_underspecified_not_aligned(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/IntentGuard.py")
    open_rebuttal(contract, direct_vm, monkeypatch, direct_alice, direct_bob)
    mock_argument(direct_vm, "WITHDRAWN_VETO")

    contract.adjudicate_rebuttal("RB-1")

    r = contract.get_review("IG-V1")
    assert r["veto_flag"] is False
    # An argument that defeated one stated divergence is not a positive finding that
    # everything else matches, so this is never recorded as ALIGNED.
    assert r["status"] == "UNDERSPECIFIED"
    assert r["divergence_kind"] == "NONE"
    assert r["diverging_index"] == str(NO_DIVERGENCE)
    assert "Veto withdrawn by rebuttal RB-1" in r["rationale"]
    assert r["bond_settled"] is True
    assert r["bounty_paid"] is False
    assert contract.stats()["active_vetoes"] == "0"

    gate = contract.is_vetoed(UNISWAP, PROPOSAL_ID)
    assert gate["reviewed"] is True and gate["vetoed"] is False

    assert contract.get_rebuttal("RB-1")["status"] == "WITHDRAWN_VETO"


def test_unclear_returns_both_stakes_and_leaves_the_finding_standing(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/IntentGuard.py")
    open_rebuttal(contract, direct_vm, monkeypatch, direct_alice, direct_bob)
    mock_argument(direct_vm, "UNCLEAR")

    contract.adjudicate_rebuttal("RB-1")

    r = contract.get_review("IG-V1")
    rb = contract.get_rebuttal("RB-1")
    # Nobody is paid for ambiguity and nobody is fined for it either.
    assert rb["status"] == "UNCLEAR" and rb["bond_settled"] is True
    assert r["status"] == "DIVERGENT" and r["veto_flag"] is True
    assert r["bond_settled"] is True

    with direct_vm.expect_revert("is UNCLEAR, not OPEN"):
        contract.adjudicate_rebuttal("RB-1")


def test_an_unreachable_argument_settles_as_unclear_rather_than_charging_the_rebutter(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/IntentGuard.py")
    open_rebuttal(contract, direct_vm, monkeypatch, direct_alice, direct_bob)
    # The rebutter's host is down. They must not lose a stake because of that.
    direct_vm.mock_web(r"example\.org", {"method": "GET", "status": 503, "body": ""})

    contract.adjudicate_rebuttal("RB-1")

    rb = contract.get_rebuttal("RB-1")
    assert rb["status"] == "UNCLEAR"
    assert rb["bond_settled"] is True
    assert "never read" in rb["rationale"] or "could not be retrieved" in rb["rationale"]
    r = contract.get_review("IG-V1")
    assert r["veto_flag"] is True and r["bond_settled"] is True


def test_an_unrebutted_window_only_closes_after_the_deadline(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/IntentGuard.py")
    set_block_time(direct_vm, "2026-03-01T00:00:00Z")
    divergent_review(contract, direct_vm, monkeypatch, direct_alice)

    with direct_vm.expect_revert("closes at"):
        contract.expire_rebuttal_window("IG-V1")
    assert contract.get_review("IG-V1")["bond_settled"] is False

    set_block_time(direct_vm, "2026-03-08T00:00:01Z")
    contract.expire_rebuttal_window("IG-V1")

    r = contract.get_review("IG-V1")
    # The finding stood unchallenged, so the veto stays and the stake is released.
    assert r["status"] == "DIVERGENT"
    assert r["veto_flag"] is True
    assert r["bond_settled"] is True
    assert r["rebuttal_deadline"] == ""
    assert contract.stats()["active_vetoes"] == "1"

    # Calling it twice is refused, and the latch — not the guard — is what makes that
    # safe. `bounty_paid` stays false here because the pool is empty, so the
    # "already settled" branch is not the one that fires; the cleared deadline rejects
    # it first. Either way `_finalise_divergent` has latched both flags, so a second
    # press cannot pay twice.
    with direct_vm.expect_revert():
        contract.expire_rebuttal_window("IG-V1")
    after = contract.get_review("IG-V1")
    assert after["bond_settled"] is True and after["bounty_paid"] is False
    assert contract.stats()["active_vetoes"] == "1"


def test_an_open_rebuttal_nobody_adjudicated_lapses_as_unclear(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/IntentGuard.py")
    set_block_time(direct_vm, "2026-03-01T00:00:00Z")
    open_rebuttal(contract, direct_vm, monkeypatch, direct_alice, direct_bob)

    with direct_vm.expect_revert("can only lapse from"):
        contract.expire_rebuttal_window("IG-V1")

    set_block_time(direct_vm, "2026-03-08T00:00:01Z")
    contract.expire_rebuttal_window("IG-V1")

    rb = contract.get_rebuttal("RB-1")
    # Resolved as UNCLEAR because that is precisely what happened: the argument was
    # never weighed. Both stakes home, veto standing.
    assert rb["status"] == "UNCLEAR"
    assert "lapsed unread" in rb["rationale"]
    assert rb["bond_settled"] is True

    r = contract.get_review("IG-V1")
    assert r["veto_flag"] is True and r["bond_settled"] is True


def test_settlement_is_latched_so_permissionless_buttons_cannot_double_pay(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/IntentGuard.py")
    open_rebuttal(contract, direct_vm, monkeypatch, direct_alice, direct_bob)
    mock_argument(direct_vm, "UPHELD")
    contract.adjudicate_rebuttal("RB-1")

    # Every settlement route is callable by anyone, so each one has to be idempotent.
    with direct_vm.expect_revert():
        contract.adjudicate_rebuttal("RB-1")
    with direct_vm.expect_revert():
        contract.expire_rebuttal_window("IG-V1")

    assert contract.get_rebuttal("RB-1")["bond_settled"] is True
    assert contract.get_review("IG-V1")["bond_settled"] is True


def test_a_second_provider_that_disagrees_gates_instead_of_vetoing(
    direct_deploy, direct_vm, monkeypatch, direct_alice
):
    """The control for every test above it.

    Same router, same encoder, same mocked DIVERGENT verdict — the only change is the ETH
    value provider B reports for action 0. If the corroboration digest were being
    short-circuited anywhere, this round would still reach DIVERGENT and record a veto. It
    has to refuse instead, which is what proves the other tests are judging bytes this file
    really encoded rather than a verdict handed straight through.
    """
    contract = direct_deploy("contracts/IntentGuard.py")
    module = module_of(contract)
    actions = action_set(module)

    disagreeing = [dict(a) for a in actions]
    disagreeing[0]["value"] = 1

    request(contract, direct_vm, direct_alice)
    install_rpc_router(monkeypatch, module, actions, b_actions=disagreeing)
    mock_fourbyte(direct_vm)
    mock_alignment(direct_vm, "DIVERGENT", "PARAM_MISMATCH", 1)
    contract.review("IG-V1")

    r = contract.get_review("IG-V1")
    assert r["status"] == "UNDECODABLE"
    assert r["undecodable_gate"] == "EXPLORER_DISAGREEMENT"
    assert "do not agree" in r["rationale"]

    # No established bytes means no finding, so nothing is vetoed and the bond goes back.
    assert r["actions_digest"] == ""
    assert r["veto_flag"] is False
    assert r["divergence_kind"] == ""
    assert r["bond_settled"] is True
    assert contract.is_vetoed(UNISWAP, PROPOSAL_ID)["vetoed"] is False


def test_corroboration_covers_the_call_shape_and_the_event_supplies_the_bytes(
    direct_deploy, direct_vm, monkeypatch, direct_alice
):
    """Pin what the three-way digest does and does not claim.

    `_bare_actions` hashes index, target, value, selector and signature — the shape of each
    call — and deliberately not the decoded arguments, because argument decoding needs a
    4byte lookup and a digest that moved when a third party was slow would report
    "the explorers disagree" about something the explorers agreed on. So a provider whose
    `getActions` returns the same calls with different argument words still corroborates,
    and the words that are actually judged come from the event's own calldata
    (`bodies = found["calldatas"]`), which is the emission the Governor is bound by.

    This test exists so that scope is a decision on the record rather than an accident. It
    is the complement of the test above: differ on the shape and the round refuses; differ
    only on the arguments and the event still governs.
    """
    contract = direct_deploy("contracts/IntentGuard.py")
    module = module_of(contract)
    actions = action_set(module)

    other_args = [dict(a) for a in actions]
    other_args[0]["calldata"] = (
        module.selector_of(SIGNATURE) + _addr_word(TARGET_B) + _word(999_999)
    )

    request(contract, direct_vm, direct_alice)
    install_rpc_router(monkeypatch, module, actions, b_actions=other_args)
    mock_fourbyte(direct_vm)
    mock_alignment(direct_vm, "DIVERGENT", "PARAM_MISMATCH", 1)
    contract.review("IG-V1")

    r = contract.get_review("IG-V1")
    assert r["status"] == "DIVERGENT"
    assert r["undecodable_gate"] == ""
    assert r["actions_digest"].startswith("0x")

    # The event's amount is what reached the model, not provider B's.
    stored = contract.get_actions("IG-V1")
    assert "1000" in json.dumps(stored)
    assert "999999" not in json.dumps(stored)
