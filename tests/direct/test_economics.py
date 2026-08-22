"""The books, checked after every transition a review can make.

One number has to hold everywhere: what the contract holds equals what it is holding for
somebody. For this contract that reads

    balance = open review bonds + open rebuttal bonds + bounty pool

with no fourth term. There is no protocol cut, and that is a claim these tests assert
rather than assume: `_settle` returns the bond on every terminal outcome that cannot be
rebutted, `_finalise_divergent` pays the bond plus a bounty capped at `min(bond, pool)`,
and `_settle_rebuttal` moves both stakes to one party or the other. No path routes a
fraction anywhere else, so after a completed lifecycle the contract holds exactly zero.

Why this file is separate from `test_payable_value.py`: that one proves a *refused* call
keeps nothing, which is a statement about one transaction. This one proves the accepted
path never accumulates an unexplained remainder across a whole lifecycle, which is a
statement about a sequence. The stranded 0.001 GEN in sibling project Recourse would have
been caught by either, but it is this shape of check — assert the identity after every
single transition, not just at the end — that would have named the transition that did it.

The left-hand side comes from `value_ledger`, which records every wei in and every
`EthSend` out. The right-hand side is read back out of the records. It is deliberately not
`stats()["balance"]`: on chain that field reads the real balance, but the direct harness
credits no value at all and reports zero however much a test sends, so an invariant built
on it would pass for the wrong reason.
"""

import pytest

from test_lifecycle import (
    ARGUMENT_URL,
    CREATION_BLOCK,
    MIN_BOND,
    NO_DIVERGENCE,
    PROPOSAL_ID,
    UNISWAP,
    action_set,
    install_rpc_router,
    mock_alignment,
    mock_argument,
    mock_fourbyte,
    module_of,
    set_block_time,
)
from test_payable_value import deploy, escrowed

# One clock for the whole file, so a deadline in a failure message can be read against a
# fixed origin rather than against whatever time the suite happened to run at.
START = "2026-03-01T00:00:00Z"
AFTER_COOLDOWN = "2026-03-02T00:00:01Z"       # review + 24h
AFTER_WINDOW = "2026-03-08T00:00:01Z"         # review + 7d
AFTER_SECOND_WINDOW = "2026-03-10T00:00:00Z"  # a rereview at AFTER_COOLDOWN + 7d


def parts(contract):
    """The three terms of the invariant, separately, so a failure says which one moved.

    Asserted to sum to `escrowed()` on every call, which keeps this breakdown honest: if
    the two ever disagreed, one of them would be measuring something the other is not.
    """
    reviews = contract.list_reviews(0, 500)
    review_bonds = sum(int(row["bond"]) for row in reviews if row["bond_settled"] is False)
    rebuttal_bonds = 0
    for row in reviews:
        for rb in contract.get_rebuttals(row["id"]):
            if rb["bond_settled"] is False:
                rebuttal_bonds += int(rb["bond"])
    pool = int(contract.stats()["bounty_pool"])
    total = review_bonds + rebuttal_bonds + pool
    assert total == escrowed(contract), "the breakdown and the total disagree"
    return {
        "review_bonds": review_bonds,
        "rebuttal_bonds": rebuttal_bonds,
        "pool": pool,
        "total": total,
    }


class Books:
    """The invariant as one call, with a label that names the transition that broke it."""

    def __init__(self, contract, ledger):
        self.contract = contract
        self.ledger = ledger
        self.transitions: list[str] = []

    def check(self, label):
        held = self.ledger.retained
        owed = parts(self.contract)
        assert held == owed["total"], (
            f"after {label}: the contract holds {held} wei and owes {owed['total']} "
            f"(review bonds {owed['review_bonds']}, rebuttal bonds "
            f"{owed['rebuttal_bonds']}, pool {owed['pool']})"
        )
        self.transitions.append(label)
        return owed


@pytest.fixture
def books(direct_deploy, direct_vm, value_ledger):
    """A contract, a ledger watching it, and the invariant bound to both."""
    contract = deploy(direct_deploy)
    set_block_time(direct_vm, START)
    return Books(contract, value_ledger)


