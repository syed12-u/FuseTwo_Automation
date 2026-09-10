import { expect, test } from "@playwright/test";
import { AUTH_FILE, appUrl, PATHS } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Campaigns — the Add Campaign entry point and its required-field gating.
 *
 * Read-only/validation coverage (no campaign is actually created): opening the
 * form, confirming every required field is present, and that the wizard will
 * not advance past step 1 with an empty form. Safe on every environment.
 *
 * (End-to-end create is a multi-section wizard — General / Links / Payout —
 * with date & time pickers; see app-scenarios.md 2.4/2.5.)
 */
// Step-1 (General section) required fields. Destination URL lives in the later
// "Links" section, so it is not asserted here.
const REQUIRED_LABELS = [
  "Program",
  "Campaign Name",
  "Subcategory",
  "Description",
  "Active Date",
  "Active Time",
  "Expire Date",
  "Expire Time",
];

test.describe("Campaigns - Add Campaign form", () => {
  test.use({ storageState: AUTH_FILE });

  test.beforeEach(async ({ page }) => {
    await page.goto(appUrl(PATHS.campaigns), { waitUntil: "domcontentloaded" });
    await dismissPaymentReminderIfPresent(page);
  });

  test("Add Campaign opens the new-campaign form @blocker @smoke", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Add Campaign/i }).click();
    await expect(page).toHaveURL(/\/app\/campaigns\/new/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /Add New Campaign/i }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /502 Bad Gateway|Internal Server Error|Application error/i,
    );
  });

  test("the form exposes every required field @blocker", async ({ page }) => {
    await page.goto(appUrl(`${PATHS.campaigns}/new`), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
    for (const label of REQUIRED_LABELS) {
      await expect(
        page.locator("label").filter({ hasText: new RegExp(label) }).first(),
        `required field "${label}" is missing from the Add Campaign form`,
      ).toBeVisible({ timeout: 30_000 });
    }
  });

  test("an empty form cannot advance past step 1 @crud", async ({ page }) => {
    await page.goto(appUrl(`${PATHS.campaigns}/new`), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);

    await page.getByRole("button", { name: /^Continue$/i }).click();

    // The wizard stays on step 1 and surfaces required-field errors.
    await expect(page).toHaveURL(/\/app\/campaigns\/new/);
    await expect(
      page.getByText(/This field is required/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
