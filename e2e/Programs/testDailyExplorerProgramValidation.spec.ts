import { expect, Locator, Page, test } from "@playwright/test";
import ProgramPage from "../../pages/ProgramPage";
import { AUTH_FILE, PATHS } from "../../config/environment";
import {
  dismissPaymentReminderIfPresent,
  expectNoServerError,
  expectRedirectToSignin,
} from "../../utility/appActions";
import {
  TRACKING_PROGRAM_ID,
  TRACKING_PROGRAM_NAME,
} from "../../fixtures/testConstants";

/**
 * Programs — Add Program step-1 validation, a deep-link read-back and the
 * sign-in guard. Nothing is saved: the wizard is never taken past step 1 with
 * valid data, so no @write tag / cleanup is needed.
 *
 * Added by the daily explorer 2026-09-27 (written blind, see
 * docs/daily-explorer/2026-09-27.md); the step-1 validation describe was then
 * reworked against the real staging form the same day.
 */

/*
 * How step 1 of /app/programs/new really validates (observed on staging
 * 2026-09-27; aria-invalid stays "false" on every field, so don't assert it):
 *  - Continue is a *disabled* button until step 1 is complete; nothing is
 *    rejected on click, there is no toast and the GENERAL tab stays selected.
 *  - Category, Country and Description are disabled until Program Name and
 *    Domain URL are both valid and the Automation Assistance prompt (fired by
 *    a GET CheckProgramAndDomainExists on Domain URL *blur*) is answered "No".
 *    Clicking the heading does not reliably blur the field; press Tab.
 *  - A field that was typed in and cleared shows the MUI helper text
 *    "This field is required."; a malformed Domain URL shows
 *    "Enter valid URL: https://example.com". Invalidating either field later
 *    re-disables Continue and re-locks Category/Country/Description.
 *  - Once step 1 is valid Continue is enabled; these tests never click it.
 */

const REQUIRED_HELPER = "This field is required.";
const BAD_URL_HELPER = "Enter valid URL: https://example.com";

/** The MUI helper text rendered under the given input. */
function helperFor(page: Page, field: Locator): Locator {
  return page
    .locator(".MuiFormControl-root", { has: field })
    .locator(".MuiFormHelperText-root");
}

/** Step 1 is still showing, Continue is blocked and step 2 never rendered. */
async function expectBlockedOnStep1(page: Page, programs: ProgramPage, why: string) {
  await expect(programs.continueBtn, `${why}: Continue should be disabled`).toBeDisabled();
  await expect(
    page.getByRole("tab", { name: /general/i }),
    `${why}: the GENERAL tab should stay selected`,
  ).toHaveAttribute("aria-selected", "true");
  await expect(programs.programNameInput, `${why}: step 1 was left`).toBeVisible();
  await expect(programs.commissionInput, `${why}: the commission step rendered`).toBeHidden();
}

/** Category, Country and Description are locked (disabled). */
async function expectDependentFieldsLocked(programs: ProgramPage, why: string) {
  for (const [label, field] of [
    ["Category", programs.categoryDropdown],
    ["Country", programs.countryDropdown],
    ["Description", programs.descriptionInput],
  ] as const) {
    await expect(field, `${why}: ${label} should be locked`).toBeDisabled();
  }
}

/**
 * Fill step 1 completely with valid data but do NOT press Continue: a valid
 * name + domain, Tab to trigger the domain check, answer the Automation
 * Assistance prompt "No", then category / country / description.
 */
async function fillValidStep1WithoutContinuing(programs: ProgramPage) {
  const suffix = `${Date.now()}`.slice(-7);
  await programs.programNameInput.fill(`QA testauto validation ${suffix}`);
  await programs.domainUrlInput.fill(`https://qa-testauto-validation-${suffix}.com`);
  await programs.domainUrlInput.press("Tab");
  await programs.closeAutomationAssistanceModal.click({ timeout: 30_000 });
  await expect(programs.categoryDropdown).toBeEnabled({ timeout: 15_000 });
  await programs.categoryDropdown.click();
  await programs.categoryOption.click();
  await programs.countryDropdown.click();
  await programs.countryOption.click();
  await programs.descriptionInput.fill("QA testauto daily explorer - not saved");
  // Sanity: the form really was complete, so what follows is the invalid
  // value's doing (Continue is left alone - pressing it would advance).
  await expect(programs.continueBtn, "valid step 1 should enable Continue").toBeEnabled();
}