# ======================================================================================
# Helpers that fund through the ledger
# ======================================================================================
#
# `test_lifecycle.py` sets `direct_vm.value` directly, which is right for the tests that
# only care about state. Here the funding has to be recorded by the same object that
# records the payouts, or the left-hand side of the invariant is missing a term. These are
# the same sequences with `ledger.fund` in place of `vm.value =`.


def funded_request(books, direct_vm, sender, review_id="IG-V1", proposal_id=PROPOSAL_ID,
                   bond=MIN_BOND):
    direct_vm.sender = sender
    books.ledger.fund(bond)
    outcome = books.contract.request_review(review_id, UNISWAP, proposal_id, CREATION_BLOCK)
    books.ledger.no_value()
    assert outcome == review_id, outcome
    return outcome


def funded_review(books, direct_vm, monkeypatch, reviewer, verdict="DIVERGENT",
                  kind="PARAM_MISMATCH", index=1, resolvable=True, review_id="IG-V1",
                  proposal_id=PROPOSAL_ID, b_actions=None):
    """Request and review in one step, checking the books after each."""
    module = module_of(books.contract)
    funded_request(books, direct_vm, reviewer, review_id=review_id, proposal_id=proposal_id)
    books.check(f"request {review_id}")

    install_rpc_router(
        monkeypatch, module, action_set(module),
        b_actions=b_actions, proposal_id=proposal_id,
    )
    mock_fourbyte(direct_vm, resolvable=resolvable)
    mock_alignment(direct_vm, verdict, kind, index)
    books.contract.review(review_id)
    books.check(f"review {review_id} -> {verdict}")
    return module


def funded_rebut(books, direct_vm, rebutter, rebuttal_id="RB-1", review_id="IG-V1",
                 bond=MIN_BOND):
    direct_vm.sender = rebutter
    books.ledger.fund(bond)
    outcome = books.contract.rebut(rebuttal_id, review_id, ARGUMENT_URL)
    books.ledger.no_value()
    assert outcome == rebuttal_id, outcome
    books.check(f"rebut {rebuttal_id}")
    return outcome


def fund_pool(books, direct_vm, sender, amount):
    direct_vm.sender = sender
    books.ledger.fund(amount)
    books.contract.fund_bounty_pool()
    books.ledger.no_value()
    books.check(f"fund pool {amount}")


def next_answers(direct_vm, alignment=None, argument=None, resolvable=True):
    """Make the next consensus round see exactly these answers and no leftovers.

    `vm.mock_llm` appends to a list and the lookup returns the first pattern that matches,
    so registering a second response for the same prompt is silently ignored. Any test that
    runs two rounds against one contract therefore has to clear first, or the second round
    quietly re-uses the first round's verdict and the test passes while measuring the wrong
    thing. That failure is invisible from the assertion side, which is why it goes through
    one named helper here rather than being spelled out at each call site.

    Clearing takes the web mocks with it, so the 4byte response is re-registered whenever
    an alignment round is what comes next.
    """
    direct_vm.clear_mocks()
    if alignment is not None:
        mock_fourbyte(direct_vm, resolvable=resolvable)
        mock_alignment(direct_vm, *alignment)
    if argument is not None:
        mock_argument(direct_vm, argument)


# ======================================================================================
# The rounds that end without a rebuttal
# ======================================================================================


