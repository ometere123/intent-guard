import { expect, test, type Page } from "@playwright/test";
import { addressIn, expectedContract, expectedNetwork } from "./deployment";

/**
 * The deployed site, read the way a reviewer would read it.
 *
 * Every assertion here is about something that can only be wrong in production:
 * whether the origin serves live contract state or bundled fixtures, whether it is
 * pointed at the contract this commit claims, and whether a record that exists on
 * StudioNet actually renders. A local build proves none of those.
 *
 * These tests only read. No wallet is installed in this file, so there is no signing
 * path to stumble into; the wallet gates are exercised in `wallet.spec.ts`.
 */

/** The provenance strip the shell prints on every route. */
const PROVENANCE = /Reading the Intent Guard contract at 0x[0-9a-fA-F]{40}\./;

const ROUTES = ["/", "/docs", "/guard", "/reviews", "/reviews/new"];

/**
 * A ledger row. The whole row is one link, so its accessible name is the entire
 * record and cannot be matched by id; the href is the stable handle.
 */
const LEDGER_ROW = 'ol a[href^="/reviews/"]';

/** Opens the first record on the ledger and returns the id it was filed under. */
async function openFirstRecord(page: Page): Promise<string> {
  await page.goto("/reviews");
  const row = page.locator(LEDGER_ROW).first();
  const href = await row.getAttribute("href");
  expect(href, "a record should be linked from the ledger").toBeTruthy();
  const id = (href as string).split("/").pop() as string;

  await row.click();
  await expect(page).toHaveURL(new RegExp(`/reviews/${id}$`));
  await expect(page.getByRole("heading", { name: "The record" })).toBeVisible();
  return id;
}