test.describe("Programs - Add Program step 1 validation @crud", () => {
  test.use({ storageState: AUTH_FILE });
  test.setTimeout(3 * 60 * 1000);

  let programs: ProgramPage;

  test.beforeEach(async ({ page }) => {
    programs = new ProgramPage(page);
    await programs.gotoListing();
    await dismissPaymentReminderIfPresent(page);
    await programs.navigateToPrograms();
    await expect(programs.programNameInput).toBeVisible({ timeout: 30_000 });
  });

  /**
   * Scenario: Add Program cannot continue with an empty form
   *   Given I am signed in and on Programs → Add Program (step 1, GENERAL tab)
   *   When I type into Program Name and Domain URL, clear them and leave each field
   *   Then Continue stays disabled and the GENERAL tab stays selected
   *   And Category, Country and Description stay locked
   *   And Program Name and Domain URL both show "This field is required."
   *   And the commission step (step 2) never appears
   * Data: nothing is saved.
   */
  test("Continue on an empty form flags Program Name and Domain URL and stays on step 1", async ({
    page,
  }, testInfo) => {
    // Pristine form: Continue cannot be pressed and the rest of step 1 is locked.
    await expectBlockedOnStep1(page, programs, "pristine empty form");
    await expectDependentFieldsLocked(programs, "pristine empty form");

    // Touch both required fields and leave them empty: each is flagged.
    for (const field of [programs.programNameInput, programs.domainUrlInput]) {
      await field.fill("x");
      await field.fill("");
      await field.press("Tab");
    }
    for (const [label, field] of [
      ["Program Name", programs.programNameInput],
      ["Domain URL", programs.domainUrlInput],
    ] as const) {
      await expect(
        helperFor(page, field),
        `${label} should say it is required once left empty`,
      ).toHaveText(REQUIRED_HELPER);
    }
    await expectBlockedOnStep1(page, programs, "empty Program Name and Domain URL");
    await page.screenshot({ path: testInfo.outputPath("01-empty-step1.png"), fullPage: true });
  });

  /**
   * Scenario: a malformed Domain URL blocks step 1 even when everything else is valid
   *   Given I am on Add Program with every step-1 field filled correctly
   *     (automation prompt answered "No", Continue enabled but not clicked)
   *   When I change Domain URL to "not a url" and leave the field
   *   Then Domain URL shows "Enter valid URL: https://example.com"
   *   And Continue is disabled again and step 1 stays on screen
   *   And Category, Country and Description lock again
   * Data: nothing is saved (Continue is never pressed).
   */
  test("a malformed Domain URL blocks step 2 even with every other field filled", async ({
    page,
  }, testInfo) => {
    await fillValidStep1WithoutContinuing(programs);

    await programs.domainUrlInput.fill("not a url");
    await programs.domainUrlInput.press("Tab");

    await expect(
      helperFor(page, programs.domainUrlInput),
      'Domain URL "not a url" should be flagged',
    ).toHaveText(BAD_URL_HELPER);
    await expectBlockedOnStep1(page, programs, 'Domain URL "not a url"');
    await expectDependentFieldsLocked(programs, 'Domain URL "not a url"');
    await page.screenshot({ path: testInfo.outputPath("02-bad-domain.png"), fullPage: true });
  });

  /**
   * Scenario (corner case): a Program Name of only spaces counts as empty
   *   Given I am on Add Program with every step-1 field filled correctly
   *   When I change Program Name to five spaces and leave the field
   *   Then Continue is disabled again and the GENERAL tab stays selected
   *   And Category, Country and Description lock again
   *   But no "This field is required." message is shown (minor UX gap, only logged)
   * Data: nothing is saved.
   */
  test("a whitespace-only Program Name is treated as empty", async ({ page }, testInfo) => {
    // Sibling of the Creatives whitespace defect (daily explorer 2026-09-25):
    // required-field checks should trim before validating. On staging
    // 2026-09-27 the program form does: "     " disables Continue and re-locks
    // the dependent fields exactly like an empty name (no defect). It does not
    // show the "This field is required." helper, though, so that is only logged.
    await fillValidStep1WithoutContinuing(programs);

    await programs.programNameInput.fill("     ");
    await programs.programNameInput.press("Tab");

    await expectBlockedOnStep1(page, programs, "whitespace-only Program Name");
    await expectDependentFieldsLocked(programs, "whitespace-only Program Name");
    console.log(
      "Program Name helper for a whitespace-only name:",
      await helperFor(page, programs.programNameInput).allInnerTexts(),
    );
    await page.screenshot({ path: testInfo.outputPath("03-whitespace-name.png"), fullPage: true });
  });
});

test.describe("Programs - deep links", () => {
  test.use({ storageState: AUTH_FILE });

  /**
   * Scenario: opening a saved program from a direct link
   *   Given I am signed in
   *   When I open /app/programs/<id> for the reference program
   *     (staging 249231 "Test4302026", prod 249442 "TestADO921-9222026")
   *   Then the heading reads "Update Program (#<id>)"
   *   And Program Name shows the saved name
   *   And no server error page appears
   * Data: read-only.
   */
  test("opening the reference program by id shows its saved name @crud", async ({ page }) => {
    test.skip(!TRACKING_PROGRAM_ID, "no reference program id for this environment");
    const programs = new ProgramPage(page);
    await programs.gotoProgramDetail(String(TRACKING_PROGRAM_ID));
    await dismissPaymentReminderIfPresent(page);

    await expect(
      page.getByRole("heading", {
        name: new RegExp(`Update Program \\(#${TRACKING_PROGRAM_ID}\\)`),
      }),
      "the heading should carry the id from the URL",
    ).toBeVisible();
    // Saved values hydrate a moment after mount; wait for the real value.
    await expect(
      programs.programNameInput,
      `program ${TRACKING_PROGRAM_ID} should read back as "${TRACKING_PROGRAM_NAME}"`,
    ).toHaveValue(TRACKING_PROGRAM_NAME, { timeout: 30_000 });
    await expectNoServerError(page);
  });
});

test.describe("Programs - signed-out access @security", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  /**
   * Scenario (security): Programs links require sign-in
   *   Given I am not signed in (no cookies or storage)
   *   When I open /app/programs and then a program's detail URL
   *   Then both redirect to the sign-in page and no program data is shown
   * Data: read-only.
   */
  test("signed-out deep links to the listing and a program redirect to sign-in", async ({
    page,
  }) => {
    await expectRedirectToSignin(page, PATHS.programs);
    await expectRedirectToSignin(page, `${PATHS.programs}/${TRACKING_PROGRAM_ID ?? 1}`);
  });
});
