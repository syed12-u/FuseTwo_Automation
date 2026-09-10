import { expect, test } from "@playwright/test";
import ProgramPage from "../../pages/ProgramPage";
import CampaignPage from "../../pages/CampaignPage";
import { AUTH_FILE, appUrl, PATHS } from "../../config/environment";
import {
  dismissPaymentReminderIfPresent,
  installPaymentReminderAutoDismiss,
} from "../../utility/appActions";

/**
 * ONE continuous advertiser journey, in a single test, so Playwright records it
 * as ONE video (docs/demo-videos). It walks the whole app the way an advertiser
 * would: dashboard → create a program → create a campaign → creatives →
 * coupons → products → publishers → settings → reporting.
 *
 * Recorded with:  (video is set to "on" for this run)
 *   npx playwright test e2e/Demo/demoFlow.spec.ts --project=chromium --headed
 */
test.use({ storageState: AUTH_FILE, video: "on" });

test.describe("Demo - full advertiser flow (single video)", () => {
  test.setTimeout(6 * 60 * 1000);

  test("advertiser end-to-end journey", async ({ page }) => {
    await installPaymentReminderAutoDismiss(page);
    const pause = (ms = 1200) => page.waitForTimeout(ms);

    await test.step("Dashboard", async () => {
      await page.goto(appUrl(PATHS.dashboard), { waitUntil: "domcontentloaded" });
      await dismissPaymentReminderIfPresent(page);
      await pause();
    });

    await test.step("Programs — create a program", async () => {
      const programs = new ProgramPage(page);
      await programs.navigateToPrograms();
      const name = await programs.createProgram();
      await expect(programs.successAlert).toContainText(/Program Created/i);
      await programs.gotoListing();
      await dismissPaymentReminderIfPresent(page);
      await expect(programs.programRowByName(name).first()).toBeVisible({
        timeout: 30_000,
      });
      await pause();
    });

    await test.step("Campaigns — create a campaign", async () => {
      const campaigns = new CampaignPage(page);
      const name = await campaigns.createCampaign();
      await campaigns.gotoListing();
      await dismissPaymentReminderIfPresent(page);
      await expect(campaigns.campaignRowByName(name).first()).toBeVisible({
        timeout: 30_000,
      });
      await pause();
    });

    await test.step("Creatives — listing + status tabs", async () => {
      await page.goto(appUrl(PATHS.creatives), { waitUntil: "domcontentloaded" });
      await dismissPaymentReminderIfPresent(page);
      await expect(
        page.getByRole("tab", { name: /Active Creatives/ }),
      ).toBeVisible({ timeout: 30_000 });
      await page.getByRole("tab", { name: /Inactive Creatives/ }).click();
      await pause();
    });

    await test.step("Coupons & Offers — open the Add wizard", async () => {
      await page.goto(appUrl(PATHS.couponsAndOffers), {
        waitUntil: "domcontentloaded",
      });
      await dismissPaymentReminderIfPresent(page);
      await page
        .getByRole("button", { name: /Add Coupon or Offer/i })
        .first()
        .click();
      await page
        .getByRole("button", { name: /^No$/ })
        .click({ timeout: 4000 })
        .catch(() => {});
      await expect(page.getByText(/Add Coupon or Offer/i).first()).toBeVisible({
        timeout: 30_000,
      });
      await pause();
    });

    await test.step("Products — feed setup tabs", async () => {
      await page.goto(appUrl(PATHS.products), { waitUntil: "domcontentloaded" });
      await dismissPaymentReminderIfPresent(page);
      await expect(page.getByRole("tab", { name: /^SETUP/i })).toBeVisible({
        timeout: 30_000,
      });
      await page.getByRole("tab", { name: /^MANAGE/i }).click().catch(() => {});
      await pause();
    });

    await test.step("Publishers — select + Change Status dialog", async () => {
      await page.goto(appUrl(PATHS.publisherList), {
        waitUntil: "domcontentloaded",
      });
      await dismissPaymentReminderIfPresent(page);
      const row = page.locator("tbody tr").first();
      await expect(row).toBeVisible({ timeout: 30_000 });
      await row.getByRole("checkbox").first().check();
      await page.getByRole("button", { name: /Change Status/i }).first().click();
      await expect(
        page.getByText(/Change Publisher Status/i).first(),
      ).toBeVisible({ timeout: 15_000 });
      await pause();
      await page.getByRole("button", { name: /^Close$/i }).click().catch(() => {});
    });

    await test.step("Settings — My Account", async () => {
      await page.goto(appUrl("/app/settings/myaccount"), {
        waitUntil: "domcontentloaded",
      });
      await dismissPaymentReminderIfPresent(page);
      await expect(
        page.getByRole("button", { name: /Save Changes/i }),
      ).toBeVisible({ timeout: 30_000 });
      await pause();
    });

    await test.step("Reporting — Performance", async () => {
      await page.goto(appUrl(PATHS.reportPerformance), {
        waitUntil: "domcontentloaded",
      });
      await dismissPaymentReminderIfPresent(page);
      await expect(
        page.getByRole("button", { name: /Run Report/i }),
      ).toBeVisible({ timeout: 30_000 });
      await pause(1600);
    });
  });
});
