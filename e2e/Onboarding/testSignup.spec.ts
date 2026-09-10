import { expect, test } from "@playwright/test";
import SignUpPage from "../../pages/FlexOffersSignUpPage";
import { uniqueSignupEmail } from "../../fixtures/onboardingData";
import { PASSWORD, SECURITY_ANSWER } from "../../fixtures/testConstants";

// Registration runs signed out and creates real advertiser records, so the
// tests that submit are tagged @write and never run against live.

test.describe("Onboarding - registration", () => {
  test.setTimeout(3 * 60 * 1000);

  test("a new advertiser can register end to end @blocker @write @crud", async ({
    page,
  }) => {
    const signUp = new SignUpPage(page);

    const advertiser = await signUp.registerNewAdvertiser();
    console.log(
      `registered ${advertiser.email} as "${advertiser.companyName}"`,
    );

    await expect(page.getByText(/thank you/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });

  test("the CAPTCHA answer is regenerated on every load @security", async ({
    page,
  }) => {
    const signUp = new SignUpPage(page);
    const answers: string[] = [];

    for (let i = 0; i < 3; i++) {
      await signUp.goto();
      const answer = await signUp.readCaptchaAnswer();
      expect(
        answer,
        "the CAPTCHA answer could not be read from the page",
      ).not.toBeNull();
      answers.push(answer!);
    }

    // A CAPTCHA that never changes is no CAPTCHA at all.
    expect(
      new Set(answers).size,
      `CAPTCHA repeated across loads: ${answers.join(", ")}`,
    ).toBeGreaterThan(1);
  });

  test("an empty step 1 cannot be submitted @blocker", async ({ page }) => {
    const signUp = new SignUpPage(page);

    await signUp.goto();
    await signUp.continueBtn.click();
    await page.waitForTimeout(3_000);

    // The form stays put: still on step 1, company step never rendered.
    await expect(signUp.captcha).toBeVisible();
    await expect(
      signUp.companyName,
      "an empty step 1 advanced to the company step",
    ).toBeHidden();
  });

  // Bug #681 - recorded as Done on the board, but reproducible on dev today:
  // step 1 accepts a deliberately wrong CAPTCHA and advances to step 2.
  test("a wrong CAPTCHA is rejected @security @known-bug", async ({ page }) => {
    const signUp = new SignUpPage(page);
    const email = uniqueSignupEmail();

    await signUp.goto();
    await signUp.firstName.fill("QAauto");
    await signUp.lastName.fill("Tester");
    await signUp.email.fill(email);
    await signUp.confirmEmail.fill(email);
    await signUp.password.fill(PASSWORD);
    await signUp.confirmPassword.fill(PASSWORD);
    await signUp.securityQuestion.click();
    await page.locator('li[role="option"]').first().click();
    await signUp.securityAnswer.fill(SECURITY_ANSWER);

    const real = await signUp.readCaptchaAnswer();
    await signUp.captcha.fill(real === "ZZZZZ" ? "YYYYY" : "ZZZZZ");

    await signUp.continueBtn.click();
    await page.waitForTimeout(6_000);

    await expect(
      signUp.companyName,
      "a wrong CAPTCHA advanced registration to the company step (bug #681)",
    ).toBeHidden();
  });

  // Bug #686 - the "Required field*" helper appears once a field has been
  // filled with a perfectly valid value, and never hides again.
  test('the "Required field*" helper hides after valid input @known-bug', async ({
    page,
  }) => {
    const signUp = new SignUpPage(page);
    const helper = page.getByText(/^Required field\*$/);

    await signUp.goto();
    const before = await helper.count();
    expect(before, "helper text should not be showing on a pristine form").toBe(
      0,
    );

    await signUp.firstName.fill("PerfectlyValidName");
    await page.waitForTimeout(2_000);

    expect(
      await helper.count(),
      'the "Required field*" helper appeared after valid input and did not hide (bug #686)',
    ).toBe(0);
  });

  test("an already-registered email cannot proceed @write", async ({
    page,
  }) => {
    const existing = process.env.FO_USERNAME;
    test.skip(
      !existing,
      "FO_USERNAME must be set to test duplicate registration.",
    );

    const signUp = new SignUpPage(page);
    await signUp.goto();
    await signUp.fillUserDetails({ email: existing! });
    await page.waitForTimeout(3_000);

    // The app blocks the duplicate by disabling Continue rather than showing an
    // error, so assert on that instead of clicking and waiting for a message.
    const blocked =
      !(await signUp.continueBtn.isEnabled()) ||
      (await page.getByText(/already|exists|registered/i).count()) > 0;

    expect(
      blocked,
      `registration allowed a duplicate address (${existing})`,
    ).toBe(true);
    await expect(signUp.companyName).toBeHidden();
  });
});
