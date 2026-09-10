import { expect, test } from "@playwright/test";
import { AUTH_FILE, appUrl } from "../../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../../utility/appActions";

/**
 * TICKET #742 — Click ID Lookup > Edit Text
 * Page: /app/reports/clickidlookup (renamed from /app/reports/clicksidlookup)
 *
 * Requirement (from the ticket):
 *   1. Rename the path "clicksidlookup" -> "clickidlookup"; update nav links;
 *      redirect the old path to the new one.
 *   2. In the page description, change "FuseTwo.com" -> "FuseTwo".
 *   3. Edit the Click ID field instruction text.
 *
 * Asserts the FIXED behaviour, so it fails until the fix ships.
 */
test.describe("@ticket-742 Click ID Lookup rename and text", () => {
  test.use({ storageState: AUTH_FILE });

  test("the new /clickidlookup path loads the report @ticket-742", async ({
    page,
  }) => {
    const response = await page.goto(appUrl("/app/reports/clickidlookup"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);

    expect(
      response?.status(),
      "new path did not return a document",
    ).toBeLessThan(400);
    await expect(
      page,
      "new /clickidlookup path did not load (still renamed?)",
    ).toHaveURL(/clickidlookup/);
    await expect(page).not.toHaveURL(/\/signin/i);
  });

  test("the old /clicksidlookup path redirects to the new one @ticket-742", async ({
    page,
  }) => {
    await page.goto(appUrl("/app/reports/clicksidlookup"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
    await page.waitForTimeout(3_000);

    // The old path should not remain; it should land on the new clickidlookup.
    await expect(
      page,
      "the old clicksidlookup path was not redirected",
    ).toHaveURL(/clickidlookup/);
  });

  test('the page description says "FuseTwo", not "FuseTwo.com" @ticket-742', async ({
    page,
  }) => {
    await page.goto(appUrl("/app/reports/clickidlookup"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
    await expect(page).not.toHaveURL(/\/signin/i);

    const bodyText = await page.locator("body").innerText();
    expect(
      /FuseTwo\.com/.test(bodyText),
      'the page still shows "FuseTwo.com" (ticket #742 not fixed)',
    ).toBe(false);
  });
});
