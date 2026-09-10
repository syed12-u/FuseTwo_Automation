import { expect, test } from "@playwright/test";
import { AUTH_FILE, appUrl } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Settings — My Account save (a reversible phone-number round-trip) and the
 * Advertiser Setup sub-tabs.
 *
 * The My Account write changes a benign field (phone) and restores the original
 * value in a finally block, so the shared test account is left unchanged.
 */
test.describe("Settings - My Account + Advertiser Setup", () => {
  test.use({ storageState: AUTH_FILE });

  test("My Account: Save Changes persists a phone-number edit @crud", async ({
    page,
  }) => {
    await page.goto(appUrl("/app/settings/myaccount"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);

    const phone = page.locator('input[name="phone"]');
    await expect(phone).toBeVisible({ timeout: 30_000 });
    const original = await phone.inputValue();
    const testValue = "6175550199";

    try {
      await phone.fill(testValue);
      await page.getByRole("button", { name: /Save Changes/i }).click();
      await page.waitForTimeout(3_000);
      await expect(page.locator("body")).not.toContainText(
        /Internal Server Error|Application error|Oops! Something went wrong/i,
      );

      // Reload and confirm the new value persisted.
      await page.reload({ waitUntil: "domcontentloaded" });
      await dismissPaymentReminderIfPresent(page);
      await expect(page.locator('input[name="phone"]')).toHaveValue(testValue, {
        timeout: 30_000,
      });
    } finally {
      // Restore the original phone number so the shared account is unchanged.
      await page.goto(appUrl("/app/settings/myaccount"), {
        waitUntil: "domcontentloaded",
      });
      await dismissPaymentReminderIfPresent(page);
      await page.locator('input[name="phone"]').fill(original);
      await page.getByRole("button", { name: /Save Changes/i }).click();
      await page.waitForTimeout(2_000);
    }
  });

  test("Advertiser Setup: all 5 sub-tabs open without error @smoke", async ({
    page,
  }) => {
    await page.goto(appUrl("/app/settings/advertisersetup"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);

    for (const tab of [
      "GENERAL",
      "PROGRAM DEFAULTS",
      "ADVANCED COMMISSIONS",
      "PUBLISHER APPROVAL CRITERIA",
      "SEARCH KEYWORDS",
    ]) {
      const t = page.getByRole("tab", { name: new RegExp(tab, "i") });
      await t.click();
      await expect(t).toHaveAttribute("aria-selected", "true", {
        timeout: 15_000,
      });
      await expect(page.locator("body")).not.toContainText(
        /Internal Server Error|502 Bad Gateway|Application error/i,
      );
    }
  });
});
