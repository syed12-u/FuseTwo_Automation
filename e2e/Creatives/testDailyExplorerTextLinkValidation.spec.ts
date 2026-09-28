import { expect, test } from "@playwright/test";
import CreativesPage from "../../pages/CreativesPage";
import { AUTH_FILE, appUrl, PATHS } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";
import {
  REQUIRED_FIELD_MESSAGE,
  TEXT_LINK_CONTENT_MAX_LENGTH,
  TEXT_LINK_MAX_LENGTH_MESSAGE,
  TRACKING_PROGRAM_NAME,
} from "../../fixtures/testConstants";

/**
 * Creatives → Add Text Link, step-1 validation and the Text Link Content
 * boundary. Nothing is saved: the wizard is driven up to (and back from) the
 * Targeting step only, so the test is safe on every environment.
 *
 * Discovered on staging 2026-09-25 (daily explorer): every step-1 field shows
 * "This field is required." on an empty Next, Text Link Content is limited to
 * 500 characters ("Maximum 500 characters allowed."), and the limit is
 * evaluated live while typing, not only on Next.
 */
test.describe("Creatives - Add Text Link validation", () => {
  test.use({ storageState: AUTH_FILE });
  test.setTimeout(3 * 60 * 1000);

  /**
   * Scenario: Add Text Link step 1 enforces required fields and the 500-character limit
   *   Given I am signed in and on Creatives → Add Text Link (step 1)
   *   When I press Next on the empty form
   *   Then Program, Campaign and Text Link Content show "This field is required."
   *   And the Targeting step does not appear
   *   When I choose a program and campaign but leave the content empty
   *   Then only Text Link Content is flagged as required
   *   When I type 501 characters of content
   *   Then "Maximum 500 characters allowed." is shown and Next stays disabled
   *   When I shorten the content to exactly 500 characters and press Next
   *   Then the Targeting step appears with its 3 options and Save
   *   When I press Back
   *   Then the program, campaign and content I entered are still there
   * Data: nothing is saved (Save is never pressed).
   */
  test("step 1 blocks Next on missing fields and enforces the 500-character content limit @crud", async ({
    page,
  }, testInfo) => {
    await page.goto(appUrl(PATHS.creatives), { waitUntil: "domcontentloaded" });
    await dismissPaymentReminderIfPresent(page);
    const creatives = new CreativesPage(page);

    await creatives.addTextLinkBtn.click();
    await expect(creatives.textLinkContentInput).toBeVisible({ timeout: 30_000 });

    // Once a field is invalid the app may disable Next outright instead of
    // rejecting the click; both are acceptable ways of blocking step 2.
    const tryNext = async (): Promise<"disabled" | "clicked"> => {
      if (await creatives.nextBtn.isDisabled()) return "disabled";
      await creatives.nextBtn.click();
      return "clicked";
    };

    // 1. Empty form: every required field is flagged and step 2 never renders.
    await creatives.nextBtn.click();
    for (const [label, field] of [
      ["Program", creatives.programNameInput],
      ["Campaign", creatives.campaignNameInput],
      ["Text Link Content", creatives.textLinkContentInput],
    ] as const) {
      await expect(
        field,
        `${label} should be marked invalid after Next on an empty form`,
      ).toHaveAttribute("aria-invalid", "true");
      await expect(
        creatives.fieldHelperText(field),
        `${label} should show the required-field message`,
      ).toHaveText(REQUIRED_FIELD_MESSAGE);
    }
    await expect(
      creatives.targetingRadios,
      "the Targeting step rendered although step 1 was empty",
    ).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("01-empty-form-errors.png") });

    // 2. Program + campaign chosen, content still empty: only content is flagged.
    await creatives.selectProgramAndCampaign(TRACKING_PROGRAM_NAME);
    await expect(creatives.programNameInput).toHaveAttribute("aria-invalid", "false");
    await expect(creatives.campaignNameInput).toHaveAttribute("aria-invalid", "false");
    console.log(`Next with empty content: ${await tryNext()}`);
    await expect(creatives.textLinkContentInput).toHaveAttribute("aria-invalid", "true");
    await expect(creatives.fieldHelperText(creatives.textLinkContentInput)).toHaveText(
      REQUIRED_FIELD_MESSAGE,
    );
    await expect(creatives.targetingRadios).toHaveCount(0);

    // 3. One character over the limit: max-length message, Next stays on step 1.
    const overLimit = "QA testauto ".padEnd(TEXT_LINK_CONTENT_MAX_LENGTH + 1, "x");
    await creatives.textLinkContentInput.fill(overLimit);
    await expect(
      creatives.textLinkContentInput,
      `the textarea should keep all ${overLimit.length} typed characters (no silent truncation)`,
    ).toHaveValue(overLimit);
    await expect(
      creatives.fieldHelperText(creatives.textLinkContentInput),
      `${TEXT_LINK_CONTENT_MAX_LENGTH + 1} characters should trigger the max-length message`,
    ).toHaveText(TEXT_LINK_MAX_LENGTH_MESSAGE);
    console.log(`Next with ${overLimit.length} characters: ${await tryNext()}`);
    await expect(
      creatives.targetingRadios,
      "the Targeting step rendered although the content exceeded 500 characters",
    ).toHaveCount(0);
    await expect(creatives.textLinkContentInput).toHaveAttribute("aria-invalid", "true");
    await page.screenshot({ path: testInfo.outputPath("02-over-limit.png") });

    // 4. Exactly at the limit: accepted, and Next reaches Targeting.
    const atLimit = overLimit.slice(0, TEXT_LINK_CONTENT_MAX_LENGTH);
    await creatives.textLinkContentInput.fill(atLimit);
    await expect(creatives.textLinkContentInput).toHaveValue(atLimit);
    await expect(
      creatives.textLinkContentInput,
      `${TEXT_LINK_CONTENT_MAX_LENGTH} characters should be valid`,
    ).toHaveAttribute("aria-invalid", "false");
    // MUI keeps an (empty) helper <p> mounted, so check its text, not its presence.
    const helper = creatives.fieldHelperText(creatives.textLinkContentInput);
    await expect(helper, "the max-length message should clear at 500 characters").not.toContainText(
      TEXT_LINK_MAX_LENGTH_MESSAGE,
    );
    await expect(helper).not.toContainText(REQUIRED_FIELD_MESSAGE);
    await expect(
      creatives.nextBtn,
      "Next should be enabled again once the content is back within 500 characters",
    ).toBeEnabled();
    await creatives.nextBtn.click();
    await expect(
      creatives.targetingRadios,
      "the Targeting step should render for a 500-character content",
    ).toHaveCount(3);
    await expect(creatives.saveBtn).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("03-at-limit-targeting.png") });

    // 5. Back keeps what was entered (no data loss between steps). Nothing saved.
    await creatives.backBtn.click();
    await expect(creatives.textLinkContentInput).toHaveValue(atLimit);
    await expect(creatives.programNameInput).toHaveValue(TRACKING_PROGRAM_NAME);
    await expect(creatives.campaignNameInput).toHaveValue(TRACKING_PROGRAM_NAME);
  });
});
