import { expect, test } from "@playwright/test";
import CampaignPage from "../../pages/CampaignPage";
import { AUTH_FILE, appUrl, PATHS } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Campaigns — full create lifecycle through the Add Campaign wizard, then a
 * cleanup pass that deactivates every campaign the run created. @write.
 *
 * Confirms campaign create and deactivate both succeed (they return 200, unlike
 * the Programs update/deactivate endpoints which return 500 on staging).
 */
const NEEDLE = "testautocampaign";

test.describe("Campaigns - create + deactivate @write", () => {
  test.use({ storageState: AUTH_FILE });
  test.describe.configure({ mode: "serial" });
  test.setTimeout(4 * 60 * 1000);

  const created: string[] = [];

  test("create a campaign through the wizard → appears in Active @blocker @crud", async ({
    page,
  }) => {
    const campaigns = new CampaignPage(page);
    const name = await campaigns.createCampaign();
    created.push(name);

    await campaigns.gotoListing();
    await dismissPaymentReminderIfPresent(page);
    await expect(campaigns.campaignRowByName(name).first()).toBeVisible({
      timeout: 30_000,
    });
    console.log(`created campaign "${name}"`);
  });

  test("the created campaign can be deactivated @crud", async ({ page }) => {
    expect(created.length, "create step did not run").toBeGreaterThan(0);
    const name = created[0];

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
