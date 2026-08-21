import sys


def decoder_module(direct_deploy):
    contract = direct_deploy("contracts/IntentGuard.py")
    return contract, sys.modules[contract.__class__.__module__]


def word(value):
    return f"{value:064x}"


def address(value):
    return f"{int(value, 16):064x}"


def call(module, signature, body=""):
    return module.selector_of(signature) + body


def test_decoder_corpus_and_contract_parity(direct_deploy):
    _, m = decoder_module(direct_deploy)
    recipient = "0x00000000000000000000000000000000000000aa"
    transfer = call(m, "transfer(address,uint256)", address(recipient) + word(7))
    simple = m.decode_calldata(transfer, "transfer(address,uint256)")
    assert simple["ok"] and simple["args"][1]["value"] == "7"
    assert simple["selector"] == m.selector_of("transfer(address,uint256)")
    assert m.decode_calldata(transfer, "approve(address,uint256)")["reason"] == "SELECTOR_MISMATCH"
    assert m.decode_calldata("0x12", "transfer(address,uint256)")["reason"] == "SHORT_CALLDATA"
    assert not m.decode_calldata("0xzz", "transfer(address,uint256)")["ok"]

    zero_transfer = call(m, "transfer(address,uint256)", address(recipient) + word(0))
    assert m.decode_calldata(zero_transfer, "transfer(address,uint256)")["ok"]

    bytes_sig = "execute(address,uint256,bytes)"
    inner = transfer[2:]
    outer = call(m, bytes_sig, address(recipient) + word(3) + word(96) + word(len(inner) // 2) + inner + "0" * 56)
    dynamic = m.decode_calldata(outer, bytes_sig)
    assert dynamic["ok"] and dynamic["args"][2]["value"].startswith("0xa9059cbb")
    nested = m.decode_nested(outer)
    assert nested["ok"] and nested["inner_selector"] == "0xa9059cbb"
    assert m.decode_nested(outer, m.MAX_NESTED_DEPTH)["detail"] == "DEPTH_EXCEEDED"

    malformed_offset = call(m, bytes_sig, address(recipient) + word(0) + word(1_000_000))
    assert m.decode_calldata(malformed_offset, bytes_sig)["reason"] == "BAD_OFFSET"

    array_sig = "batch(uint256[])"
    array_call = call(m, array_sig, word(32) + word(3) + word(1) + word(2) + word(3))
    array_decoded = m.decode_calldata(array_call, array_sig)
    assert array_decoded["ok"] and array_decoded["args"][0]["value"] == ["1", "2", "3"]
    malformed_array = call(m, array_sig, word(32) + word(1000))
    assert not m.decode_calldata(malformed_array, array_sig)["ok"]

    action = {"index": "0", "target": recipient, "value": "0", "selector": "0xa9059cbb", "signature": "transfer(address,uint256)", "resolved": "true", "args": simple["args"], "nested": {}, "depth_limited": "false", "ok": "true", "reason": ""}
    same = dict(action)
    assert m.canonical_digest([action]) == m.canonical_digest([same])
    duplicate = [action, dict(action)]
    assert m.canonical_digest([action]) != m.canonical_digest(duplicate)
    reordered = [dict(action, index="1"), action]
    assert m.canonical_digest(duplicate) != m.canonical_digest(reordered)
    changed_source = dict(action, value="1")
    assert m.canonical_digest([action]) != m.canonical_digest([changed_source])

    assert m.selector_of("transfer(address,uint256)") == "0xa9059cbb"
    assert m.verify("0xa9059cbb", "transfer(address,uint256)") is True
    assert m.verify("0xa9059cbb", "approve(address,uint256)") is False
    assert m.self_test() is True


def test_decoder_embedding_fingerprint_catches_drift(direct_deploy):
    contract, m = decoder_module(direct_deploy)
    fingerprint = contract.decoder_fingerprint()
    assert fingerprint["modules"] == ",".join(m.DECODER_MODULES)
    assert fingerprint["functions"] == str(m.DECODER_FUNCTION_COUNT)
    assert fingerprint["max_nested_depth"] == str(m.MAX_NESTED_DEPTH)
