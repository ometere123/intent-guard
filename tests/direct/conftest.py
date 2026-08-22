"""Windows compatibility for genlayer-test's direct loader, plus the value ledger.

The loader duplicates its temporary message file onto fd 0, then unlinks the path while
that duplicate is still open. POSIX permits that; Windows returns WinError 32. Deferring
only that specific failure lets the upstream fixture finish and keeps the contract tests
identical across platforms.

The value ledger is the other half of this file, and it exists because the direct harness
has no handler for `EthSend`: a contract can emit a transfer and the harness will trace
"Unknown gl_call request type" and carry on, so a test that does not watch for the request
cannot tell a refunded bond from a stranded one. Installing a hook turns those emissions
into assertable facts.
"""

import atexit
import os
import re

import pytest


if os.name == "nt":
    _unlink = os.unlink
    _deferred = []

    def _portable_unlink(path, *args, **kwargs):
        try:
            return _unlink(path, *args, **kwargs)
        except PermissionError:
            _deferred.append(path)
            return None

    os.unlink = _portable_unlink

    @atexit.register
    def _cleanup_deferred():
        for path in _deferred:
            try:
                _unlink(path)
            except OSError:
                pass


_HEX40 = re.compile(r"0x([0-9a-fA-F]{40})")


def address_hex(value) -> str:
    """Normalise whatever an `EthSend` carries as its recipient to lowercase `0x…40`.

    The SDK's `Address` is imported by the loader out of the cached GenVM tarball, so it
    is not importable from the host process and cannot be isinstance-checked here. Hence
    the accessor attempts followed by a repr fallback. The assertion at the end is the
    part that matters: a recipient this function cannot read becomes a failed test, never
    a transfer silently attributed to the wrong account.
    """
    for attr in ("as_hex", "hex"):
        got = getattr(value, attr, None)
        if got is not None:
            text = got() if callable(got) else got
            match = _HEX40.search(str(text) if str(text).startswith("0x") else f"0x{text}")
            if match:
                return "0x" + match.group(1).lower()

    match = _HEX40.search(repr(value))
    assert match, f"could not read an address out of {value!r}"
    return "0x" + match.group(1).lower()


class ValueLedger:
    """Tracks GEN into and out of the contract across a test, to the wei.

    `fund` is the only way a test should attach value to a call. Routing it through here
    means the "paid in" side of the accounting is recorded by the same object that records
    the "paid out" side, so the two cannot drift apart the way they would if each test
    kept its own running total.
    """

    def __init__(self, vm):
        self._vm = vm
        self.transfers: list[tuple[str, int]] = []
        self.funded = 0

    def fund(self, amount: int) -> int:
        """Attach `amount` wei to the next call and remember that it was sent."""
        self._vm.value = int(amount)
        self.funded += int(amount)
        return int(amount)

    def no_value(self) -> None:
        self._vm.value = 0

    def _hook(self, vm, request):
        """Record `EthSend`; leave every other request to the harness.

        Returning `None` for anything else is deliberate: the harness treats a hook that
        returns `None` exactly as it treats no hook at all, so installing this cannot
        change how any other host call behaves.
        """
        send = request.get("EthSend") if isinstance(request, dict) else None
        if send is None:
            return None
        self.transfers.append((address_hex(send["address"]), int(send["value"])))
        return {"ok": None}

    @property
    def paid_out(self) -> int:
        return sum(amount for _, amount in self.transfers)

    @property
    def retained(self) -> int:
        """What the contract is holding, by the ledger's reckoning: in minus out."""
        return self.funded - self.paid_out

    def paid_to(self, account) -> int:
        target = address_hex(account)
        return sum(amount for who, amount in self.transfers if who == target)

    def clear(self) -> None:
        self.transfers.clear()
        self.funded = 0


@pytest.fixture
def value_ledger(direct_vm):
    ledger = ValueLedger(direct_vm)
    direct_vm._gl_call_hook = ledger._hook
    return ledger
