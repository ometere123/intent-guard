"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createInjectedClient } from "@/lib/genlayer/client";
import { purgeLegacyGeneratedKey } from "@/lib/storage";

export type WalletMode = "none" | "injected";

type WalletContextValue = {
  mode: WalletMode;
  address?: `0x${string}`;
  hasInjected: boolean;
  connecting: boolean;
  error?: string;
  connectInjected: () => Promise<void>;
  disconnect: () => void;
  getWriteClient: () => Promise<Awaited<ReturnType<typeof createInjectedClient>>>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<WalletMode>("none");
  const [address, setAddress] = useState<`0x${string}` | undefined>(undefined);
  const [hasInjected, setHasInjected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Detect the provider without touching it. Never auto-connect: a page load is
  // not consent to reveal an address. Also delete any key left in localStorage by
  // the generated-wallet build this replaced — removing the feature is not a
  // reason to leave a private key sitting in someone's browser.
  useEffect(() => {
    queueMicrotask(() => {
      setHasInjected(Boolean(window.ethereum));
      purgeLegacyGeneratedKey();
    });
  }, []);

  // Follow the wallet once a session is open. Without this the plate would keep
  // showing an address the person has already switched away from or revoked,
  // and the next write would fail for a reason the UI never stated.
  useEffect(() => {
    const provider = typeof window !== "undefined" ? window.ethereum : undefined;
    if (mode !== "injected" || !provider?.on) return;
    const onAccountsChanged = (...args: unknown[]) => {
      const next = (args[0] as string[] | undefined)?.[0];
      if (!next) {
        setMode("none");
        setAddress(undefined);
        return;
      }
      setAddress(next as `0x${string}`);
    };
    provider.on("accountsChanged", onAccountsChanged);
    return () => provider.removeListener?.("accountsChanged", onAccountsChanged);
  }, [mode]);

  const connectInjected = useCallback(async () => {
    setError(undefined);
    const provider = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!provider) {
      setError("No injected wallet was found in this browser.");
      return;
    }
    setConnecting(true);
    // A provider found here proves one exists even if none did at mount, so the
    // gate copy cannot keep claiming there is nothing to sign with.
    setHasInjected(true);
    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as `0x${string}`[];
      const next = accounts?.[0];
      if (!next) {
        setError("The wallet returned no account.");
        return;
      }
      setAddress(next);
      setMode("injected");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The wallet request was rejected.");
    } finally {
      setConnecting(false);
    }
  }, []);

  // Forgets the session in this tab. A wallet cannot be made to revoke a site
  // from here, so the copy says disconnect and means exactly this much.
  const disconnect = useCallback(() => {
    setMode("none");
    setAddress(undefined);
    setError(undefined);
  }, []);

  const getWriteClient = useCallback(async () => {
    if (mode === "injected" && address) return createInjectedClient(address);
    throw new Error("Connect a wallet before sending a transaction.");
  }, [address, mode]);

  const value = useMemo(
    () => ({
      mode,
      address,
      hasInjected,
      connecting,
      error,
      connectInjected,
      disconnect,
      getWriteClient,
    }),
    [address, connecting, connectInjected, disconnect, error, getWriteClient, hasInjected, mode],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}
