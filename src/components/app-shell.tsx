"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { WalletPlate } from "@/components/wallet-control";
import { Logo } from "@/components/logo";
import { TransactionRail } from "@/components/transaction-rail";
import { CHAIN_NAME } from "@/lib/genlayer/config";
import { dataProvenance } from "@/lib/genlayer/data-source";

const NAV = [
  { href: "/", label: "frontispiece" },
  { href: "/reviews", label: "ledger" },
  { href: "/reviews/new", label: "request a review" },
  { href: "/guard", label: "guard" },
  { href: "/docs", label: "apparatus criticus" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [railOpen, setRailOpen] = useState(false);
  const provenance = dataProvenance();

  return (
    <div className="min-h-dvh">
      {/* Running head. A book's, not an app's. */}
      <header className="ig-verso sticky top-0 z-40 border-b border-[var(--rule)] backdrop-blur-[2px]">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-baseline gap-x-6 gap-y-2 px-4 py-3 sm:px-8">
          <Link href="/" className="ig-heading shrink-0 no-underline">
            <Logo />
            <span className="ml-2">Intent&nbsp;Guard</span>
          </Link>
          <p className="ig-label hidden shrink-0 md:block">
            do these bytes do what that text said?
          </p>
          <nav className="order-3 flex w-full flex-wrap items-baseline gap-x-5 gap-y-1 md:order-none md:w-auto md:flex-1">
            {NAV.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`ig-label no-underline ${
                    active ? "ig-label-ink underline decoration-1 underline-offset-4" : ""
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRailOpen((open) => !open)}
              aria-expanded={railOpen}
              aria-controls="tx-rail"
              className="ig-label ig-label-ink border border-[var(--rule-strong)] px-3 py-2"
            >
              {railOpen ? "close ledger of writes" : "ledger of writes"}
            </button>
            <WalletPlate />
          </div>
        </div>

        {/* Provenance. Stated on every page, never buried. */}
        <div
          className={`border-t border-[var(--rule)] px-4 py-1.5 sm:px-8 ${
            provenance.mode === "live" ? "" : "ig-recto"
          }`}
        >
          <p className="ig-aside mx-auto max-w-[1400px]">
            <span className="ig-label mr-2">
              {provenance.mode === "live" ? `${CHAIN_NAME} · live` : "fixtures"}
            </span>
            {provenance.line}
          </p>
        </div>
      </header>

      {railOpen ? (
        <div id="tx-rail" className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-8">
          <TransactionRail onClose={() => setRailOpen(false)} />
        </div>
      ) : null}

      <main id="main" className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8">
        {children}
      </main>

      <footer className="ig-rule mx-auto mt-16 max-w-[1400px] px-4 py-8 sm:px-8">
        <p className="ig-aside max-w-[62ch]">
          Intent Guard raises objections. It never decides. A veto flag is a finding a timelock
          guard may honour and a fresh governance vote clears. See{" "}
          <Link href="/docs" className="underline decoration-1 underline-offset-4">
            the override rule
          </Link>
          .
        </p>
        <p className="ig-label mt-4">
          an intelligent contract on genlayer · {CHAIN_NAME}
        </p>
      </footer>
    </div>
  );
}
