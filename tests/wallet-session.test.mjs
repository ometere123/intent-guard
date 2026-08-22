import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DISCONNECTED,
  chainIdHex,
  networkLabel,
  networkVerdict,
  nextWalletState,
  parseChainId,
  writeGate,
} from "../src/lib/wallet-session.ts";

/**
 * The wallet is the one part of this app that changes underneath it. A person switches
 * account, revokes the site, switches network, or closes the wallet, and none of those
 * are announced by anything this page controls.
 *
 * Each test below is one of those events. What they all check is the same thing: after the
 * event, does the page still describe the situation accurately, and can a signature still
 * go out when it should not.
 */

const STUDIONET = 61999;
const MAINNET = 1;
const ADDRESS = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";

const connected = (chainId = STUDIONET) =>
  nextWalletState(DISCONNECTED, { type: "connected", address: ADDRESS, chainId });

/** A session opened by a provider that never answered `eth_chainId`. */
const connectedSilently = () =>
  nextWalletState(DISCONNECTED, { type: "connected", address: ADDRESS });

/* --- the five events a wallet can produce --------------------------------- */

test("account changed: the session follows the new account", () => {
  const after = nextWalletState(connected(), { type: "accounts-changed", accounts: [OTHER] });
  assert.equal(after.mode, "injected");
  assert.equal(after.address, OTHER);
  assert.equal(after.chainId, STUDIONET);
  assert.equal(after.error, undefined);
  // The new account can sign, because it is on the right chain and it is the account
  // the wallet would actually use.
  assert.equal(writeGate(after, STUDIONET, "studionet").canWrite, true);
});

test("account removed: the session closes and says why, and nothing can be signed", () => {
  const after = nextWalletState(connected(), { type: "accounts-changed", accounts: [] });
  assert.equal(after.mode, "none");
  assert.equal(after.address, undefined);
  assert.match(after.error, /no longer offers an account/);
  assert.equal(writeGate(after, STUDIONET, "studionet").canWrite, false);
});

