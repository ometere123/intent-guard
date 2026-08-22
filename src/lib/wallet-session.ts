/**
 * The wallet session, as a value rather than as a scatter of `useState` calls.
 *
 * Everything a wallet can do to a session while it is open happens here: the person
 * switches account, removes the account, switches network, or the provider drops the
 * connection entirely. None of those are exceptional, and all of them change whether a
 * write may be signed, so they are handled as one transition function that tests can
 * drive without a browser.
 *
 * Two rules the reducer keeps that the old inline handlers did not:
 *
 * 1. An event from a wallet this app is not connected to is ignored. A provider may
 *    announce accounts at any time; a page that has not been given consent must not
 *    become connected because of an announcement.
 * 2. The chain the wallet reports is carried in the session, and the write gate reads it.
 *    The masthead therefore cannot print this build's network name while the wallet is
 *    somewhere else, which is the specific way a UI lies about where a signature is going.
 *
 * There is only ever one signer: an injected wallet. No key is generated, stored or read
 * anywhere in this app.
 */

export type WalletMode = "none" | "injected";

export type WalletState = {
  mode: WalletMode;
  address?: `0x${string}`;
  /** The chain the wallet says it is on. Undefined until it has said. */
  chainId?: number;
  /** Something the person needs to be told. Cleared by anything that resolves it. */
  error?: string;
};

export const DISCONNECTED: WalletState = { mode: "none" };

export type WalletEvent =
  /** `eth_requestAccounts` returned. The only way into a session. */
  | { type: "connected"; address: string; chainId?: unknown }
  /** The wallet emitted `accountsChanged`. An empty list means the site was cut off. */
  | { type: "accounts-changed"; accounts: unknown }
  /** The wallet emitted `chainChanged`. */
  | { type: "chain-changed"; chainId: unknown }
  /** The wallet emitted `disconnect`. */
  | { type: "provider-disconnected"; message?: string }
  /** The connection request came back refused. */
  | { type: "connection-refused"; message: string }
  /** This tab chose to forget the session. */
  | { type: "forget" };

export function nextWalletState(current: WalletState, event: WalletEvent): WalletState {
  switch (event.type) {
    case "connected":
      return {
        mode: "injected",
        address: event.address as `0x${string}`,
        chainId: parseChainId(event.chainId),
      };

    case "accounts-changed": {
      // Not connected: an announcement is not consent.
      if (current.mode !== "injected") return current;
      const next = Array.isArray(event.accounts) ? event.accounts[0] : undefined;
      if (typeof next !== "string" || !next) {
        return {
          mode: "none",
          error:
            "The wallet no longer offers an account to this site, so nothing can be signed. Reconnect when you want to.",
        };
      }
      return { ...current, address: next as `0x${string}`, error: undefined };
    }

    case "chain-changed": {
      if (current.mode !== "injected") return current;
      // The gate decides what a different chain means. Recording it is not judging it.
      return { ...current, chainId: parseChainId(event.chainId), error: undefined };
    }

    case "provider-disconnected":
      if (current.mode !== "injected") return current;
      return {
        mode: "none",
        error: event.message?.trim()
          ? `The wallet disconnected: ${event.message.trim()}`
          : "The wallet disconnected. Reconnect to sign anything.",
      };

    case "connection-refused":
      return { mode: "none", error: refusalMessage(event.message) };

    case "forget":
      return DISCONNECTED;
  }
}

/** A wallet's chain id, which arrives as `"0xf22f"` from events and as a number from some providers. */
export function parseChainId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = trimmed.startsWith("0x") ? Number.parseInt(trimmed, 16) : Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export const chainIdHex = (id: number) => `0x${id.toString(16)}`;

/** A declined request is not a fault, so it is not printed as one. */
function refusalMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("4001") || lower.includes("user rejected") || lower.includes("user denied")) {
    return "The wallet declined the connection request. Nothing was signed.";
  }
  return message.trim() || "The wallet request was refused.";
}

/* ------------------------------------------------------------------------- *
 * Which network the wallet is on
 * ------------------------------------------------------------------------- */

export type NetworkVerdict =
  /** No session, or the wallet has not said which chain it is on. */
  | { kind: "unknown" }
  /** On the chain this build reads and writes. */
  | { kind: "expected" }
  /** Somewhere else. Reads still come from this build's RPC; writes must not go out. */
  | { kind: "wrong"; chainId: number };

export function networkVerdict(state: WalletState, expectedChainId: number): NetworkVerdict {
  if (state.mode !== "injected") return { kind: "unknown" };
  if (state.chainId === undefined) return { kind: "unknown" };
  return state.chainId === expectedChainId ? { kind: "expected" } : { kind: "wrong", chainId: state.chainId };
}

/**
 * What the masthead prints beside the address.
 *
 * `expectedName` is only ever returned for a verdict of `expected`. A wallet on some
 * other chain gets that chain's number and nothing reassuring, because the failure this
 * guards against is a page that says StudioNet while the wallet is on Ethereum mainnet.
 */
export function networkLabel(verdict: NetworkVerdict, expectedName: string): string {
  if (verdict.kind === "expected") return expectedName;
  if (verdict.kind === "wrong") return `wrong network: chain ${verdict.chainId}`;
  return "network unconfirmed";
}

/**
 * Whether a write may be signed.
 *
 * Unknown fails closed. A wallet that has not told us its chain might be anywhere, and a
 * transaction sent to the wrong chain is either lost or, worse, a real transaction
 * somewhere the person did not intend.
 */
export function writeGate(
  state: WalletState,
  expectedChainId: number,
  expectedName: string,
): { canWrite: boolean; message?: string } {
  if (state.mode !== "injected" || !state.address) {
    return { canWrite: false, message: "Connect a wallet before sending a transaction." };
  }
  const verdict = networkVerdict(state, expectedChainId);
  if (verdict.kind === "expected") return { canWrite: true };
  if (verdict.kind === "wrong") {
    return {
      canWrite: false,
      message: `The wallet is on chain ${verdict.chainId}, and this build writes to ${expectedName} (chain ${expectedChainId}). Switch the wallet's network to sign anything here.`,
    };
  }
  return {
    canWrite: false,
    message: `The wallet has not confirmed which network it is on, so this write is held back rather than sent to the wrong chain. Expected ${expectedName} (chain ${expectedChainId}).`,
  };
}
