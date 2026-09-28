import { expect, test } from "@playwright/test";
import CreativesPage, {
  CreativeTargeting,
  TARGETING_LABEL,
} from "../../pages/CreativesPage";
import { AUTH_FILE, appUrl, PATHS } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";
import { TRACKING_PROGRAM_NAME } from "../../fixtures/testConstants";

/**
 * Creatives → Add Text Link, one creative per targeting option, each checked
 * for the success message and its row in the Active Creatives table. Uses an
 * existing program (with its default campaign) instead of creating one.
 */
test.describe("Creatives - text link targeting @write", () => {
  test.use({ storageState: AUTH_FILE });
  test.setTimeout(3 * 60 * 1000);

  const cases: CreativeTargeting[] = ["Visible", "Invisible", "VisibleSelected"];

  for (const targeting of cases) {
    test(`text link targeted "${TARGETING_LABEL[targeting]}" is created and listed @crud`, async ({
      page,
    }) => {
      await page.goto(appUrl(PATHS.creatives), { waitUntil: "domcontentloaded" });
      await dismissPaymentReminderIfPresent(page);
      const creatives = new CreativesPage(page);
      const text = `QA ${targeting} text link ${Date.now().toString().slice(-6)}`;

      if (targeting === "VisibleSelected") {
        // Pick the first publisher the grid offers rather than a fixed id.
        await creatives.addTextLinkBtn.click();
        await creatives.selectProgramAndCampaign(TRACKING_PROGRAM_NAME);
        await creatives.textInput.fill(text);
        await creatives.nextBtn.click();
        await creatives.targetingOption(targeting).check();
        const firstRow = page.locator("tbody tr").first();
        await expect(firstRow).toBeVisible({ timeout: 30_000 });
        await firstRow.getByRole("checkbox").first().check();
        await creatives.saveBtn.click();
      } else {
        await creatives.createTextLink(TRACKING_PROGRAM_NAME, text, { targeting });
      }

      await expect(creatives.successAlert).toContainText(
        /Text Link successfully created/i,
        { timeout: 30_000 },
      );
      await expect(creatives.activeCreativeRow(text).first()).toBeVisible({
        timeout: 30_000,
      });
    });
  }
});
