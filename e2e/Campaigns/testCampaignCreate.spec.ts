import { expect, test } from "@playwright/test";
import CampaignPage, { CreatedCampaign } from "../../pages/CampaignPage";
import { AUTH_FILE, appUrl, PATHS } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";
import { TRACKING_PROGRAM_NAME } from "../../fixtures/testConstants";

/**
 * Campaigns — full create lifecycle through the Add Campaign wizard, then a
 * cleanup pass that deactivates every campaign the run created. @write.
 *
 * Confirms campaign create and deactivate both succeed (they return 200, unlike
 * the Programs update/deactivate endpoints which return 500 on staging), and
 * that what the wizard was given — subcategory, active/expire date and time —
 * is what the campaign keeps.
 */
const NEEDLE = "testautocampaign";

test.describe("Campaigns - create + deactivate @write", () => {
  test.use({ storageState: AUTH_FILE });
  test.describe.configure({ mode: "serial" });
  test.setTimeout(4 * 60 * 1000);

  const created: CreatedCampaign[] = [];

  test("create a campaign through the wizard → appears in Active @blocker @crud", async ({
    page,
  }) => {
    const campaigns = new CampaignPage(page);
    const campaign = await campaigns.createCampaignDetailed({
      activeTime: "09:30 AM",
      expireTime: "05:45 PM",
    });
    created.push(campaign);

    await campaigns.gotoListing();
    await dismissPaymentReminderIfPresent(page);
    const row = campaigns.campaignRowByName(campaign.name).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    // The Active/Expire Date columns show the dates the wizard was given.
    await expect(row).toContainText(
      CampaignPage.listingDate(campaign.activeDate),
    );
    await expect(row).toContainText(
      CampaignPage.listingDate(campaign.expireDate),
    );
    console.log(
      `created campaign "${campaign.name}" (${campaign.subcategory}, ` +
        `${campaign.activeDate} ${campaign.activeTime} → ` +
        `${campaign.expireDate} ${campaign.expireTime})`,
    );
  });

  test("the saved campaign keeps its subcategory and active/expire date + time @crud", async ({
    page,
  }) => {
    expect(created.length, "create step did not run").toBeGreaterThan(0);
    const entered = created[0];

    const saved = await new CampaignPage(page).readSavedCampaign(entered.name);
    expect(saved.subcategory).toBe(entered.subcategory);
    expect(saved.activeDate).toBe(entered.activeDate);
    expect(saved.activeTime).toBe(entered.activeTime);
    expect(saved.expireDate).toBe(entered.expireDate);
    expect(saved.expireTime).toBe(entered.expireTime);
  });

  test("a campaign with a coupon code keeps the code and its program @crud", async ({
    page,
  }) => {
    const campaigns = new CampaignPage(page);
    const couponCode = `QA${Date.now().toString().slice(-6)}`;
    const entered = await campaigns.createCampaignDetailed({
      programName: TRACKING_PROGRAM_NAME,
      couponCode,
      activeTime: "12:00 AM",
      expireTime: "11:59 PM",
    });
    created.push(entered);

    const saved = await campaigns.readSavedCampaign(entered.name);
    expect(saved.programName).toBe(TRACKING_PROGRAM_NAME);
    expect(saved.couponCode).toBe(couponCode);
    expect(saved.subcategory).toBe(entered.subcategory);
    expect(saved.activeDate).toBe(entered.activeDate);
    expect(saved.activeTime).toBe("12:00 AM");
    expect(saved.expireDate).toBe(entered.expireDate);
    expect(saved.expireTime).toBe("11:59 PM");
  });

  test("the created campaign can be deactivated @crud", async ({ page }) => {
    expect(created.length, "create step did not run").toBeGreaterThan(0);
    const { name } = created[0];

    const campaigns = new CampaignPage(page);
    await campaigns.deactivateCampaign(name);

    // It leaves the Active listing after a reload.
    await campaigns.gotoListing();
    await dismissPaymentReminderIfPresent(page);
    await expect(campaigns.campaignRowByName(name)).toHaveCount(0, {
      timeout: 30_000,
    });
  });

  // Safety net: deactivate anything this run left behind, even on failure.
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const page = await context.newPage();
    try {
      await page.goto(appUrl(PATHS.campaigns), {
        waitUntil: "domcontentloaded",
      });
      await dismissPaymentReminderIfPresent(page);
      const removed = await new CampaignPage(page).deactivateAllMatching(
        NEEDLE,
      );
      console.log(`cleanup: deactivated ${removed} "${NEEDLE}" campaign(s)`);
    } finally {
      await context.close();
    }
  });
});
