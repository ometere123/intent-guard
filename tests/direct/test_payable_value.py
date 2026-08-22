"""Every payable entry point, every way a caller can be refused, and where the GEN goes.

This file exists because of a measured fact about the chain rather than a hypothetical.
StudioNet does not roll back `gl.message.value` when a GenVM execution reverts: the
transaction finalises as failed and the transferred GEN stays with the contract. Sibling
project Recourse has 0.001 GEN sitting in an earlier deployment from exactly that
sequence, a bonded call that passed the value check and then failed an argument check.
Neither project has a sweep or an admin withdrawal, deliberately, so value stranded that
way is gone for good.

So the rule these tests enforce is that once a payable method has read
`gl.message.value`, it does not raise on anything the caller could have got wrong. It
validates first and refuses by returning `[REJECTED] <reason>` with the bond sent back.

The direct harness is the strictest possible place to check that, for a reason worth
stating: it performs no rollback at all. A `raise` inside a method leaves every storage
write that preceded it in place. That makes it useless for proving "the revert cleaned
up after us" and ideal for proving what is actually claimed here, which is that the
rejecting path never wrote anything in the first place.

Each payable method gets the same six cases: a malformed argument, a duplicate id, a
wrong state, an unsupported target, an insufficient bond, and a call that succeeds. Every
refusal asserts four things. No record was created, no counter moved, no accounting
changed, and the contract kept none of the value.
"""

import pytest

from test_lifecycle import (
    ARGUMENT_URL,
    CREATION_BLOCK,
    MIN_BOND,
    PROPOSAL_ID,
    UNISWAP,
    divergent_review,
)

UNKNOWN_GOVERNOR = "0x0000000000000000000000000000000000000001"
REJECTED = "[REJECTED]"


def deploy(direct_deploy):
    return direct_deploy("contracts/IntentGuard.py")


def accounting(contract):
    """The whole of the contract's own view of what it owes, as one comparable value."""
    stats = contract.stats()
    return {
        "reviews": stats["reviews"],
        "rebuttals": stats["rebuttals"],
        "active_vetoes": stats["active_vetoes"],
        "bounty_pool": stats["bounty_pool"],
        "escrowed": escrowed(contract),
    }


def escrowed(contract):
    """What the contract is holding on somebody's behalf, read back out of the records.

    Deliberately not `stats()["balance"]`. On chain that field reads the real balance, but
    the direct harness models no value credit at all and reports zero however much a test
    sends, so an offline invariant built on it would pass for the wrong reason. Summing the
    unsettled bonds and the pool is the same quantity computed from the state that actually
    exists here, and the value ledger supplies the other side of the comparison.

    Rebuttals are reached through their review because that is the only enumeration the
    contract exposes. Adding a `list_rebuttals` view purely to make this sum easier would
    widen the deployed surface for the benefit of a test, which is the wrong trade.
    """
    reviews = contract.list_reviews(0, 500)
    open_reviews = sum(
        int(row["bond"]) for row in reviews if row["bond_settled"] is False
    )
    open_rebuttals = 0
    for row in reviews:
        for rb in contract.get_rebuttals(row["id"]):
            if rb["bond_settled"] is False:
                open_rebuttals += int(rb["bond"])
    return open_reviews + open_rebuttals + int(contract.stats()["bounty_pool"])


# ======================================================================================
# request_review
# ======================================================================================


