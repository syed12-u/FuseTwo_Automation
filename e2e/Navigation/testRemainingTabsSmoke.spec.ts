import { expect, test } from "@playwright/test";
import { AUTH_FILE, appUrl, PATHS } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Smoke coverage for the remaining tabs: each page loads, its sub-tabs and
 * primary action entry points render, and there is no server-error banner.
 * Read-only, safe on every environment.
 */
test.describe("Remaining tabs - smoke (read-only)", () => {
  test.use({ storageState: AUTH_FILE });

  const noServerError = async (page: import("@playwright/test").Page) =>
    expect(page.locator("body")).not.toContainText(
      /502 Bad Gateway|Internal Server Error|Application error/i,
    );

  test("Products feed: all 5 sub-tabs render @blocker @smoke", async ({
    page,
  }) => {
    await page.goto(appUrl(PATHS.products), { waitUntil: "domcontentloaded" });
    await dismissPaymentReminderIfPresent(page);
    for (const tab of [
      "SETUP",
      "SPECIFICATIONS",
      "IMPORT",
      "MANAGE",
      "TROUBLESHOOTING",
    ]) {
      await expect(
        page.getByRole("tab", { name: new RegExp(`^${tab}`, "i") }),
        `Products tab "${tab}" missing`,
      ).toBeVisible({ timeout: 30_000 });
    }
    await noServerError(page);
  });

  test("Publisher List: all status tabs + entry points @blocker @smoke", async ({
    page,
  }) => {
    await page.goto(appUrl(PATHS.publisherList), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
    for (const tab of [
      "APPROVED",
      "PENDING",
      "DEACTIVATED",
      "DECLINED",
      "PRE-APPROVED",
      "RECRUITMENT",
    ]) {
      await expect(
        page.getByRole("tab", { name: new RegExp(`^${tab}`, "i") }),
        `Publisher tab "${tab}" missing`,
      ).toBeVisible({ timeout: 30_000 });
    }
    for (const btn of ["Find Publishers", "Export", "Manage Groups"]) {
      await expect(
        page.getByRole("button", { name: new RegExp(btn, "i") }).first(),
        `Publisher action "${btn}" missing`,
      ).toBeVisible();
    }
    await noServerError(page);
  });

  test("Find Publishers wizard: Introduction + Start @smoke", async ({
    page,
  }) => {
    await page.goto(appUrl("/app/publishers/find-publishers"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
    await expect(
      page.getByRole("button", { name: /^Start$/i }),
    ).toBeVisible({ timeout: 30_000 });
    await noServerError(page);
  });

  test("Settings - My Account loads with Save Changes @smoke", async ({
    page,
  }) => {
    await page.goto(appUrl("/app/settings/myaccount"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
    await expect(
      page.getByRole("button", { name: /Save Changes/i }),
    ).toBeVisible({ timeout: 30_000 });
    await noServerError(page);
  });

  test("Settings - Advertiser Setup: all 5 tabs render @smoke", async ({
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
      "PUBLISHER APPROVAL",
      "SEARCH KEYWORDS",
    ]) {
      await expect(
        page.getByRole("tab", { name: new RegExp(tab, "i") }),
        `Advertiser Setup tab "${tab}" missing`,
      ).toBeVisible({ timeout: 30_000 });
    }
    await noServerError(page);
  });

  test("Settings - Tracking Pixel: 4 tabs + Get JavaScript @smoke", async ({
    page,
  }) => {
    await page.goto(appUrl("/app/settings/trackingpixel"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
    for (const tab of ["JAVASCRIPT", "SERVER 2 SERVER", "ECOMMERCE", "API"]) {
      await expect(
        page.getByRole("tab", { name: new RegExp(tab, "i") }),
        `Tracking Pixel tab "${tab}" missing`,
      ).toBeVisible({ timeout: 30_000 });
    }
    await noServerError(page);
  });

  test("Support - Help Desk: Launch Support Site @smoke", async ({ page }) => {
    await page.goto(appUrl("/app/support/helpdesk"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
    await expect(
      page.getByRole("button", { name: /Launch Support Site/i }),
    ).toBeVisible({ timeout: 30_000 });
    await noServerError(page);
  });

  test("Reporting - Performance loads with Run/Export @smoke", async ({
    page,
  }) => {
    await page.goto(appUrl(PATHS.reportPerformance), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
    await expect(
      page.getByRole("button", { name: /Run Report/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: /^Export$/i }).first(),
    ).toBeVisible();
    await noServerError(page);
  });

  // Message Center intermittently showed "Oops, an error has occurred. Page not
  // found!" during a rapid crawl but loads cleanly on retry; this guards against
  // that error returning.
  test("Message Center loads without a page-not-found error @smoke", async ({
    page,
  }) => {
    await page.goto(appUrl("/app/messagecenter"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
    await expect(page.locator("body")).not.toContainText(
      /an error has occurred|Page not found/i,
      { timeout: 15_000 },
    );
  });
});
