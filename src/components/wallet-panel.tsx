"use client";

import { useState } from "react";
import { useWallet } from "@/components/wallet-provider";
import { shortenHex } from "@/lib/format";

export function WalletPlate() {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const label =
    wallet.mode === "injected"
      ? "injected wallet"
      : wallet.mode === "generated"
        ? "browser wallet"
        : "read only";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex flex-col items-start border border-[var(--rule-strong)] px-3 py-1.5 text-left"
      >
        <span className="ig-label">{label}</span>
        <span className="ig-calldata-sm">
          {wallet.address ? shortenHex(wallet.address) : "not connected"}
        </span>
      </button>
      {open ? (
        <div className="ig-verso absolute right-0 top-[calc(100%+8px)] z-50 w-[min(92vw,26rem)] border border-[var(--rule-strong)] p-4 shadow-[0_18px_40px_-24px_rgba(26,29,33,0.45)]">
          <WalletPanel onDone={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}

export function WalletPanel({ onDone }: { onDone?: () => void }) {
  const wallet = useWallet();
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [importValue, setImportValue] = useState("");

  async function connect() {
    setError(null);
    try {
      await wallet.connectInjected();
      onDone?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="ig-label">signing</p>
        <p className="ig-aside mt-1">
          Reading the ledger needs no wallet. Requesting a review, running one, rebutting or
          adjudicating are writes, and each one needs a signature.
        </p>
      </div>

      {wallet.mode === "none" ? (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={connect} className="ig-btn">
            Connect an injected wallet
          </button>
          <button
            type="button"
            onClick={() => {
              wallet.useGenerated();
              onDone?.();
            }}
            className="ig-btn-quiet"
          >
            Create a browser wallet
          </button>
          <p className="ig-aside">
            A browser wallet keeps its private key in this browser&apos;s localStorage. It is for
            trying the mechanism on a test network, and for nothing else.
          </p>
          <details>
            <summary className="ig-label cursor-pointer">import an existing key</summary>
            <div className="mt-2 flex flex-col gap-2">
              <input
                className="ig-input ig-calldata-sm"
                value={importValue}
                onChange={(event) => setImportValue(event.target.value)}
                placeholder="0x…"
                aria-label="Private key"
              />
              <button
                type="button"
                className="ig-btn-quiet"
                onClick={() => {
                  const trimmed = importValue.trim();
                  if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
                    setError("A private key is 0x followed by 64 hex characters.");
                    return;
                  }
                  setError(null);
                  wallet.importGenerated(trimmed as `0x${string}`);
                  onDone?.();
                }}
              >
                Import
              </button>
            </div>
          </details>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <p className="ig-label">address</p>
            <p className="ig-calldata mt-1 break-all">{wallet.address}</p>
          </div>
          {wallet.mode === "generated" ? (
            <div>
              <button
                type="button"
                className="ig-btn-quiet"
                onClick={() => setRevealed((value) => !value)}
              >
                {revealed ? "Hide private key" : "Reveal private key"}
              </button>
              {revealed ? (
                <p className="ig-calldata-sm mt-2 break-all border border-[var(--rubric)] p-2">
                  {wallet.exportPrivateKey()}
                </p>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className="ig-btn-quiet"
            onClick={() => {
              wallet.disconnect();
              onDone?.();
            }}
          >
            Disconnect
          </button>
        </div>
      )}

      {error ? (
        <p className="ig-aside ig-rubric" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
