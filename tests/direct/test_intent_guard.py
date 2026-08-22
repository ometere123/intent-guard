MIN_BOND = 10**15
UNISWAP = "0x408ed6354d4973f66138c91495f2f2fcbd8724c3"


def deploy(direct_deploy):
    return direct_deploy("contracts/IntentGuard.py")


def request(contract, direct_vm, sender, review_id="IG-1", proposal_id=100):
    direct_vm.sender = sender
    direct_vm.value = MIN_BOND
    return contract.request_review(review_id, UNISWAP, proposal_id, 25554834)


def test_below_minimum_bond_is_rejected(
    direct_vm, direct_deploy, direct_alice, value_ledger
):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    sent = value_ledger.fund(MIN_BOND - 1)

    outcome = contract.request_review("IG-LOW", UNISWAP, 100, 25554834)

    assert outcome.startswith("[REJECTED]")
    assert "Review bond below the minimum" in outcome
    assert value_ledger.paid_to(direct_alice) == sent
    assert value_ledger.retained == 0
    assert contract.list_reviews(0, 50) == []


def test_request_creation_stores_exact_initial_state(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    assert request(contract, direct_vm, direct_alice) == "IG-1"
    row = contract.get_review("IG-1")
    assert row["id"] == "IG-1"
    assert row["requester"].lower() == "0x" + direct_alice.hex()
    assert row["governor"] == UNISWAP
    assert row["proposal_id"] == "100"
    assert row["creation_block"] == "25554834"
    assert row["bond"] == str(MIN_BOND)
    assert row["status"] == "PENDING"
    assert row["veto_flag"] is False
    assert row["bond_settled"] is False


def test_duplicate_id_and_duplicate_proposal_are_rejected(
    direct_vm, direct_deploy, direct_alice, value_ledger
):
    contract = deploy(direct_deploy)
    request(contract, direct_vm, direct_alice)
    value_ledger.clear()

    value_ledger.fund(MIN_BOND)
    duplicate_id = contract.request_review("IG-1", UNISWAP, 101, 25554834)
    assert duplicate_id.startswith("[REJECTED]")
    assert "review_id already used" in duplicate_id

    value_ledger.fund(MIN_BOND)
    duplicate_proposal = contract.request_review("IG-2", UNISWAP, 100, 25554834)
    assert duplicate_proposal.startswith("[REJECTED]")
    assert "already has review IG-1" in duplicate_proposal

    # Two rejected attempts, two full refunds, and the first review's record untouched.
    assert value_ledger.paid_to(direct_alice) == 2 * MIN_BOND
    assert value_ledger.retained == 0
    assert [row["id"] for row in contract.list_reviews(0, 50)] == ["IG-1"]
    assert contract.get_review("IG-1")["proposal_id"] == "100"


def test_unsupported_governor_and_invalid_inputs_fail_before_storage(
    direct_vm, direct_deploy, direct_alice, value_ledger
):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice

    cases = [
        ("IG-BAD-GOV", "0x0000000000000000000000000000000000000001", 100, 25554834,
         "Unsupported Governor"),
        ("IG-ZERO", UNISWAP, 0, 25554834, "proposal_id must be non-zero"),
        ("IG-BLOCK", UNISWAP, 100, 1, "outside the plausible mainnet range"),
        ("", UNISWAP, 100, 25554834, "review_id is required"),
    ]
    for review_id, governor, proposal_id, block, expected in cases:
        value_ledger.fund(MIN_BOND)
        outcome = contract.request_review(review_id, governor, proposal_id, block)
        assert outcome.startswith("[REJECTED]"), outcome
        assert expected in outcome, outcome

    assert contract.list_reviews(0, 50) == []
    assert value_ledger.paid_to(direct_alice) == len(cases) * MIN_BOND
    assert value_ledger.retained == 0
    assert contract.stats()["reviews"] == "0"


def test_is_vetoed_distinguishes_no_record_from_pending_record(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    empty = contract.is_vetoed(UNISWAP, 100)
    assert empty["reviewed"] is False
    assert empty["vetoed"] is False
    assert empty["review_id"] == ""
    request(contract, direct_vm, direct_alice)
    pending = contract.is_vetoed(UNISWAP, 100)
    assert pending["reviewed"] is False
    assert pending["vetoed"] is False
    assert pending["review_id"] == "IG-1"
    assert pending["status"] == "PENDING"


def test_decoder_and_keccak_self_tests_are_bound_to_contract(direct_deploy):
    contract = deploy(direct_deploy)
    assert contract.keccak_self_test()["ok"] is True
    decoder = contract.decoder_self_test()
    assert decoder["ok"] is True
    fingerprint = contract.decoder_fingerprint()
    assert fingerprint["functions"] == "46"
