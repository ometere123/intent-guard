"""Governor Bravo's two action shapes, and the bug that made one of them invisible.

Bravo stores an action as a name plus arguments, not as a single payload:

    signatures[i] = "_grantComp(address,uint256)"
    calldatas[i]  = <address word><amount word>          # arguments only, no selector

and the Timelock puts the two together at execution time, computing
`bytes4(keccak256(signature))` itself. An action may also leave the name empty, in which
case `calldatas[i]` is a whole payload with its own selector in front. Both shapes are
real: every Uniswap action measured is the second, and Compound's are overwhelmingly the
first.

The contract used to read `calldatas[i][:4]` as the selector in both cases. For a named
action that is not a selector at all -- it is the first four bytes of the first argument,
and for a leading `address` those bytes are `0x00000000`, which `_resolve_one` settles as
unnameable without spending a lookup. So every named action arrived at the model as OPAQUE,
Rule 5 refused to certify an opaque call, and UNDERSPECIFIED became the only verdict this
contract could reach on a Compound-shaped proposal.

That was not caught offline because every fixture in `test_lifecycle.py` uses the unnamed
shape. It was caught on StudioNet: Compound proposal 294 went through `request_review` and
`review` for real, and came back UNDERSPECIFIED with a rationale saying all eight actions
carried selector `0x00000000` -- while the Governor's own `getActions` names all eight.
These tests pin both shapes so the blind spot cannot reopen.
"""

import json

import pytest

from test_lifecycle import (
    ALIGNMENT_PROMPT,
    CREATION_BLOCK,
    MIN_BOND,
    PROPOSAL_ID,
    TARGET_A,
    TARGET_B,
    UNISWAP,
    _addr_word,
    _word,
    install_rpc_router,
    mock_alignment,
    mock_fourbyte,
    module_of,
    request,
)

# A real Compound action, and the one that exposed the bug: proposal 294 action #0.
GRANT = "_grantComp(address,uint256)"
GRANT_AMOUNT = 13_000 * 10**18


def grant_args():
    """`_grantComp`'s arguments with no selector in front, exactly as Bravo stores them."""
    return _addr_word(TARGET_B) + _word(GRANT_AMOUNT)


def named_action_set():
    """Two actions in the named shape, the way Compound's Governor reports them."""
    return [
        {"target": TARGET_A, "value": 0, "signature": GRANT, "calldata": grant_args()},
        {
            "target": TARGET_B,
            "value": 0,
            "signature": "grantPhase(uint256)",
            "calldata": _word(1),
        },
    ]


# ======================================================================================
# Where the selector comes from
# ======================================================================================


def test_a_named_action_takes_its_selector_from_the_name(direct_deploy):
    module = module_of(direct_deploy("contracts/IntentGuard.py"))

    args = grant_args()
    # The premise of the whole bug: these argument bytes start with four zero bytes, so
    # reading them as a selector produces the one value that resolves to nothing.
    assert args[:8] == "00000000"

    bare = module._bare_actions([TARGET_A], [0], [GRANT], [args])

    assert bare[0]["selector"] == module.selector_of(GRANT)
    assert bare[0]["selector"] != "0x00000000"
    assert bare[0]["signature"] == GRANT


def test_an_unnamed_action_still_takes_its_selector_from_the_payload(direct_deploy):
    module = module_of(direct_deploy("contracts/IntentGuard.py"))

    selector = module.selector_of("transfer(address,uint256)")
    payload = selector + _addr_word(TARGET_B) + _word(1_000)

    bare = module._bare_actions([TARGET_A], [0], [""], [payload])

    assert bare[0]["selector"] == selector
    assert bare[0]["signature"] == ""


def test_a_short_unnamed_payload_has_no_selector_at_all(direct_deploy):
    module = module_of(direct_deploy("contracts/IntentGuard.py"))

    bare = module._bare_actions([TARGET_A], [0], [""], ["0xdead"])

    assert bare[0]["selector"] == ""


# ======================================================================================
# Naming, and what the model is told about where the name came from
# ======================================================================================


def test_a_named_action_resolves_without_spending_a_lookup(direct_deploy):
    """The Governor already said what this call is, so 4byte is not consulted."""
    module = module_of(direct_deploy("contracts/IntentGuard.py"))

    bare = module._bare_actions([TARGET_A], [0], [GRANT], [grant_args()])[0]
    budget = [0]  # exhausted on purpose: a lookup here would fail to resolve
    out = module._enrich_action(bare, grant_args(), {}, budget)

    assert out["resolved"] == "true"
    assert out["signature"] == GRANT
    assert out["name_source"] == "governor"
    assert budget[0] == 0
    # The arguments decoded, which is only possible if the selector was put back on the
    # front of an args-only payload before decoding.
    assert str(GRANT_AMOUNT) in out["arg_summary"]
    assert out["structural_failure"] == ""


def test_an_unnamed_action_is_named_through_4byte_and_says_so(direct_deploy, direct_vm):
    module = module_of(direct_deploy("contracts/IntentGuard.py"))
    mock_fourbyte(direct_vm)

    signature = "transfer(address,uint256)"
    payload = module.selector_of(signature) + _addr_word(TARGET_B) + _word(1_000)
    bare = module._bare_actions([TARGET_A], [0], [""], [payload])[0]
    out = module._enrich_action(bare, payload, {}, [12])

    assert out["resolved"] == "true"
    assert out["signature"] == signature
    assert out["name_source"] == "selector"


