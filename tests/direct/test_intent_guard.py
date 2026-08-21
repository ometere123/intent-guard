MIN_BOND = 10**15
UNISWAP = "0x408ed6354d4973f66138c91495f2f2fcbd8724c3"


def deploy(direct_deploy):
    return direct_deploy("contracts/IntentGuard.py")


def request(contract, direct_vm, sender, review_id="IG-1", proposal_id=100):
    direct_vm.sender = sender
    direct_vm.value = MIN_BOND
    contract.request_review(review_id, UNISWAP, proposal_id, 25554834)


def test_below_minimum_bond_is_rejected(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    direct_vm.value = MIN_BOND - 1
    with direct_vm.expect_revert("Review bond below the minimum"):
        contract.request_review("IG-LOW", UNISWAP, 100, 25554834)


def test_request_creation_stores_exact_initial_state(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    request(contract, direct_vm, direct_alice)
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


def test_duplicate_id_and_duplicate_proposal_are_rejected(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    request(contract, direct_vm, direct_alice)
    direct_vm.value = MIN_BOND
    with direct_vm.expect_revert("review_id already used"):
        contract.request_review("IG-1", UNISWAP, 101, 25554834)
    direct_vm.value = MIN_BOND
    with direct_vm.expect_revert("already has review IG-1"):
        contract.request_review("IG-2", UNISWAP, 100, 25554834)


def test_unsupported_governor_and_invalid_inputs_fail_before_storage(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    direct_vm.value = MIN_BOND
    with direct_vm.expect_revert("Unsupported Governor"):
        contract.request_review("IG-BAD-GOV", "0x0000000000000000000000000000000000000001", 100, 25554834)
    direct_vm.value = MIN_BOND
    with direct_vm.expect_revert("proposal_id must be non-zero"):
        contract.request_review("IG-ZERO", UNISWAP, 0, 25554834)
    direct_vm.value = MIN_BOND
    with direct_vm.expect_revert("outside the plausible mainnet range"):
        contract.request_review("IG-BLOCK", UNISWAP, 100, 1)
    assert contract.list_reviews(0, 50) == []


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