REQUEST_REFUSALS = [
    pytest.param("", UNISWAP, PROPOSAL_ID, CREATION_BLOCK, MIN_BOND,
                 "review_id is required", id="malformed-empty-id"),
    pytest.param("IG-" + "x" * 200, UNISWAP, PROPOSAL_ID, CREATION_BLOCK, MIN_BOND,
                 "exceeds", id="malformed-overlong-id"),
    pytest.param("IG-BLOCK", UNISWAP, PROPOSAL_ID, 1, MIN_BOND,
                 "outside the plausible mainnet range", id="malformed-implausible-block"),
    pytest.param("IG-ZERO", UNISWAP, 0, CREATION_BLOCK, MIN_BOND,
                 "proposal_id must be non-zero", id="malformed-zero-proposal"),
    pytest.param("IG-GOV", UNKNOWN_GOVERNOR, PROPOSAL_ID, CREATION_BLOCK, MIN_BOND,
                 "Unsupported Governor", id="unsupported-governor"),
    pytest.param("IG-LOW", UNISWAP, PROPOSAL_ID, CREATION_BLOCK, MIN_BOND - 1,
                 "Review bond below the minimum", id="insufficient-value"),
    pytest.param("IG-ZERO-VALUE", UNISWAP, PROPOSAL_ID, CREATION_BLOCK, 0,
                 "Review bond below the minimum", id="no-value-at-all"),
]


@pytest.mark.parametrize("review_id,governor,proposal_id,block,bond,expected", REQUEST_REFUSALS)
def test_refused_request_review_strands_nothing(
    direct_deploy, direct_vm, direct_alice, value_ledger,
    review_id, governor, proposal_id, block, bond, expected,
):
    contract = deploy(direct_deploy)
    before = accounting(contract)
    direct_vm.sender = direct_alice

    sent = value_ledger.fund(bond)
    outcome = contract.request_review(review_id, governor, proposal_id, block)
    value_ledger.no_value()

    assert outcome.startswith(REJECTED), outcome
    assert expected in outcome, outcome

    # No record.
    assert contract.get_review(review_id) == {}
    assert contract.list_reviews(0, 50) == []
    # No accounting movement.
    assert accounting(contract) == before
    # No value kept. A zero-value refusal has nothing to send back, and asserting that
    # separately is what stops `paid_out == funded` from passing vacuously.
    assert value_ledger.paid_to(direct_alice) == sent
    assert value_ledger.retained == 0
    if sent == 0:
        assert value_ledger.transfers == []


def test_refused_request_review_on_duplicate_id_and_duplicate_proposal(
    direct_deploy, direct_vm, direct_alice, value_ledger
):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    value_ledger.fund(MIN_BOND)
    assert contract.request_review("IG-1", UNISWAP, PROPOSAL_ID, CREATION_BLOCK) == "IG-1"
    value_ledger.no_value()

    escrowed = value_ledger.funded
    after_first = accounting(contract)

    # Duplicate id: the reserved-name check.
    value_ledger.fund(MIN_BOND)
    duplicate_id = contract.request_review("IG-1", UNISWAP, 101, CREATION_BLOCK)
    assert duplicate_id.startswith(REJECTED)
    assert "review_id already used" in duplicate_id

    # Wrong state: this proposal already has a review, and a second concurrent round
    # would leave `is_vetoed` answering with whichever one settled last.
    value_ledger.fund(MIN_BOND)
    duplicate_proposal = contract.request_review("IG-2", UNISWAP, PROPOSAL_ID, CREATION_BLOCK)
    value_ledger.no_value()
    assert duplicate_proposal.startswith(REJECTED)
    assert "already has review IG-1" in duplicate_proposal

    assert accounting(contract) == after_first
    assert [row["id"] for row in contract.list_reviews(0, 50)] == ["IG-1"]
    assert contract.get_review("IG-2") == {}
    # The accepted bond stayed; both refusals went back.
    assert value_ledger.retained == escrowed
    assert value_ledger.paid_to(direct_alice) == 2 * MIN_BOND


def test_accepted_request_review_keeps_the_bond_and_returns_the_id(
    direct_deploy, direct_vm, direct_alice, value_ledger
):
    contract = deploy(direct_deploy)
    bond = value_ledger.fund(MIN_BOND)
    direct_vm.sender = direct_alice

    assert contract.request_review("IG-OK", UNISWAP, PROPOSAL_ID, CREATION_BLOCK) == "IG-OK"
    value_ledger.no_value()

    row = contract.get_review("IG-OK")
    assert row["status"] == "PENDING"
    assert row["bond"] == str(bond)
    assert contract.stats()["reviews"] == "1"
    assert escrowed(contract) == bond
    # An accepted bond is escrowed, so nothing is sent back and the contract holds it.
    assert value_ledger.transfers == []
    assert value_ledger.retained == bond


