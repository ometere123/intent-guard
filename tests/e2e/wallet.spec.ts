import { expect, test, type Page } from "@playwright/test";
import {
  emitWalletEvent,
  installWalletStub,
  STUB_ACCOUNT,
  STUDIONET_CHAIN_HEX,
  WRONG_CHAIN_HEX,
} from "./wallet-stub";

/**
 * What the deployed site does when a wallet behaves like a wallet.
 *
 * A person switches account, revokes the site, switches network, or the extension
 * drops the connection, and each of those changes whether a signature may be
 * requested. These tests drive all five states against production and read what the
 * masthead then says, because the failure worth catching is a page that still says
 * StudioNet while the wallet is somewhere else.
 *
 * Nothing here signs anything. The stub implements four read methods and throws
 * `-32601` on everything else, so the suite is free to run as often as anyone likes.
 */

const SECOND_ACCOUNT = "0x1111111111111111111111111111111111111111";

/** As the masthead abbreviates them, mirroring `shortenHex`'s defaults. */
const shorten = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const STUB_SHORT = shorten(STUB_ACCOUNT);
const SECOND_SHORT = shorten(SECOND_ACCOUNT);

async function connect(page: Page, path = "/reviews/new") {
  await page.goto(path);
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.getByRole("button", { name: "Disconnect wallet" })).toBeVisible();
}

/**
 * The masthead's own alert, and only it. Next.js mounts a permanently empty
 * `role="alert"` route announcer on every page, so a bare `getByRole("alert")`
 * matches two elements: it fails strict mode where a message is expected, and
 * never reaches zero where absence is expected.
 */
const walletAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

/**
 * A request that is valid in every respect except the one under test, so the refusal
 * that comes back is the refusal the test is about.
 */
async function fillValidRequest(page: Page, bond: string) {
  await expect(page.getByText(/^Minimum bond:/)).toHaveText("Minimum bond: 0.001 GEN");
  await page.getByLabel(/review id/).fill("IG-E2E-GATE");
  await page.getByLabel(/proposal id/).fill("100");
  await page.getByLabel(/creation block/).fill("20000000");
  await page.getByLabel(/bond, in GEN/).fill(bond);
  await page.getByRole("button", { name: "request the review" }).click();
}

/** The refusal panel's verbatim message, which the page keeps behind a disclosure. */
async function exactRefusal(page: Page): Promise<string> {
  const panel = page.getByRole("status");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("[EXPECTED]")).toBeVisible();
  await expect(panel.getByText("Refused before anything was spent.")).toBeVisible();
  await expect(panel.getByText("No consensus ran. No bond moved.")).toBeVisible();
  await panel.getByText("the exact message").click();
  return (await panel.innerText()).trim();
}

test.describe("with no wallet extension at all", () => {
  test("the masthead offers to connect and nothing can be signed", async ({ page }) => {
    await page.goto("/reviews/new");
    await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Disconnect wallet" })).toHaveCount(0);

    // The gate fires before any field is judged, and it says the true thing: there is
    // no extension here, so "connect one first" would be advice nobody can follow.
    await fillValidRequest(page, "0.001");
    expect(await exactRefusal(page)).toContain(
      "No wallet extension was detected in this browser, so there is nothing to sign with.",
    );
  });
});

