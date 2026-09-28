import { expect, test } from "@playwright/test";
import { AUTH_FILE, appUrl, PATHS } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Settings → Company Information and My Account: existing data renders, an
 * edit saves, survives a full reload, and is then reverted so the shared
 * account is left as found. Each edit is confined to a benign field.
 */
test.describe("Settings - Company Information + My Account persistence @crud", () => {
  test.use({ storageState: AUTH_FILE });

  test("Company Information: Address Line 2 edit persists across reload", async ({
    page,
  }) => {
    const url = appUrl("/app/settings/companyinformation");
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await dismissPaymentReminderIfPresent(page);

    // Existing company data is present.
    await expect(page.locator('input[name="advertiserId"]')).toHaveValue(/^\d+$/, {
      timeout: 30_000,
    });
    await expect(page.locator('input[name="companyName"]')).not.toHaveValue("");
    await expect(page.locator('input[name="websiteURL"]')).toHaveValue(/^https?:\/\//);
    await expect(page.locator('input[name="country"]')).not.toHaveValue("");

    const field = page.locator('input[name="address2"]');
    const original = await field.inputValue();
    const testValue = `QA persist ${Date.now().toString().slice(-5)}`;
    try {
      await field.fill(testValue);
      await page.getByRole("button", { name: /^Save$/i }).click();
      await expect(page.getByRole("alert")).toContainText(/updated/i, {
        timeout: 30_000,
      });

      await page.reload({ waitUntil: "domcontentloaded" });
      await dismissPaymentReminderIfPresent(page);
      await expect(page.locator('input[name="address2"]')).toHaveValue(testValue, {
        timeout: 30_000,
      });
    } finally {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await dismissPaymentReminderIfPresent(page);
      await page.locator('input[name="address2"]').fill(original);
      await page.getByRole("button", { name: /^Save$/i }).click();
      await page.waitForTimeout(2_000);
    }
  });

  test("My Account: account info renders and a Last Name edit persists across reload", async ({
    page,
  }) => {
    const url = appUrl(PATHS.myAccount);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await dismissPaymentReminderIfPresent(page);

    await expect(page.locator('input[name="role"]')).not.toHaveValue("", {
      timeout: 30_000,
    });
    await expect(page.locator('input[name="emailAddress"]')).toHaveValue(/@/);
    await expect(page.locator('input[name="firstName"]')).not.toHaveValue("");

    const field = page.locator('input[name="lastName"]');
    const original = await field.inputValue();
    const testValue = `${original}X`;
    try {
      await field.fill(testValue);
      await page.getByRole("button", { name: /Save Changes/i }).click();
      // The page carries a permanent "Remember to use your new email…" info
      // alert, so match the save toast by its text rather than by role alone.
      await expect(
        page.getByRole("alert").filter({ hasText: /saved|updated/i }),
      ).toBeVisible({ timeout: 30_000 });

      await page.reload({ waitUntil: "domcontentloaded" });
      await dismissPaymentReminderIfPresent(page);
      await expect(page.locator('input[name="lastName"]')).toHaveValue(testValue, {
        timeout: 30_000,
      });
    } finally {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await dismissPaymentReminderIfPresent(page);
      await page.locator('input[name="lastName"]').fill(original);
      await page.getByRole("button", { name: /Save Changes/i }).click();
      await page.waitForTimeout(2_000);
    }
  });
});