def test_a_named_action_whose_arguments_do_not_fit_is_a_structural_failure(direct_deploy):
    """A Governor declaring one thing and encoding another is malformed, not unnameable.

    The two outcomes are deliberately different: an unnameable call reaches the model as
    OPAQUE and can still produce a verdict, while calldata that will not decode against a
    confirmed name is settled arithmetically and never reaches the model at all.
    """
    module = module_of(direct_deploy("contracts/IntentGuard.py"))

    truncated = _addr_word(TARGET_B)  # one word short of `_grantComp`'s two
    bare = module._bare_actions([TARGET_A], [0], [GRANT], [truncated])[0]
    out = module._enrich_action(bare, truncated, {}, [12])

    assert out["structural_failure"] != ""
    assert out["signature"] == GRANT


def test_the_prompt_says_which_of_the_two_ways_named_each_call(direct_deploy, direct_vm):
    module = module_of(direct_deploy("contracts/IntentGuard.py"))
    mock_fourbyte(direct_vm)

    named = module._bare_actions([TARGET_A], [0], [GRANT], [grant_args()])[0]
    unnamed_payload = (
        module.selector_of("transfer(address,uint256)") + _addr_word(TARGET_B) + _word(1)
    )
    unnamed = module._bare_actions([TARGET_A], [0], [""], [unnamed_payload])[0]

    block = module._prompt_action_block([
        module._enrich_action(named, grant_args(), {}, [12]),
        module._enrich_action(unnamed, unnamed_payload, {}, [12]),
    ])

    assert GRANT in block
    assert "declared by the Governor itself" in block
    assert "confirmed by hashing" in block
    assert "OPAQUE" not in block


# ======================================================================================
# The whole round, on a Compound-shaped proposal
# ======================================================================================


def test_a_named_proposal_reaches_a_real_verdict_with_4byte_answering_nothing(
    direct_deploy, direct_vm, monkeypatch, direct_alice
):
    """The regression test for the live failure, end to end.

    4byte is mocked to resolve nothing at all. Before the fix that guaranteed
    UNDERSPECIFIED, because the selector being looked up was `0x00000000` and no answer
    existed for it. After the fix no lookup is needed: the names came from the Governor.
    """
    contract = direct_deploy("contracts/IntentGuard.py")
    module = module_of(contract)

    request(contract, direct_vm, direct_alice)
    install_rpc_router(monkeypatch, module, named_action_set())
    mock_fourbyte(direct_vm, resolvable=False)
    mock_alignment(direct_vm, "ALIGNED", "NONE", 0)

    contract.review("IG-V1")

    r = contract.get_review("IG-V1")
    assert r["status"] == "ALIGNED"
    assert r["status"] != "UNDERSPECIFIED"
    assert r["veto_flag"] is False
    assert r["action_count"] == "2"
    # No terminal review may leave a bond behind, whichever verdict it reached.
    assert r["bond_settled"] is True


def test_a_named_proposal_can_still_be_vetoed(
    direct_deploy, direct_vm, monkeypatch, direct_alice
):
    """Naming the calls opens the veto branch too, not just the clean one."""
    contract = direct_deploy("contracts/IntentGuard.py")
    module = module_of(contract)

    request(contract, direct_vm, direct_alice)
    install_rpc_router(monkeypatch, module, named_action_set())
    mock_fourbyte(direct_vm, resolvable=False)
    mock_alignment(direct_vm, "DIVERGENT", "PARAM_MISMATCH", 0)

    contract.review("IG-V1")

    r = contract.get_review("IG-V1")
    assert r["status"] == "DIVERGENT"
    assert r["veto_flag"] is True
    assert r["divergence_kind"] == "PARAM_MISMATCH"
    assert contract.is_vetoed(UNISWAP, PROPOSAL_ID)["vetoed"] is True


def test_a_mixed_proposal_names_what_it_can_and_stays_honest_about_the_rest(
    direct_deploy, direct_vm, monkeypatch, direct_alice
):
    """One named action, one unnameable one. The unnameable one still blocks ALIGNED.

    This is the case that proves the fix did not weaken Rule 5: naming the calls the
    Governor named must not launder the calls nobody can name.
    """
    contract = direct_deploy("contracts/IntentGuard.py")
    module = module_of(contract)

    actions = [
        named_action_set()[0],
        {
            # A payload with a real selector shape that 4byte will not answer for.
            "target": TARGET_B,
            "value": 0,
            "signature": "",
            "calldata": "0xabcdef12" + _word(7),
        },
    ]

    request(contract, direct_vm, direct_alice)
    install_rpc_router(monkeypatch, module, actions)
    mock_fourbyte(direct_vm, resolvable=False)
    mock_alignment(direct_vm, "ALIGNED", "NONE", 0)

    contract.review("IG-V1")

    r = contract.get_review("IG-V1")
    assert r["status"] == "UNDERSPECIFIED"
    assert r["veto_flag"] is False