@pytest.mark.parametrize("verdict,kind,index,resolvable,expected", [
    pytest.param("ALIGNED", "NONE", 0, True, "ALIGNED", id="aligned"),
    pytest.param("ALIGNED", "NONE", 0, False, "UNDERSPECIFIED", id="underspecified-unresolved"),
    pytest.param("DIVERGENT", "PARAM_MISMATCH", NO_DIVERGENCE, True, "UNDERSPECIFIED",
                 id="underspecified-no-index"),
    pytest.param("DIVERGENT", "NONE", 1, True, "UNDERSPECIFIED", id="underspecified-no-kind"),
])
def test_books_balance_through_a_round_that_returns_the_bond(
    books, direct_vm, monkeypatch, direct_alice, verdict, kind, index, resolvable, expected
):
    """Every non-rebuttable outcome releases the stake in the same transition.

    Four routes to a settled review, including the two overrides that turn a claimed
    DIVERGENT into UNDERSPECIFIED because the verdict was not usable. All four end with
    the contract holding nothing, which is the point: a reviewer who bonded a question and
    got an unusable answer is not charged for it.
    """
    funded_review(
        books, direct_vm, monkeypatch, direct_alice,
        verdict=verdict, kind=kind, index=index, resolvable=resolvable,
    )

    row = books.contract.get_review("IG-V1")
    assert row["status"] == expected
    assert row["bond_settled"] is True
    assert row["veto_flag"] is False

    assert books.ledger.paid_to(direct_alice) == MIN_BOND
    assert books.ledger.retained == 0
    assert parts(books.contract)["total"] == 0


def test_a_pending_review_holds_exactly_one_bond_and_nothing_else(
    books, direct_vm, direct_alice, direct_bob
):
    """The opening position, and the arithmetic that the rest of the file builds on."""
    funded_request(books, direct_vm, direct_alice, review_id="IG-1", proposal_id=PROPOSAL_ID)
    first = books.check("request IG-1")
    assert first == {
        "review_bonds": MIN_BOND, "rebuttal_bonds": 0, "pool": 0, "total": MIN_BOND,
    }

    funded_request(books, direct_vm, direct_bob, review_id="IG-2", proposal_id=PROPOSAL_ID + 1)
    second = books.check("request IG-2")
    assert second["review_bonds"] == 2 * MIN_BOND
    assert books.ledger.transfers == []
    assert books.ledger.retained == 2 * MIN_BOND


def test_an_undecodable_gate_returns_the_bond_without_recording_a_finding(
    books, direct_vm, monkeypatch, direct_alice
):
    """A third party's disagreement costs the reviewer nothing.

    The stake is released here even though no finding was made, and that asymmetry is
    deliberate: charging for an outage would make the honest move expensive. What matters
    for the books is that the release happens in the same transition as the refusal, so
    there is no window in which the contract holds a bond nobody can claim.
    """
    module = module_of(books.contract)
    disagreeing = [dict(a) for a in action_set(module)]
    disagreeing[0]["value"] = 1

    funded_review(
        books, direct_vm, monkeypatch, direct_alice,
        verdict="DIVERGENT", kind="PARAM_MISMATCH", index=1, b_actions=disagreeing,
    )

    row = books.contract.get_review("IG-V1")
    assert row["status"] == "UNDECODABLE"
    assert row["undecodable_gate"] == "EXPLORER_DISAGREEMENT"
    assert row["bond_settled"] is True
    assert books.ledger.paid_to(direct_alice) == MIN_BOND
    assert books.ledger.retained == 0


# ======================================================================================
# DIVERGENT: the one outcome that keeps a stake at risk
# ======================================================================================


def test_a_veto_keeps_the_stake_escrowed_until_the_window_closes(
    books, direct_vm, monkeypatch, direct_alice
):
    funded_review(books, direct_vm, monkeypatch, direct_alice)

    row = books.contract.get_review("IG-V1")
    assert row["status"] == "DIVERGENT" and row["veto_flag"] is True
    # Still at risk, and therefore still on the books as an open bond.
    assert row["bond_settled"] is False
    assert books.check("veto standing")["review_bonds"] == MIN_BOND
    assert books.ledger.transfers == []

    set_block_time(direct_vm, AFTER_WINDOW)
    books.contract.expire_rebuttal_window("IG-V1")
    after = books.check("expire unrebutted window")

    assert books.contract.get_review("IG-V1")["bond_settled"] is True
    assert books.contract.get_review("IG-V1")["veto_flag"] is True
    assert after["total"] == 0
    assert books.ledger.paid_to(direct_alice) == MIN_BOND
    assert books.ledger.retained == 0


