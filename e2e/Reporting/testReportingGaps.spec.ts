import { expect, test } from "@playwright/test";
import PerformanceReportPage from "../../pages/PerformanceReportPage";
import { AUTH_FILE, appUrl } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Reporting — coverage for the sub-tabs and the Save/Load report-template CRUD
 * that the other report specs did not reach: Products Summary, Click ID Lookup,
 * and Performance's Save Report → Load Saved Report round-trip.
 */
test.describe("Reporting - remaining sub-tabs + report-template CRUD", () => {
  test.use({ storageState: AUTH_FILE });
  test.setTimeout(2 * 60 * 1000);

  test("Products Summary loads with Export @smoke", async ({ page }) => {
    await page.goto(appUrl("/app/reports/productssummary"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
    await expect(page).toHaveURL(/productssummary/);
    await expect(
      page.getByRole("button", { name: /^Export$/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("body")).not.toContainText(
      /Page not found|Internal Server Error|502 Bad Gateway/i,
    );
  });

  test("Click ID Lookup loads with Search + Export and accepts a lookup @smoke", async ({
    page,
  }) => {
    await page.goto(appUrl("/app/reports/clickidlookup"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
    await expect(
      page.getByText(/Enter click IDs/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /^Search$/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Export$/i }).first(),
    ).toBeVisible();

    // A lookup with a dummy id runs without a server error (no results is fine).
    await page.getByRole("textbox").first().fill("00000000-0000-0000-0000-000000000000");
    await page.getByRole("button", { name: /^Search$/i }).click();
    await page.waitForTimeout(2500);
    await expect(page.locator("body")).not.toContainText(
      /Internal Server Error|502 Bad Gateway|Application error/i,
    );
  });

  test("Performance: save a report template and load it back @crud", async ({
    page,
  }) => {
    await page.goto(appUrl("/app/reports/performance"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);

    // Saving a template requires a fully-configured report: Time Frame AND
    // Report Type (Report By) set, and the report run — otherwise the API
    // rejects ("The Time Frame field is required" / "The Report Type field is
    // required").
    const perf = new PerformanceReportPage(page);
    await perf.selectTimeFrame("Last month");
    await perf.selectReportBy("Daily");
    await perf.runReport();

    const templateName = `QATpl${Date.now().toString().slice(-6)}`;

    await page.getByRole("button", { name: /Save Report/i }).click();
    await expect(
      page.getByText(/Save Report Template/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.locator('input[name="templateName"]').fill(templateName);
    await page
      .locator('[role="dialog"], .MuiDialog-root')
      .getByRole("button", { name: /^Save$/i })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: /Report template saved/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Load it back: the saved template now appears in the report-template
    // dropdown, proving the save round-tripped.
    await perf.performanceReportDropdown.click();
    await expect(
      page.getByRole("option", { name: templateName, exact: true }),
      `saved template "${templateName}" is not offered in Load Saved Report`,
    ).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
  });
});