test("chain changed: the label stops claiming this network, and writes stop", () => {
  const after = nextWalletState(connected(), { type: "chain-changed", chainId: "0x1" });
  // Still a session. The address on screen is still the address that would sign.
  assert.equal(after.mode, "injected");
  assert.equal(after.address, ADDRESS);
  assert.equal(after.chainId, MAINNET);

  const verdict = networkVerdict(after, STUDIONET);
  assert.deepEqual(verdict, { kind: "wrong", chainId: MAINNET });
  // The specific failure this guards against: printing "studionet" over a wallet on
  // Ethereum mainnet.
  const label = networkLabel(verdict, "studionet");
  assert.doesNotMatch(label, /studionet/);
  assert.match(label, /wrong network: chain 1/);

  const gate = writeGate(after, STUDIONET, "studionet");
  assert.equal(gate.canWrite, false);
  assert.match(gate.message, /on chain 1/);
  assert.match(gate.message, /Switch the wallet's network/);
});

test("chain changed back: the session recovers without reconnecting", () => {
  const wrong = nextWalletState(connected(), { type: "chain-changed", chainId: "0x1" });
  const right = nextWalletState(wrong, { type: "chain-changed", chainId: chainIdHex(STUDIONET) });
  assert.deepEqual(networkVerdict(right, STUDIONET), { kind: "expected" });
  assert.equal(networkLabel(networkVerdict(right, STUDIONET), "studionet"), "studionet");
  assert.equal(writeGate(right, STUDIONET, "studionet").canWrite, true);
});

test("provider disconnected: the session closes, carrying the provider's own words", () => {
  const after = nextWalletState(connected(), {
    type: "provider-disconnected",
    message: "The wallet was locked.",
  });
  assert.equal(after.mode, "none");
  assert.equal(after.address, undefined);
  assert.match(after.error, /The wallet was locked\./);
  assert.equal(writeGate(after, STUDIONET, "studionet").canWrite, false);

  // No message from the provider is still a closed session, just a plainer sentence.
  const bare = nextWalletState(connected(), { type: "provider-disconnected" });
  assert.equal(bare.mode, "none");
  assert.match(bare.error, /Reconnect to sign anything/);
});

test("wallet rejected the connection: no session, and it is not printed as a fault", () => {
  const after = nextWalletState(DISCONNECTED, {
    type: "connection-refused",
    message: "User rejected the request. (code 4001)",
  });
  assert.equal(after.mode, "none");
  assert.equal(after.address, undefined);
  assert.match(after.error, /declined the connection request/);
  assert.match(after.error, /Nothing was signed/);
});

test("a refusal that is not a rejection is passed through verbatim", () => {
  const after = nextWalletState(DISCONNECTED, {
    type: "connection-refused",
    message: "Already processing eth_requestAccounts.",
  });
  assert.equal(after.error, "Already processing eth_requestAccounts.");
});

/* --- an announcement is not consent -------------------------------------- */

test("events from a wallet with no session here are ignored", () => {
  // A provider may announce accounts or a chain at any time. Acting on that would make
  // a page connected without anyone agreeing to it.
  for (const event of [
    { type: "accounts-changed", accounts: [ADDRESS] },
    { type: "chain-changed", chainId: "0xf22f" },
    { type: "provider-disconnected", message: "x" },
  ]) {
    assert.deepEqual(nextWalletState(DISCONNECTED, event), DISCONNECTED, event.type);
  }
});

test("disconnecting here forgets everything, including the last error", () => {
  const errored = nextWalletState(connected(), { type: "accounts-changed", accounts: [] });
  assert.deepEqual(nextWalletState(errored, { type: "forget" }), DISCONNECTED);
});

/* --- failing closed on an unconfirmed network ---------------------------- */

test("a wallet that has not said which chain it is on cannot sign", () => {
  const silent = connectedSilently();
  assert.equal(silent.mode, "injected");
  assert.deepEqual(networkVerdict(silent, STUDIONET), { kind: "unknown" });
  assert.equal(networkLabel({ kind: "unknown" }, "studionet"), "network unconfirmed");
  const gate = writeGate(silent, STUDIONET, "studionet");
  assert.equal(gate.canWrite, false);
  assert.match(gate.message, /has not confirmed which network/);
});

test("no wallet at all is asked to connect, not asked to switch", () => {
  const gate = writeGate(DISCONNECTED, STUDIONET, "studionet");
  assert.equal(gate.canWrite, false);
  assert.match(gate.message, /Connect a wallet/);
});

test("chain ids arrive in several shapes, and garbage is not a chain", () => {
  assert.equal(parseChainId("0xf22f"), STUDIONET);
  assert.equal(parseChainId("61999"), STUDIONET);
  assert.equal(parseChainId(STUDIONET), STUDIONET);
  assert.equal(chainIdHex(STUDIONET), "0xf22f");
  for (const value of [undefined, null, "", "  ", "not a chain", 0, -1, 1.5, {}, []]) {
    assert.equal(parseChainId(value), undefined, JSON.stringify(value));
  }
});

/* --------------------------------------------------------------------------- *
 * Injected wallets are the only signer.
 *
 * Previous experimental builds stored a generated StudioNet key locally. Current versions
 * support injected wallets only. Legacy generated-wallet material is deleted on migration
 * and is never used. These scans hold the code to that, because the failure mode is a
 * convenience shortcut added later, not a bug in what exists now.
 * --------------------------------------------------------------------------- */

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("no private key is generated, stored or read anywhere in the app", () => {
  for (const path of [
    "../src/lib/storage.ts",
    "../src/lib/wallet-session.ts",
    "../src/components/wallet-provider.tsx",
    "../src/components/wallet-control.tsx",
    "../src/lib/genlayer/client.ts",
    "../src/lib/genlayer/read-client.ts",
  ]) {
    const text = source(path);
    for (const forbidden of [
      /generatePrivateKey/,
      /privateKeyToAccount/,
      /createRandom/,
      /mnemonic/i,
      /keystore/i,
      /setItem\([^)]*(private|secret|mnemonic|signer|wallet|LEGACY)/i,
    ]) {
      assert.doesNotMatch(text, forbidden, `${path} matched ${forbidden}`);
    }
  }
});

test("the only thing this app writes to localStorage is a list of transaction hashes", () => {
  const storage = source("../src/lib/storage.ts");
  const writes = storage.match(/localStorage\.setItem\([^,]+/g) ?? [];
  assert.deepEqual(writes, ["localStorage.setItem(TX_KEY"]);
});

test("the legacy key is only ever removed, never written or read", () => {
  const storage = source("../src/lib/storage.ts");
  assert.match(storage, /removeItem\(LEGACY_GENERATED_KEY\)/);
  assert.match(storage, /removeItem\(LEGACY_ACK_KEY\)/);
  assert.doesNotMatch(storage, /setItem\(LEGACY/);
  assert.doesNotMatch(storage, /getItem\(LEGACY/);
  assert.match(storage, /Legacy generated-wallet material is deleted on migration/);
});

test("the only account this app creates is the ephemeral read account", () => {
  // `createAccount()` satisfies genlayer-js's requirement that a client have an account
  // even for a view call. It never signs and is never persisted, and it exists in exactly
  // one file so that claim can be checked rather than trusted.
  const readClient = source("../src/lib/genlayer/read-client.ts");
  assert.match(readClient, /account: createAccount\(\)/);
  assert.doesNotMatch(readClient, /localStorage|sessionStorage/);
  assert.match(readClient, /never used to sign anything/);

  const provider = source("../src/components/wallet-provider.tsx");
  assert.doesNotMatch(provider, /createAccount/);
  assert.match(provider, /createInjectedClient/);
});

test("the provider follows all three wallet events and purges the legacy key", () => {
  const provider = source("../src/components/wallet-provider.tsx");
  for (const event of ["accountsChanged", "chainChanged", "disconnect"]) {
    assert.match(provider, new RegExp(`provider\\.on\\("${event}"`), `no listener for ${event}`);
    assert.match(
      provider,
      new RegExp(`removeListener\\?\\.\\("${event}"`),
      `${event} listener is never removed`,
    );
  }
  assert.match(provider, /purgeLegacyGeneratedKey\(\)/);
  // Never auto-connect: a page load is not consent to reveal an address.
  assert.doesNotMatch(provider, /eth_accounts/);
});

test("the masthead prints the wallet's network, not this build's", () => {
  const control = source("../src/components/wallet-control.tsx");
  assert.match(control, /wallet\.networkName/);
  assert.doesNotMatch(control, /CHAIN_NAME/);
  assert.match(control, /Connect wallet/);
  assert.match(control, /Disconnect wallet/);
});