def test_the_bounty_is_capped_at_the_bond_and_again_at_the_pool(
    books, direct_vm, monkeypatch, direct_alice, direct_bob
):
    """Both caps, and the pool arithmetic each one produces.

    Two vetoes against one pool. The first is bonded at four times the minimum and the
    pool holds only three, so the payout is the pool. The second is bonded at the minimum
    against an empty pool, so there is no bounty at all and `bounty_paid` stays false —
    which is exactly why `_finalise_divergent` latches on the payout being non-zero rather
    than on having run.
    """
    fund_pool(books, direct_vm, direct_bob, 3 * MIN_BOND)
    assert books.check("pool funded")["pool"] == 3 * MIN_BOND

    module = module_of(books.contract)
    funded_request(books, direct_vm, direct_alice, review_id="IG-BIG", bond=4 * MIN_BOND)
    install_rpc_router(monkeypatch, module, action_set(module))
    next_answers(direct_vm, alignment=("DIVERGENT", "PARAM_MISMATCH", 1))
    books.contract.review("IG-BIG")
    held = books.check("big veto standing")
    assert held == {
        "review_bonds": 4 * MIN_BOND, "rebuttal_bonds": 0, "pool": 3 * MIN_BOND,
        "total": 7 * MIN_BOND,
    }

    set_block_time(direct_vm, AFTER_WINDOW)
    books.contract.expire_rebuttal_window("IG-BIG")
    drained = books.check("big veto paid, pool capped")

    # Bond back plus the whole pool, because the pool was the smaller cap.
    assert books.ledger.paid_to(direct_alice) == 4 * MIN_BOND + 3 * MIN_BOND
    assert drained == {"review_bonds": 0, "rebuttal_bonds": 0, "pool": 0, "total": 0}
    assert books.contract.get_review("IG-BIG")["bounty_paid"] is True
    assert books.ledger.retained == 0

    # Now the other cap: a minimum-bond veto with nothing left to pay it from.
    set_block_time(direct_vm, START)
    funded_request(books, direct_vm, direct_alice, review_id="IG-SMALL",
                   proposal_id=PROPOSAL_ID + 1)
    install_rpc_router(monkeypatch, module, action_set(module), proposal_id=PROPOSAL_ID + 1)
    next_answers(direct_vm, alignment=("DIVERGENT", "PARAM_MISMATCH", 1))
    books.contract.review("IG-SMALL")
    books.check("small veto standing")

    set_block_time(direct_vm, AFTER_WINDOW)
    books.contract.expire_rebuttal_window("IG-SMALL")
    books.check("small veto paid from an empty pool")

    assert books.contract.get_review("IG-SMALL")["bond_settled"] is True
    assert books.contract.get_review("IG-SMALL")["bounty_paid"] is False
    assert books.ledger.retained == 0


def test_a_bounty_larger_than_the_bond_pays_only_the_bond(
    books, direct_vm, monkeypatch, direct_alice, direct_bob
):
    fund_pool(books, direct_vm, direct_bob, 10 * MIN_BOND)
    funded_review(books, direct_vm, monkeypatch, direct_alice)

    set_block_time(direct_vm, AFTER_WINDOW)
    books.contract.expire_rebuttal_window("IG-V1")
    left = books.check("bounty capped at the bond")

    # Bond plus a bounty equal to the bond, and the pool keeps the remainder.
    assert books.ledger.paid_to(direct_alice) == 2 * MIN_BOND
    assert left == {
        "review_bonds": 0, "rebuttal_bonds": 0, "pool": 9 * MIN_BOND,
        "total": 9 * MIN_BOND,
    }
    assert books.ledger.retained == 9 * MIN_BOND


# ======================================================================================
# The rebuttal path: two stakes on the books at once
# ======================================================================================