test.describe("every route serves live contract state", () => {
  for (const path of ROUTES) {
    test(`${path} loads in live mode against the deployed contract`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should be served`).toBe(200);

      // Live, not fixtures. The shell prints one word or the other and never both.
      await expect(page.getByText(`${expectedNetwork} · live`).first()).toBeVisible();
      await expect(page.getByText("fixtures", { exact: true })).toHaveCount(0);

      // And pointed at this commit's contract, compared as bytes rather than as
      // whatever casing the deployment's environment happens to hold.
      const line = await page.getByText(PROVENANCE).first().textContent();
      expect(addressIn(line), `${path} should print ${expectedContract}`).toBe(expectedContract);
    });
  }
});

test("the frontispiece states the question the contract answers", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Do these bytes do what that text said?" }),
  ).toBeVisible();
});

test("the documentation covers the refusals, not only the findings", async ({ page }) => {
  await page.goto("/docs");
  await expect(
    page.getByRole("heading", { name: /How Intent Guard reaches, and refuses, a finding/ }),
  ).toBeVisible();
});

test.describe("the ledger", () => {
  test("counts and records come from the contract", async ({ page }) => {
    await page.goto("/reviews");
    await expect(
      page.getByRole("heading", { name: /Every review, including the refusals/ }),
    ).toBeVisible();

    // The failure copy, if the live read broke, is explicit. Its absence is the assertion.
    await expect(page.getByText("Live records could not be retrieved")).toHaveCount(0);

    // The tallies are contract state, and the counts block only renders when both
    // `listReviews()` and `ledgerCounts()` came back.
    const labels = await page.locator("dl").first().locator("dt").allInnerTexts();
    expect(labels).toContain("records");
    expect(labels).toContain("vetoes standing");

    expect(await page.locator(LEDGER_ROW).count()).toBeGreaterThan(0);
  });

  test("every row states its veto standing in words", async ({ page }) => {
    // `is_vetoed` is the integration surface; the ledger is where a person reads the
    // same fact. A row that printed neither phrase would be a row nobody can act on.
    await page.goto("/reviews");
    const rows = page.locator(LEDGER_ROW);
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const text = await rows.nth(index).innerText();
      expect(text, `row ${index} should state its veto standing`).toMatch(
        /veto standing|veto cleared|no veto/,
      );
    }
  });

  test("a StudioNet review renders its full record", async ({ page }) => {
    await openFirstRecord(page);

    // These are contract fields. Their presence is what proves a stored review was
    // read and decoded rather than a placeholder rendered.
    const labels = await page.locator("dt").allInnerTexts();
    for (const field of [
      "governor",
      "proposal id",
      "creation block",
      "requester",
      "bond",
      "action count",
      "mandate digest",
      "actions digest",
    ]) {
      expect(labels, `the record should print ${field}`).toContain(field);
    }

    // A verdict word, and a veto line that agrees with it. Which verdict it is is
    // chain state; asserting a particular one would be asserting a result.
    await expect(
      page.getByText(/^(Aligned|Divergent|Underspecified|Undecodable|Pending)$/).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/^(veto flag set|veto flag not set|veto cleared|no veto)$/).first(),
    ).toBeVisible();

    // The digests are 32-byte hex, not "not recorded".
    const record = await page.locator("dl").last().innerText();
    expect(record).toMatch(/0x[0-9a-f]{64}/i);
  });

  test("a GEN amount prints its unit exactly once", async ({ page }) => {
    // A regression guard for a defect that reached production: `formatGen` already
    // carries " GEN", six call sites appended a second one, and the deployed ledger
    // read "0.001 GEN GEN". React splits adjacent text nodes with comments, so this
    // is checked against rendered text rather than against HTML source.
    await openFirstRecord(page);
    for (const path of [page.url(), "/reviews", "/"]) {
      await page.goto(path);
      const text = await page.locator("body").innerText();
      expect(text, `${path} should not print the unit twice`).not.toMatch(/GEN\s+GEN/);
    }
  });
});

test.describe("the guard endpoint", () => {
  test("is_vetoed answers for a governor and proposal taken from a real record", async ({ page }) => {
    // Read a real (governor, proposal id) pair off a stored review first, so the
    // question asked is one the contract has an answer to.
    const id = await openFirstRecord(page);

    const fields = page.locator("dl").last().locator("dd");
    const governor = addressIn(await fields.nth(0).innerText());
    const proposalId = (await fields.nth(1).innerText()).trim();
    expect(governor, "a governor address should be readable from the record").toBeTruthy();
    expect(proposalId, "a proposal id should be readable from the record").toMatch(/^\d+$/);

    await page.goto("/guard");
    await page.getByLabel("governor address").fill(governor as string);
    await page.getByLabel("proposal id").fill(proposalId);
    await page.getByRole("button", { name: "read is_vetoed" }).click();

    // Either real answer for a reviewed proposal is a pass. Which one it is depends on
    // chain state, and the record's own verdict decides it.
    await expect(page.getByText(/Veto standing|Reviewed, no veto standing/)).toBeVisible();
    await expect(page.getByText("Read unavailable")).toHaveCount(0);
    await expect(page.getByText("No record / not reviewed")).toHaveCount(0);

    // The read returned the review itself, not merely a boolean, and it is the record
    // the pair was taken from.
    const link = page.getByRole("link", { name: /open the review/ });
    await expect(link).toBeVisible();
    expect(await link.getAttribute("href")).toBe(`/reviews/${id}`);
  });

  test("an unreviewed proposal is reported as no record rather than as cleared", async ({ page }) => {
    await page.goto("/guard");
    await page.getByLabel("governor address").fill("0x0000000000000000000000000000000000000001");
    await page.getByLabel("proposal id").fill("999999999999");
    await page.getByRole("button", { name: "read is_vetoed" }).click();
    await expect(page.getByText("No record / not reviewed")).toBeVisible();
    // The distinction the copy exists to preserve: unreviewed is not cleared.
    await expect(page.getByText("Reviewed, no veto standing")).toHaveCount(0);
  });
});

test.describe("the request form's bond floor", () => {
  test("the minimum is read from the contract, not written into the page", async ({ page }) => {
    await page.goto("/reviews/new");

    // "reading it from the contract" means the read is still in flight; "could not be
    // read" means it failed. Either would fail this assertion, which is the point.
    await expect(page.getByText(/^Minimum bond:/)).toHaveText("Minimum bond: 0.001 GEN");
  });

  test("the field opens at the contract's floor, not at a round number", async ({ page }) => {
    await page.goto("/reviews/new");
    await expect(page.getByText(/^Minimum bond:/)).toHaveText("Minimum bond: 0.001 GEN");
    // Derived from the contract's figure once `stats()` answers, so this value is the
    // floor rather than a literal that happens to agree with it today.
    await expect(page.getByLabel(/bond, in GEN/)).toHaveValue("0.001");
  });
});