# ======================================================================================
# rebut
# ======================================================================================


def test_refused_rebut_strands_nothing_across_every_refusal(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob, value_ledger
):
    contract = deploy(direct_deploy)
    divergent_review(contract, direct_vm, monkeypatch, direct_alice)
    value_ledger.clear()
    before = accounting(contract)
    direct_vm.sender = direct_bob

    refusals = [
        # Unsupported target. This is the case the old code got wrong in the worst way:
        # `_require_review` raised before `gl.message.value` was ever read, so a mistyped
        # review id stranded the whole rebuttal bond.
        (("RB-1", "IG-NOPE", ARGUMENT_URL), MIN_BOND, "No review with id IG-NOPE"),
        # Malformed argument.
        (("RB-1", "IG-V1", "ftp://example.org/a.md"), MIN_BOND, "must be an http(s) URL"),
        (("RB-1", "IG-V1", ""), MIN_BOND, "argument_url is required"),
        (("", "IG-V1", ARGUMENT_URL), MIN_BOND, "rebuttal_id is required"),
        # Insufficient, and also over-sufficient: this bond is an equality, not a floor.
        (("RB-1", "IG-V1", ARGUMENT_URL), MIN_BOND - 1, "must equal the review bond exactly"),
        (("RB-1", "IG-V1", ARGUMENT_URL), MIN_BOND * 2, "must equal the review bond exactly"),
        (("RB-1", "IG-V1", ARGUMENT_URL), 0, "must equal the review bond exactly"),
    ]

    for args, bond, expected in refusals:
        sent_before = value_ledger.paid_to(direct_bob)
        sent = value_ledger.fund(bond)
        outcome = contract.rebut(*args)
        value_ledger.no_value()

        assert outcome.startswith(REJECTED), (args, outcome)
        assert expected in outcome, (args, outcome)
        assert contract.get_rebuttal(args[0]) == {}
        assert accounting(contract) == before
        assert value_ledger.paid_to(direct_bob) == sent_before + sent

    assert contract.stats()["rebuttals"] == "0"
    assert contract.get_review("IG-V1")["rebuttal_id"] == ""
    assert contract.get_review("IG-V1")["contested"] is False
    assert value_ledger.retained == 0


def test_refused_rebut_on_wrong_state_and_duplicate_rebuttal_id(
    direct_deploy, direct_vm, monkeypatch, direct_alice, direct_bob, value_ledger
):
    contract = deploy(direct_deploy)
    # Two vetoed reviews on two different proposals, which is the only way to reach the
    # duplicate-rebuttal-id check: the one-rebuttal-per-review rule would otherwise
    # refuse first, and a test that cannot tell those two refusals apart is not
    # testing the second one.
    divergent_review(contract, direct_vm, monkeypatch, direct_alice, review_id="IG-A")
    divergent_review(
        contract, direct_vm, monkeypatch, direct_alice,
        review_id="IG-B", proposal_id=PROPOSAL_ID + 1,
    )
    value_ledger.clear()

    direct_vm.sender = direct_bob
    accepted = value_ledger.fund(MIN_BOND)
    assert contract.rebut("RB-1", "IG-A", ARGUMENT_URL) == "RB-1"
    value_ledger.no_value()
    after_accept = accounting(contract)

    # Wrong state: IG-A already has its one rebuttal.
    value_ledger.fund(MIN_BOND)
    second_on_a = contract.rebut("RB-2", "IG-A", ARGUMENT_URL)
    assert second_on_a.startswith(REJECTED)
    assert "already has rebuttal RB-1" in second_on_a

    # Duplicate id: IG-B is rebuttable, but RB-1 is taken.
    value_ledger.fund(MIN_BOND)
    reused_id = contract.rebut("RB-1", "IG-B", ARGUMENT_URL)
    value_ledger.no_value()
    assert reused_id.startswith(REJECTED)
    assert "rebuttal_id already used" in reused_id

    assert accounting(contract) == after_accept
    assert contract.get_rebuttal("RB-2") == {}
    assert contract.get_review("IG-B")["rebuttal_id"] == ""
    assert contract.get_review("IG-B")["contested"] is False
    # Exactly the accepted bond is held; both refusals were returned in full.
    assert value_ledger.paid_to(direct_bob) == 2 * MIN_BOND
    assert value_ledger.retained == accepted