def test_an_open_rebuttal_puts_both_stakes_on_the_books(
    books, direct_vm, monkeypatch, direct_alice, direct_bob
):
    funded_review(books, direct_vm, monkeypatch, direct_alice)
    funded_rebut(books, direct_vm, direct_bob)

    held = books.check("both stakes held")
    assert held == {
        "review_bonds": MIN_BOND, "rebuttal_bonds": MIN_BOND, "pool": 0,
        "total": 2 * MIN_BOND,
    }
    # Nothing has moved yet. This is the only state in which the contract holds money
    # belonging to two different people over the same claim.
    assert books.ledger.transfers == []
    assert books.ledger.retained == 2 * MIN_BOND


def test_upheld_sends_both_stakes_to_the_reviewer(
    books, direct_vm, monkeypatch, direct_alice, direct_bob
):
    funded_review(books, direct_vm, monkeypatch, direct_alice)
    funded_rebut(books, direct_vm, direct_bob)

    mock_argument(direct_vm, "UPHELD")
    books.contract.adjudicate_rebuttal("RB-1")
    after = books.check("adjudicate UPHELD")

    assert books.contract.get_rebuttal("RB-1")["status"] == "UPHELD"
    assert books.contract.get_review("IG-V1")["veto_flag"] is True
    # The rebutter staked against a finding that stood, so their stake follows the
    # reviewer's own back to the reviewer.
    assert books.ledger.paid_to(direct_alice) == 2 * MIN_BOND
    assert books.ledger.paid_to(direct_bob) == 0
    assert after["total"] == 0
    assert books.ledger.retained == 0


def test_withdrawn_veto_sends_both_stakes_to_the_rebutter(
    books, direct_vm, monkeypatch, direct_alice, direct_bob
):
    funded_review(books, direct_vm, monkeypatch, direct_alice)
    funded_rebut(books, direct_vm, direct_bob)

    mock_argument(direct_vm, "WITHDRAWN_VETO")
    books.contract.adjudicate_rebuttal("RB-1")
    after = books.check("adjudicate WITHDRAWN_VETO")

    row = books.contract.get_review("IG-V1")
    assert row["veto_flag"] is False
    # Recorded as UNDERSPECIFIED, not ALIGNED: one defeated divergence is not a positive
    # finding that everything else matches.
    assert row["status"] == "UNDERSPECIFIED"
    assert books.ledger.paid_to(direct_bob) == 2 * MIN_BOND
    assert books.ledger.paid_to(direct_alice) == 0
    # No bounty can have been paid on this route, and none was.
    assert row["bounty_paid"] is False
    assert after["total"] == 0
    assert books.ledger.retained == 0


def test_unclear_sends_each_stake_home(
    books, direct_vm, monkeypatch, direct_alice, direct_bob
):
    """Nobody is paid for ambiguity and nobody is fined for it.

    That symmetry is what makes UNCLEAR a usable answer rather than one an adjudicator
    avoids, and on the books it is the only rebuttal outcome where the two stakes go to
    two different places.
    """
    funded_review(books, direct_vm, monkeypatch, direct_alice)
    funded_rebut(books, direct_vm, direct_bob)

    mock_argument(direct_vm, "UNCLEAR")
    books.contract.adjudicate_rebuttal("RB-1")
    after = books.check("adjudicate UNCLEAR")

    assert books.contract.get_rebuttal("RB-1")["status"] == "UNCLEAR"
    assert books.contract.get_review("IG-V1")["veto_flag"] is True
    assert books.ledger.paid_to(direct_alice) == MIN_BOND
    assert books.ledger.paid_to(direct_bob) == MIN_BOND
    assert after["total"] == 0
    assert books.ledger.retained == 0


def test_a_lapsed_rebuttal_settles_as_unclear_and_clears_the_books(
    books, direct_vm, monkeypatch, direct_alice, direct_bob
):
    funded_review(books, direct_vm, monkeypatch, direct_alice)
    funded_rebut(books, direct_vm, direct_bob)

    set_block_time(direct_vm, AFTER_WINDOW)
    books.contract.expire_rebuttal_window("IG-V1")
    after = books.check("rebuttal lapsed unread")

    assert books.contract.get_rebuttal("RB-1")["status"] == "UNCLEAR"
    assert books.ledger.paid_to(direct_alice) == MIN_BOND
    assert books.ledger.paid_to(direct_bob) == MIN_BOND
    assert after["total"] == 0