test.describe("a wallet on StudioNet", () => {
  test.beforeEach(async ({ page }) => {
    await installWalletStub(page, { chainId: STUDIONET_CHAIN_HEX });
  });

  test("connecting shows the network it is really on, and the account", async ({ page }) => {
    await connect(page);
    await expect(page.getByText("studionet", { exact: true })).toBeVisible();
    await expect(page.getByText(STUB_SHORT)).toBeVisible();
    // Writes are open, so there is nothing to warn about.
    await expect(walletAlert(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Switch network" })).toHaveCount(0);
  });

  test("a bond under the contract's minimum is refused in the browser", async ({ page }) => {
    // Reachable only with a wallet connected on the expected chain: `preflight` checks
    // the wallet gate first, so this is where the bond floor can actually be tested.
    await connect(page);
    await fillValidRequest(page, "0.0001");
    const refusal = await exactRefusal(page);
    expect(refusal).toContain("The contract requires at least 0.001 GEN");
    expect(refusal).toContain("would refuse 0.0001 GEN");
    expect(refusal).toContain("That minimum is read from the contract, not set by this page.");
  });

  test("a bond at the minimum passes the browser's checks", async ({ page }) => {
    await connect(page);
    await fillValidRequest(page, "0.001");

    // The lifecycle only renders once a run has started, so this is the point at which
    // preflight has already returned its verdict.
    await expect(page.getByText("validating").first()).toBeVisible();

    // And that verdict was not about the bond: 0.001 is exactly the contract's floor,
    // and the floor is inclusive. Past here the runner asks the wallet to sign, and the
    // stub refuses to implement a signing method, which is how this suite stays free.
    await expect(page.getByText("The contract requires at least")).toHaveCount(0);
  });

  test("switching account changes who would sign", async ({ page }) => {
    await connect(page);
    await expect(page.getByText(STUB_SHORT)).toBeVisible();

    await emitWalletEvent(page, "accountsChanged", [SECOND_ACCOUNT]);
    await expect(page.getByText(SECOND_SHORT)).toBeVisible();
    await expect(page.getByText(STUB_SHORT)).toHaveCount(0);
    // Still the same network, so still signable.
    await expect(page.getByText("studionet", { exact: true })).toBeVisible();
  });

  test("removing the account ends the session and says so", async ({ page }) => {
    await connect(page);
    await emitWalletEvent(page, "accountsChanged", []);

    await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
    await expect(page.getByText(STUB_SHORT)).toHaveCount(0);
    await expect(walletAlert(page)).toHaveText(
      "The wallet no longer offers an account to this site, so nothing can be signed. Reconnect when you want to.",
    );
  });

  test("the provider disconnecting does not leave a stale session looking live", async ({ page }) => {
    await connect(page);
    await emitWalletEvent(page, "disconnect", { message: "the extension was locked" });

    await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
    await expect(walletAlert(page)).toHaveText(
      "The wallet disconnected: the extension was locked",
    );
  });

  test("disconnecting from the masthead forgets the session", async ({ page }) => {
    await connect(page);
    await page.getByRole("button", { name: "Disconnect wallet" }).click();
    await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
    await expect(page.getByText(STUB_SHORT)).toHaveCount(0);
  });
});

test.describe("a wallet that moves off StudioNet mid-session", () => {
  test("the masthead names the chain the wallet is on, and holds writes back", async ({ page }) => {
    await installWalletStub(page, {
      chainId: STUDIONET_CHAIN_HEX,
      switchOutcome: "accept",
    });
    await connect(page);
    await expect(page.getByText("studionet", { exact: true })).toBeVisible();

    await emitWalletEvent(page, "chainChanged", WRONG_CHAIN_HEX);

    // Never this build's network name while the wallet is elsewhere.
    await expect(page.getByText("wrong network: chain 1")).toBeVisible();
    await expect(page.getByText("studionet", { exact: true })).toHaveCount(0);
    await expect(walletAlert(page)).toHaveText(
      "The wallet is on chain 1, and this build writes to studionet (chain 61999). Switch the wallet's network to sign anything here.",
    );

    // And the write is refused rather than sent to the wrong chain.
    await fillValidRequest(page, "0.001");
    expect(await exactRefusal(page)).toContain("The wallet is on chain 1");
  });

  test("switching back reopens writes", async ({ page }) => {
    await installWalletStub(page, {
      chainId: STUDIONET_CHAIN_HEX,
      switchOutcome: "accept",
    });
    await connect(page);
    await emitWalletEvent(page, "chainChanged", WRONG_CHAIN_HEX);
    await expect(page.getByRole("button", { name: "Switch network" })).toBeVisible();

    await page.getByRole("button", { name: "Switch network" }).click();
    await expect(page.getByText("studionet", { exact: true })).toBeVisible();
    await expect(walletAlert(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Switch network" })).toHaveCount(0);
  });
});

test.describe("a wallet on the wrong chain at connect time", () => {
  test("a refused network switch is reported, and writes stay shut", async ({ page }) => {
    // The common real case: the wallet has never had StudioNet added, so it answers
    // `wallet_switchEthereumChain` with 4902 rather than moving.
    await installWalletStub(page, { chainId: WRONG_CHAIN_HEX, switchOutcome: "reject" });
    await connect(page);

    await expect(page.getByText("wrong network: chain 1")).toBeVisible();
    await expect(page.getByText("studionet", { exact: true })).toHaveCount(0);
    await expect(walletAlert(page)).toContainText(
      "This wallet would not switch to studionet (chain 61999)",
    );
    await expect(walletAlert(page)).toContainText(
      "Add the network in the wallet itself, then reconnect.",
    );
  });
});

test.describe("a wallet that refuses", () => {
  test("a declined connection is reported as a decision, not as a fault", async ({ page }) => {
    await installWalletStub(page, { rejectConnection: true });
    await page.goto("/reviews/new");
    await page.getByRole("button", { name: "Connect wallet" }).click();

    await expect(walletAlert(page)).toHaveText(
      "The wallet declined the connection request. Nothing was signed.",
    );
    await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Disconnect wallet" })).toHaveCount(0);
  });

  test("a wallet that offers no account is not treated as connected", async ({ page }) => {
    await installWalletStub(page, { returnNoAccounts: true });
    await page.goto("/reviews/new");
    await page.getByRole("button", { name: "Connect wallet" }).click();

    await expect(walletAlert(page)).toHaveText("The wallet returned no account.");
    await expect(page.getByRole("button", { name: "Disconnect wallet" })).toHaveCount(0);
  });
});

test("no generated wallet is created or stored, on any route", async ({ page }) => {
  // The architectural guarantee, checked where it can actually be observed: an
  // injected wallet is the only signer, so a page load must leave no key material
  // behind and must not connect anything by itself.
  await installWalletStub(page, { chainId: STUDIONET_CHAIN_HEX });
  for (const path of ["/", "/reviews", "/reviews/new", "/guard"]) {
    await page.goto(path);
    // Not connected until asked. A page load is not consent to reveal an address.
    await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
    await expect(page.getByText(STUB_SHORT)).toHaveCount(0);

    const stored = await page.evaluate(() => ({
      local: Object.entries({ ...localStorage }),
      session: Object.entries({ ...sessionStorage }),
    }));
    for (const [key, value] of [...stored.local, ...stored.session]) {
      expect(`${key} ${value}`, `${path} stored something key-shaped`).not.toMatch(
        /0x[0-9a-fA-F]{64}|privateKey|mnemonic|keystore/i,
      );
    }
  }
});
