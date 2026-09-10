import { expect, test } from "@playwright/test";
import { AUTH_FILE, appUrl, PATHS } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Publishers — the row actions on the Publisher List.
 *
 * Change Status and Manage Groups are exercised up to (but not through) the
 * commit: selecting a publisher enables the action, the dialog opens with its
 * fields, and it is closed WITHOUT committing — actually changing a publisher's
 * status or groups mutates a real publisher relationship, so it is validated,
 * not committed.
 */
test.describe("Publishers - list actions", () => {
  test.use({ storageState: AUTH_FILE });

  test.beforeEach(async ({ page }) => {
    await page.goto(appUrl(PATHS.publisherList), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
  });

  test("selecting a publisher enables Change Status and opens its dialog @crud", async ({
    page,
  }) => {
    const row = page.locator("tbody tr").first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    // Change Status is gated until at least one publisher is selected.
    await row.getByRole("checkbox").first().check();
    await expect(
      page.getByRole("button", { name: /Change Status \(1\)/i }),
    ).toBeVisible({ timeout: 15_000 });

    // The dialog opens with its status + reason fields.
    await page.getByRole("button", { name: /Change Status/i }).first().click();
    await expect(
      page.getByText(/Change Publisher Status/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Select status/i).first()).toBeVisible();
    await expect(page.getByText(/Reason/i).first()).toBeVisible();

    // Close WITHOUT committing (no real publisher status is changed).
    await page.getByRole("button", { name: /^Close$/i }).click();
    await expect(page.locator("body")).not.toContainText(
      /Internal Server Error|Application error/i,
    );
  });

  test("Manage Groups opens without a server error @crud", async ({ page }) => {
    await page.getByRole("button", { name: /Manage Groups/i }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("body")).not.toContainText(
      /Internal Server Error|502 Bad Gateway|Application error/i,
    );
  });

  test("Export is available on the Publisher List @smoke", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /^Export$/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