def test_a_settled_lifecycle_cannot_be_settled_again(
    books, direct_vm, monkeypatch, direct_alice, direct_bob
):
    """Every settlement button is permissionless, so each one has to be idempotent.

    The invariant is checked after each refused second press, because a double payment
    would show up here as the contract owing more than it holds — a negative remainder,
    which is the failure mode this whole file exists to make impossible to miss.
    """
    funded_review(books, direct_vm, monkeypatch, direct_alice)
    funded_rebut(books, direct_vm, direct_bob)
    mock_argument(direct_vm, "UPHELD")
    books.contract.adjudicate_rebuttal("RB-1")
    paid = books.ledger.paid_out
    books.check("settled once")

    with direct_vm.expect_revert():
        books.contract.adjudicate_rebuttal("RB-1")
    books.check("second adjudicate refused")

    with direct_vm.expect_revert():
        books.contract.expire_rebuttal_window("IG-V1")
    books.check("second expiry refused")

    set_block_time(direct_vm, AFTER_WINDOW)
    with direct_vm.expect_revert():
        books.contract.expire_rebuttal_window("IG-V1")
    books.check("expiry after the deadline still refused")

    assert books.ledger.paid_out == paid
    assert books.ledger.retained == 0


# ======================================================================================
# Override and rereview
# ======================================================================================


def test_an_override_leaves_the_stake_escrowed_and_rereview_releases_it(
    books, direct_vm, monkeypatch, direct_alice, direct_bob
):
    """`clear_veto_by_vote` moves no money, and this records exactly what that means.

    The DAO going ahead anyway is not a rebuttal: nothing has defeated the finding on its
    merits, so the stake stays at risk. What the override does do is clear the deadline,
    which closes `expire_rebuttal_window` as a release route. That leaves `rereview` — a
    permissionless call, available after a 24h cooldown — as the only way the bond comes
    home, and the second half of this test proves it does.

    So the balance is explained at every point, but the release is not immediate. That is
    a liveness note about the override, not an accounting hole: the money is attributable
    to a named reviewer in a record that says it is unsettled, and a permissionless button
    releases it. Recording it here rather than quietly leaving it out is the honest
    treatment.
    """
    funded_review(books, direct_vm, monkeypatch, direct_alice)

    direct_vm.sender = direct_bob
    books.contract.clear_veto_by_vote("IG-V1", "snapshot:0xfeed")
    overridden = books.check("veto cleared by vote")

    row = books.contract.get_review("IG-V1")
    assert row["veto_flag"] is False
    assert row["override_vote_ref"] == "snapshot:0xfeed"
    assert row["rebuttal_deadline"] == ""
    # Still DIVERGENT and still unsettled: the override records a disagreement, it does
    # not withdraw the finding.
    assert row["status"] == "DIVERGENT"
    assert row["bond_settled"] is False
    assert overridden["review_bonds"] == MIN_BOND
    assert books.ledger.transfers == []

    # The deadline is gone, so the expiry route is closed.
    set_block_time(direct_vm, AFTER_WINDOW)
    with direct_vm.expect_revert():
        books.contract.expire_rebuttal_window("IG-V1")
    books.check("expiry closed by the override")

    # Rereview is the way out. A clean second round settles the stake.
    next_answers(direct_vm, alignment=("ALIGNED", "NONE", 0))
    books.contract.rereview("IG-V1")
    released = books.check("rereview released the stake")

    assert books.contract.get_review("IG-V1")["status"] == "ALIGNED"
    assert books.contract.get_review("IG-V1")["bond_settled"] is True
    assert books.ledger.paid_to(direct_alice) == MIN_BOND
    assert released["total"] == 0
    assert books.ledger.retained == 0