# ======================================================================================
# fund_bounty_pool — the documented exemption
# ======================================================================================


def test_fund_bounty_pool_is_the_one_payable_method_that_may_still_raise(
    direct_deploy, direct_vm, direct_alice, value_ledger
):
    """The exemption is asserted rather than taken on trust.

    Raising is safe here for one reason only: the single refusal is a zero-value call,
    and a zero-value call has nothing to strand. If a rejection for a *non-zero* amount
    is ever added to this method, the second half of this test fails and the method needs
    `_refund_and_reject` like the others.
    """
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice

    value_ledger.fund(0)
    with direct_vm.expect_revert("Send a non-zero amount"):
        contract.fund_bounty_pool()
    assert contract.stats()["bounty_pool"] == "0"
    assert value_ledger.transfers == []
    assert value_ledger.retained == 0

    # Every non-zero amount is accepted unconditionally, so no path takes value and then
    # refuses it. One wei is the smallest witness to that, and a large amount confirms
    # there is no upper rejection either.
    for amount in (1, MIN_BOND, MIN_BOND * 1000):
        pool_before = int(contract.stats()["bounty_pool"])
        value_ledger.fund(amount)
        contract.fund_bounty_pool()
        value_ledger.no_value()
        assert int(contract.stats()["bounty_pool"]) == pool_before + amount

    assert value_ledger.transfers == []
    assert value_ledger.retained == value_ledger.funded


# ======================================================================================
# The property that generalises all of the above
# ======================================================================================


def test_no_payable_method_can_hold_value_it_refused(
    direct_deploy, direct_vm, direct_alice, value_ledger
):
    """One ledger across a long run of mixed accepted and refused calls.

    The per-case tests above each reset. This one does not: it interleaves acceptances
    and refusals against one contract and one ledger, then checks the single invariant
    that matters at the end. What the contract holds equals what it is holding *for*
    somebody, to the wei, with no unexplained remainder.
    """
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice

    accepted = 0
    # Accept, refuse, accept, refuse, with the refusals interleaved so a mistake cannot
    # hide behind a coincidentally equal total.
    for index in range(4):
        value_ledger.fund(MIN_BOND)
        assert contract.request_review(
            f"IG-{index}", UNISWAP, PROPOSAL_ID + index, CREATION_BLOCK
        ) == f"IG-{index}"
        accepted += MIN_BOND

        value_ledger.fund(MIN_BOND)
        assert contract.request_review(
            f"IG-{index}", UNISWAP, PROPOSAL_ID + 900 + index, CREATION_BLOCK
        ).startswith(REJECTED)

        value_ledger.fund(MIN_BOND - 1)
        assert contract.request_review(
            f"IG-LOW-{index}", UNISWAP, PROPOSAL_ID + 800 + index, CREATION_BLOCK
        ).startswith(REJECTED)

    value_ledger.fund(MIN_BOND * 3)
    contract.fund_bounty_pool()
    accepted += MIN_BOND * 3
    value_ledger.no_value()

    stats = contract.stats()
    assert stats["reviews"] == "4"
    assert int(stats["bounty_pool"]) == 3 * MIN_BOND

    # The invariant. Everything held is either an open bond or the bounty pool.
    assert escrowed(contract) == 4 * MIN_BOND + 3 * MIN_BOND
    assert value_ledger.retained == accepted
    assert value_ledger.retained == escrowed(contract)
