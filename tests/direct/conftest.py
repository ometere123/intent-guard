"""Windows compatibility for genlayer-test's direct loader.

The loader duplicates its temporary message file onto fd 0, then unlinks the path while
that duplicate is still open. POSIX permits that; Windows returns WinError 32. Deferring
only that specific failure lets the upstream fixture finish and keeps the contract tests
identical across platforms.
"""

import atexit
import os


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