def test_rereview_takes_no_new_bond_and_cannot_pay_the_old_one_twice(
    books, direct_vm, monkeypatch, direct_alice
):
    """A settled review re-run into a veto, then expired.

    This is the sequence where a naive latch would double-pay: the first round returned
    the bond and set `bond_settled`, and the second round records a fresh veto whose
    expiry calls `_finalise_divergent` again. The flag is what stops it, and the invariant
    is what would have noticed if it had not.
    """
    funded_review(
        books, direct_vm, monkeypatch, direct_alice,
        verdict="ALIGNED", kind="NONE", index=0,
    )
    assert books.contract.get_review("IG-V1")["bond_settled"] is True
    assert books.ledger.paid_to(direct_alice) == MIN_BOND
    paid_after_first = books.ledger.paid_out

    set_block_time(direct_vm, AFTER_COOLDOWN)
    next_answers(direct_vm, alignment=("DIVERGENT", "PARAM_MISMATCH", 1))
    books.contract.rereview("IG-V1")
    rerun = books.check("rereview -> DIVERGENT")

    row = books.contract.get_review("IG-V1")
    assert row["status"] == "DIVERGENT" and row["veto_flag"] is True
    # No new bond was taken, and the old one is already home, so the books are empty even
    # though a veto is standing.
    assert rerun["total"] == 0
    assert row["bond_settled"] is True
    assert books.ledger.paid_out == paid_after_first

    set_block_time(direct_vm, AFTER_SECOND_WINDOW)
    books.contract.expire_rebuttal_window("IG-V1")
    books.check("expire the second window")

    # The latch held: the settled bond was not sent a second time.
    assert books.ledger.paid_out == paid_after_first
    assert books.ledger.paid_to(direct_alice) == MIN_BOND
    assert books.ledger.retained == 0


# ======================================================================================
# The whole surface at once
# ======================================================================================


