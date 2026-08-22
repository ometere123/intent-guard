"use client";

import { useWallet } from "@/components/wallet-provider";
import { shortenHex } from "@/lib/format";

/**
 * The signing control in the masthead. One button and no menu: an injected
 * wallet is the only signer this app accepts, so a chooser would be a chooser
 * with one item in it. Clicking asks the wallet directly.
 *
 * The line under the address is the network the wallet reports, not the network this
 * build targets. Those are usually the same and occasionally are not, and printing the
 * build's answer either way would be the most misleading thing on the page.
 */
export function WalletPlate() {
  const wallet = useWallet();

  return (
    <div className="relative">
      {wallet.mode === "injected" && wallet.address ? (
        <div className="flex items-stretch border border-[var(--rule-strong)]">
          <span className="flex flex-col items-start px-3 py-1.5">
            <span className={`ig-label ${wallet.canWrite ? "" : "ig-rubric"}`}>
              {wallet.networkName}
            </span>
            <span className="ig-calldata-sm">{shortenHex(wallet.address)}</span>
          </span>
          {wallet.network.kind === "wrong" ? (
            <button
              type="button"
              onClick={() => void wallet.switchNetwork()}
              className="ig-label border-l border-[var(--rule-strong)] px-3 py-1.5"
            >
              Switch network
            </button>
          ) : null}
          <button
            type="button"
            onClick={wallet.disconnect}
            className="ig-label border-l border-[var(--rule-strong)] px-3 py-1.5"
          >
            Disconnect wallet
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void wallet.connectInjected()}
          disabled={wallet.connecting}
          className="ig-label ig-label-ink border border-[var(--rule-strong)] px-3 py-2 disabled:opacity-60"
        >
          {wallet.connecting ? "Waiting for wallet" : "Connect wallet"}
        </button>
      )}
      {wallet.error || (wallet.mode === "injected" && !wallet.canWrite) ? (
        <p
          role="alert"
          className="ig-verso ig-aside ig-rubric absolute right-0 top-[calc(100%+6px)] z-50 w-[min(90vw,22rem)] border border-[var(--rubric)] p-2"
        >
          {wallet.error ?? wallet.writeBlockedReason}
        </p>
      ) : null}
    </div>
  );
}
