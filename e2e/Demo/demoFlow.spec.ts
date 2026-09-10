import { expect, test } from "@playwright/test";
import ProgramPage from "../../pages/ProgramPage";
import CampaignPage from "../../pages/CampaignPage";
import CouponsOffersPage from "../../pages/CouponsOffersPage";
import PerformanceReportPage from "../../pages/PerformanceReportPage";
import { AUTH_FILE, appUrl, PATHS } from "../../config/environment";
import {
  dismissPaymentReminderIfPresent,
  installPaymentReminderAutoDismiss,
} from "../../utility/appActions";
import {
  COUPON_CODE_PREFIX,
  COUPON_CREATE_SUCCESS_MESSAGE,
  COUPON_DESCRIPTION_PREFIX,
  COUPON_DESTINATION_URL,
  COUPON_PROGRAM_NAME,
  COUPON_TITLE_PREFIX,
} from "../../fixtures/testConstants";

/**
 * TEMPLATE — one clean, continuous advertiser journey that walks every tab and
 * performs each tab's primary flow. Runs green on staging and records a single
 * video (docs/demo-videos), so it doubles as the demo.
 *
 *   Dashboard → Programs (create) → Campaigns (create + deactivate) →
 *   Creatives → Coupons (create) → Products → Publishers (change status) →
 *   Settings (save) → Reporting (save + load report template)
 *
 * Run:   npm run demo:video      (headed, records the video)
 *        npx playwright test e2e/Demo/demoFlow.spec.ts --project=chromium
 *
 * Use this file as the pattern for a full end-to-end tab walkthrough.
 */
test.use({ storageState: AUTH_FILE, video: "on" });

test.describe("Full advertiser journey — every tab", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(8 * 60 * 1000);

  test("advertiser walks every tab end to end", async ({ page }) => {
    await installPaymentReminderAutoDismiss(page);
    const beat = (ms = 1000) => page.waitForTimeout(ms);

    await test.step("Dashboard — land on the authenticated shell", async () => {
      await page.goto(appUrl(PATHS.dashboard), {
        waitUntil: "domcontentloaded",
      });
      await dismissPaymentReminderIfPresent(page);
      await expect(page).not.toHaveURL(/\/signin/i);
      await beat();
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
      await beat();
    });

    await test.step("Campaigns — create a campaign, then deactivate it", async () => {
      const campaigns = new CampaignPage(page);
      const name = await campaigns.createCampaign();
      await campaigns.gotoListing();
      await dismissPaymentReminderIfPresent(page);
      await expect(campaigns.campaignRowByName(name).first()).toBeVisible({
        timeout: 30_000,
      });
      await campaigns.deactivateCampaign(name);
      await beat();
    });

    await test.step("Creatives — listing, status tabs, Add Text Link form", async () => {
      await page.goto(appUrl(PATHS.creatives), {
        waitUntil: "domcontentloaded",
      });
      await dismissPaymentReminderIfPresent(page);
      await expect(
        page.getByRole("tab", { name: /Active Creatives/ }),
      ).toBeVisible({ timeout: 30_000 });
      await page.getByRole("tab", { name: /Inactive Creatives/ }).click();
      await expect(
        page.getByRole("button", { name: /Add Text Link/i }),
      ).toBeVisible();
      await beat();
    });

    await test.step("Coupons & Offers — create a coupon", async () => {
      const coupons = new CouponsOffersPage(page);
      await coupons.openCouponsAndOffers();
      await dismissPaymentReminderIfPresent(page);
      const suffix = Math.random().toString(36).slice(2, 8);
      await coupons.startAddCoupon();
      await beat(800);
      await page
        .getByRole("button", { name: /^No$/ })
        .click({ timeout: 4000 })
        .catch(() => {});
      await coupons.selectProgram(COUPON_PROGRAM_NAME);
      await coupons.fillCouponDetails({
        destinationUrl: COUPON_DESTINATION_URL,
        title: `${COUPON_TITLE_PREFIX}${suffix}`,
        description: `${COUPON_DESCRIPTION_PREFIX}${suffix}`,
        couponCode: `${COUPON_CODE_PREFIX}${suffix}`,
      });
      await coupons.selectActiveDate("1");
      await coupons.selectExpireDate("28");
      await coupons.goNext();
      await coupons.markVisibleToSelectedPublishers();
      await coupons.addPublisher();
      await coupons.saveCoupon();
      await expect(coupons.alertMessage).toContainText(
        COUPON_CREATE_SUCCESS_MESSAGE,
        { timeout: 30_000 },
      );
      await beat();
    });

    await test.step("Products — feed setup sub-tabs", async () => {
      await page.goto(appUrl(PATHS.products), {
        waitUntil: "domcontentloaded",
      });
      await dismissPaymentReminderIfPresent(page);
      await expect(page.getByRole("tab", { name: /^SETUP/i })).toBeVisible({
        timeout: 30_000,
      });
      await page
        .getByRole("tab", { name: /^MANAGE/i })
        .click()
        .catch(() => {});
      await beat();
    });

    await test.step("Publishers — select one and open Change Status", async () => {
      await page.goto(appUrl(PATHS.publisherList), {
        waitUntil: "domcontentloaded",
      });
      await dismissPaymentReminderIfPresent(page);
      const row = page.locator("tbody tr").first();
      await expect(row).toBeVisible({ timeout: 30_000 });
      await row.getByRole("checkbox").first().check();
      await page
        .getByRole("button", { name: /Change Status/i })
        .first()
        .click();
      await expect(
        page.getByText(/Change Publisher Status/i).first(),
      ).toBeVisible({ timeout: 15_000 });
      await beat();
      // Close without committing — a real status change mutates a publisher.
      await page
        .getByRole("button", { name: /^Close$/i })
        .click()
        .catch(() => {});
    });

    await test.step("Settings — My Account save (reversible)", async () => {
      await page.goto(appUrl("/app/settings/myaccount"), {
        waitUntil: "domcontentloaded",
      });
      await dismissPaymentReminderIfPresent(page);
      const phone = page.locator('input[name="phone"]');
      await expect(phone).toBeVisible({ timeout: 30_000 });
      const original = await phone.inputValue();
      await phone.fill("6175550188");
      await page.getByRole("button", { name: /Save Changes/i }).click();
      await beat(2500);
      // restore
      await phone.fill(original);
      await page.getByRole("button", { name: /Save Changes/i }).click();
      await beat();
    });

    await test.step("Reporting — save a report template and load it back", async () => {
      const perf = new PerformanceReportPage(page);
      await page.goto(appUrl(PATHS.reportPerformance), {
        waitUntil: "domcontentloaded",
      });
      await dismissPaymentReminderIfPresent(page);
      await perf.selectTimeFrame("Last month");
      await perf.selectReportBy("Daily");
      await perf.runReport();

      const templateName = `QATpl${Date.now().toString().slice(-6)}`;
      await page.getByRole("button", { name: /Save Report/i }).click();
      await page.locator('input[name="templateName"]').fill(templateName);
      await page
        .locator('[role="dialog"], .MuiDialog-root')
        .getByRole("button", { name: /^Save$/i })
        .click();
      await expect(
        page.getByRole("alert").filter({ hasText: /Report template saved/i }),
      ).toBeVisible({ timeout: 15_000 });

      await perf.performanceReportDropdown.click();
      await expect(
        page.getByRole("option", { name: templateName, exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press("Escape");
      await beat();
    });
  });
});