def test_no_transition_anywhere_leaves_an_unexplained_balance(
    books, direct_vm, monkeypatch, direct_alice, direct_bob, direct_charlie
):
    """Every outcome the contract can reach, in one contract, on one ledger.

    The per-case tests above each start from a clean deployment, which means none of them
    can catch a remainder that only appears when states coexist. This one runs six reviews
    to six different terminal outcomes, with a funded pool underneath and a rebuttal in
    flight, and checks the identity after every single call.

    The closing assertions are the point of the file: the contract holds exactly the pool
    remainder, every wei that left went to a named participant, and the sum of what the
    three of them received plus what is still held equals the total ever sent. There is no
    fourth term, so there is no protocol take.
    """
    module = module_of(books.contract)
    fund_pool(books, direct_vm, direct_charlie, 2 * MIN_BOND)

    # An aligned round.
    funded_request(books, direct_vm, direct_alice, review_id="IG-A", proposal_id=201)
    books.check("request IG-A")
    install_rpc_router(monkeypatch, module, action_set(module), proposal_id=201)
    next_answers(direct_vm, alignment=("ALIGNED", "NONE", 0))
    books.contract.review("IG-A")
    books.check("IG-A aligned")

    # An underspecified round, opened while IG-A is already closed.
    funded_request(books, direct_vm, direct_bob, review_id="IG-B", proposal_id=202)
    books.check("request IG-B")
    install_rpc_router(monkeypatch, module, action_set(module), proposal_id=202)
    next_answers(direct_vm, alignment=("DIVERGENT", "PARAM_MISMATCH", NO_DIVERGENCE))
    books.contract.review("IG-B")
    books.check("IG-B underspecified")
    assert books.contract.get_review("IG-B")["status"] == "UNDERSPECIFIED"

    # A veto that nobody argues with, left open for now so it coexists with the rest.
    funded_request(books, direct_vm, direct_alice, review_id="IG-C", proposal_id=203)
    books.check("request IG-C")
    install_rpc_router(monkeypatch, module, action_set(module), proposal_id=203)
    next_answers(direct_vm, alignment=("DIVERGENT", "PARAM_MISMATCH", 1))
    books.contract.review("IG-C")
    books.check("IG-C vetoed")
    assert books.contract.get_review("IG-C")["veto_flag"] is True

    # A veto that is rebutted and upheld.
    funded_request(books, direct_vm, direct_alice, review_id="IG-D", proposal_id=204)
    books.check("request IG-D")
    install_rpc_router(monkeypatch, module, action_set(module), proposal_id=204)
    next_answers(direct_vm, alignment=("DIVERGENT", "PARAM_MISMATCH", 1))
    books.contract.review("IG-D")
    books.check("IG-D vetoed")
    funded_rebut(books, direct_vm, direct_bob, rebuttal_id="RB-D", review_id="IG-D")

    # A veto whose rebuttal wins, opened while RB-D is still in flight: two rebuttals on
    # the books at once is the widest the escrow ever gets.
    funded_request(books, direct_vm, direct_alice, review_id="IG-E", proposal_id=205)
    books.check("request IG-E")
    install_rpc_router(monkeypatch, module, action_set(module), proposal_id=205)
    next_answers(direct_vm, alignment=("DIVERGENT", "PARAM_MISMATCH", 1))
    books.contract.review("IG-E")
    books.check("IG-E vetoed")
    funded_rebut(books, direct_vm, direct_charlie, rebuttal_id="RB-E", review_id="IG-E")

    widest = books.check("two rebuttals and a veto all open")
    assert widest["review_bonds"] == 3 * MIN_BOND     # IG-C, IG-D, IG-E
    assert widest["rebuttal_bonds"] == 2 * MIN_BOND   # RB-D, RB-E
    assert widest["pool"] == 2 * MIN_BOND

    # A refused request in the middle of all that, to prove the rejection path does not
    # disturb anything that is already escrowed.
    direct_vm.sender = direct_bob
    books.ledger.fund(MIN_BOND - 1)
    refused = books.contract.request_review("IG-LOW", UNISWAP, 206, CREATION_BLOCK)
    books.ledger.no_value()
    assert refused.startswith("[REJECTED]")
    assert books.check("refused request") == widest

    # Now close everything, checking after each.
    next_answers(direct_vm, argument="UPHELD")
    books.contract.adjudicate_rebuttal("RB-D")
    books.check("RB-D upheld")
    assert books.contract.get_rebuttal("RB-D")["status"] == "UPHELD"

    next_answers(direct_vm, argument="WITHDRAWN_VETO")
    books.contract.adjudicate_rebuttal("RB-E")
    books.check("RB-E withdrew the veto")
    assert books.contract.get_rebuttal("RB-E")["status"] == "WITHDRAWN_VETO"

    set_block_time(direct_vm, AFTER_WINDOW)
    books.contract.expire_rebuttal_window("IG-C")
    closed = books.check("IG-C window expired")

    # Nothing is escrowed any more; only the pool remainder is left.
    assert closed["review_bonds"] == 0 and closed["rebuttal_bonds"] == 0
    assert closed["total"] == closed["pool"]

    stats = books.contract.stats()
    assert stats["reviews"] == "5"
    assert stats["rebuttals"] == "2"
    # IG-C and IG-D stand; IG-E's veto was withdrawn.
    assert stats["active_vetoes"] == "2"

    # The closing identity. Everything ever sent is now either in someone's hands or in
    # the pool, and the pool is the only thing the contract still holds.
    received = (
        books.ledger.paid_to(direct_alice)
        + books.ledger.paid_to(direct_bob)
        + books.ledger.paid_to(direct_charlie)
    )
    assert received == books.ledger.paid_out, "value went somewhere unnamed"
    assert books.ledger.retained == int(stats["bounty_pool"])
    assert books.ledger.funded == received + books.ledger.retained
    assert books.ledger.retained == parts(books.contract)["total"]

    # And the sweep really did run. Pinned exactly, not as a floor: a check that gets
    # dropped in a later edit should fail here rather than quietly shrink the coverage this
    # test claims.
    assert len(books.transitions) == 18, books.transitions
