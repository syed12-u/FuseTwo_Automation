import { Page, Locator, expect } from "@playwright/test";
import BasePage from "./BasePage";
import {
  PASSWORD,
  SECURITY_ANSWER,
  PHONE_NUMBER,
  ZIP_CODE,
} from "../fixtures/testConstants";
import {
  uniqueCompanyName,
  uniqueSignupEmail,
} from "../fixtures/onboardingData";
import { appUrl, PATHS } from "../config/environment";

/** Everything the suite needs to act on the account it just created. */
export interface CreatedAdvertiser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  websiteUrl: string;
}

/** What step 1 typed in, so a test can assert the form kept it. */
export interface UserDetails
  extends Pick<CreatedAdvertiser, "email" | "password" | "firstName" | "lastName"> {
  /** The option text chosen in the Security Question dropdown. */
  securityQuestion: string;
  securityAnswer: string;
}

/** What step 2 typed in, so a test can assert the form kept it. */
export interface CompanyDetails
  extends Pick<CreatedAdvertiser, "companyName" | "websiteUrl"> {
  address: string;
  /** The option text chosen in the Country dropdown. */
  country: string;
  city: string;
  /** The option text chosen in the State dropdown. */
  state: string;
  zip: string;
  phone: string;
}

/**
 * Validation text the signup form shows under a mismatched confirmation
 * field (captured on staging 2026-09-24).
 */
export const SIGNUP_VALIDATION = {
  emailMismatch: "Email addresses must match.",
  passwordMismatch: "Passwords must match.",
} as const;

export default class SignUpPage extends BasePage {
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly email: Locator;
  readonly confirmEmail: Locator;
  readonly password: Locator;
  readonly confirmPassword: Locator;
  readonly securityQuestion: Locator;
  readonly securityAnswer: Locator;
  readonly captcha: Locator;
  readonly captchaCanvas: Locator;
  readonly continueBtn: Locator;
  readonly confirmEmailError: Locator;
  readonly confirmPasswordError: Locator;

  readonly companyName: Locator;
  readonly websiteUrl: Locator;
  readonly address: Locator;
  readonly country: Locator;
  readonly city: Locator;
  readonly state: Locator;
  readonly zip: Locator;
  readonly phone: Locator;
  readonly advertisingAgency: Locator;
  readonly agencyUrl: Locator;
  readonly promoCode: Locator;
  readonly platform: Locator;
  readonly platformName: Locator;
  readonly affiliate: Locator;
  readonly affiliateNetwork: Locator;
  readonly approvedPublishers: Locator;
  readonly saveAndFinishLaterBtn: Locator;
  readonly submitBtn: Locator;

  readonly successMessage: Locator;
  readonly requiredFieldMessages: Locator;

  constructor(page: Page) {
    super(page);

    this.firstName = page.locator('input[name="firstName"]');
    this.lastName = page.locator('input[name="lastName"]');
    this.email = page.locator('input[name="emailAddress"]');
    this.confirmEmail = page.locator('input[name="confirmEmailAddress"]');
    this.password = page.locator('input[name="password"]');
    this.confirmPassword = page.locator('input[name="confirmPassword"]');
    this.securityQuestion = page.locator('input[name="securityQuestion"]');
    this.securityAnswer = page.locator('input[name="securityAnswer"]');
    this.captcha = page.locator('input[name="captcha"]');
    this.captchaCanvas = page.locator("canvas").first();
    this.continueBtn = page.getByRole("button", { name: "Continue" });
    // MUI renders the validation message as a <p class="Mui-error"> helper
    // inside the same form control as the input, and flags the input with
    // aria-invalid="true".
    this.confirmEmailError = this.fieldError("confirmEmailAddress");
    this.confirmPasswordError = this.fieldError("confirmPassword");

    // Step 2 field names as the app actually renders them: website (not
    // websiteUrl), address1 (not address), zipCode (not zip). The dropdowns are
    // text inputs with a combobox role, so they are addressed by name too.
    this.companyName = page.locator('input[name="companyName"]');
    this.websiteUrl = page.locator('input[name="website"]');
    this.address = page.locator('input[name="address1"]');
    this.country = page.locator('input[name="country"]');
    this.city = page.locator('input[name="city"]');
    this.state = page.locator('input[name="state"]');
    this.zip = page.locator('input[name="zipCode"]');
    this.phone = page.locator('input[name="phone"]');
    this.advertisingAgency = page.locator('input[name="agencyQuestion"]');
    // Shown only when the agency answer is "Yes".
    this.agencyUrl = page.locator('input[name="agencyUrl"]');
    this.promoCode = page.locator('input[name="promoCode"]');
    this.platform = page.locator('input[name="websitePlatform"]');
    // Shown only when the platform is "Other".
    this.platformName = page.locator('input[name="websitePlatformName"]');
    // Step 3 - "Do you currently have an affiliate program?"
    this.affiliate = page.locator('input[name="IsUsingAnotherNetwork"]');
    this.affiliateNetwork = page.locator('input[name="Networks"]');
    this.approvedPublishers = page.locator('input[name="ApprovedPublishers"]');
    this.saveAndFinishLaterBtn = page.getByRole("button", {
      name: /Save & finish later/i,
    });

    this.submitBtn = page.getByRole("button", { name: "Save & Submit" });
    this.successMessage = page.getByRole("heading");
    this.requiredFieldMessages = page.getByText(/required field/i);
  }

  async goto() {
    await this.navigateTo(appUrl(PATHS.signup));
    await expect(this.firstName).toBeVisible();
  }

  /** The error helper text shown under the input with the given name. */
  fieldError(inputName: string): Locator {
    return this.page.locator(
      `.MuiFormControl-root:has(input[name="${inputName}"]) p.MuiFormHelperText-root.Mui-error`,
    );
  }

  /**
   * Read the expected CAPTCHA answer.
   *
   * The CAPTCHA is drawn into a <canvas>, so its characters are not in the DOM,
   * and a fixed value cannot work because the string is regenerated on every
   * page load (observed: "%YXJj", "7GjQm", "L7FT1" on three consecutive loads).
   * The generated answer does live in the React component state, reachable via
   * the fiber attached to the canvas, so the test solves the CAPTCHA using the
   * same value the page itself validates against.
   *
   * Returns null when it cannot be located, so callers fail with a clear
   * message instead of silently submitting a wrong answer.
   */
  async readCaptchaAnswer(): Promise<string | null> {
    await expect(this.captchaCanvas).toBeVisible();

    // The canvas mounts slightly before the component state holding the answer
    // is populated, so a single read intermittently comes back empty. Poll for
    // up to ~30s before giving up (a loaded machine has needed more than the
    // original 15s).
    for (let attempt = 0; attempt < 60; attempt++) {
      const answer = await this.extractCaptchaAnswer();
      if (answer) return answer;
      await this.page.waitForTimeout(500);
    }
    console.log(
      `CAPTCHA answer not found; page state: ${JSON.stringify(
        await this.describeCaptchaState(),
      )}`,
    );
    return null;
  }

  private async extractCaptchaAnswer(): Promise<string | null> {
    return this.page.evaluate(() => {
      // Every canvas is examined (a late-loading widget can insert one ahead
      // of the CAPTCHA), and both React fiber trees are read: the DOM node
      // keeps a reference to the fiber that created it, which may be the
      // stale "alternate" after a re-render.
      const canvases = Array.from(document.querySelectorAll("canvas"));
      if (canvases.length === 0) return null;

      // Collect every five-character string held in the surrounding component
      // state. React's own generated element ids (_r_3_) are the same length,
      // so they are filtered out; the CAPTCHA is then the most frequently
      // repeated remaining candidate.
      const counts = new Map<string, number>();

      const collect = (fiber: any) => {
        let hook = fiber?.memoizedState;
        for (let i = 0; hook && i < 20; i++) {
          const value = hook.memoizedState;
          if (
            typeof value === "string" &&
            value.length === 5 &&
            !/^_r_.*_$/.test(value)
          ) {
            counts.set(value, (counts.get(value) ?? 0) + 1);
          }
          hook = hook.next;
        }
      };

      for (const canvas of canvases) {
        let node: Element | null = canvas;
        for (
          let depth = 0;
          node && depth < 10;
          depth++, node = node.parentElement
        ) {
          const fiberKey = Object.keys(node).find((k) =>
            k.startsWith("__reactFiber$"),
          );
          if (!fiberKey) continue;

          let fiber = (node as unknown as Record<string, any>)[fiberKey];
          for (let up = 0; fiber && up < 15; up++) {
            collect(fiber);
            collect(fiber.alternate);
            fiber = fiber.return;
          }
        }
      }

      let best: string | null = null;
      let bestCount = 0;
      for (const [value, count] of counts) {
        if (count > bestCount) {
          best = value;
          bestCount = count;
        }
      }
      return best;
    });
  }

  /** Diagnostics for the failure message when the CAPTCHA cannot be read. */
  private async describeCaptchaState(): Promise<Record<string, unknown>> {
    return this.page
      .evaluate(() => ({
        url: location.href,
        canvases: Array.from(document.querySelectorAll("canvas")).map(
          (c) => `${c.width}x${c.height}`,
        ),
        dialogs: Array.from(document.querySelectorAll('[role="dialog"]')).map(
          (d) => (d.textContent ?? "").trim().slice(0, 80),
        ),
        bodyStart: (document.body.innerText ?? "")
          .replace(/\s+/g, " ")
          .slice(0, 200),
      }))
      .catch((e) => ({ error: String(e) }));
  }

  async fillCaptcha(): Promise<string> {
    const answer = await this.readCaptchaAnswer();
    if (!answer) {
      throw new Error(
        "Could not read the CAPTCHA answer from the signup page. The component may have " +
          "changed - re-check how the generated value is stored (pages/FlexOffersSignUpPage.ts).",
      );
    }
    await this.captcha.fill(answer);
    return answer;
  }

  /**
   * Step 1. Returns the identity of the account being created plus every value
   * typed, so the caller can assert the form kept them.
   *
   * `confirmEmail` / `confirmPassword` default to the real values; pass a
   * different one to drive the mismatch validation.
   */
  async fillUserDetails(
    overrides: Partial<
      Pick<CreatedAdvertiser, "email" | "firstName" | "lastName">
    > & { confirmEmail?: string; confirmPassword?: string } = {},
  ): Promise<UserDetails> {
    const email = overrides.email ?? uniqueSignupEmail();
    const firstName = overrides.firstName ?? "QAauto";
    const lastName = overrides.lastName ?? "Tester";

    await this.firstName.fill(firstName);
    await this.lastName.fill(lastName);
    await this.email.fill(email);
    await this.confirmEmail.fill(overrides.confirmEmail ?? email);
    await this.password.fill(PASSWORD);
    await this.confirmPassword.fill(overrides.confirmPassword ?? PASSWORD);

    const securityQuestion = await this.chooseSecurityQuestion();
    await this.securityAnswer.fill(SECURITY_ANSWER);

    await this.fillCaptcha();

    return {
      email,
      password: PASSWORD,
      firstName,
      lastName,
      securityQuestion,
      securityAnswer: SECURITY_ANSWER,
    };
  }

  /**
   * Pick the first security question and return its text. The dropdown is an
   * MUI Autocomplete, so the chosen option text becomes the input's value.
   */
  async chooseSecurityQuestion(): Promise<string> {
    await this.securityQuestion.click();
    const option = this.page.locator('li[role="option"]').first();
    const text = (await option.textContent())?.trim() ?? "";
    await option.click();
    return text;
  }

  async continueToCompanyStep() {
    await this.continueBtn.click();
    await expect(this.companyName).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Step 2. Returns the company identity used to find the record later, plus
   * every address value typed so the caller can assert the form kept them.
   */
  async fillCompanyDetails(
    overrides: Partial<Pick<CreatedAdvertiser, "companyName" | "websiteUrl">> & {
      /** "Yes" reveals the brands-represented URL field. */
      agency?: "Yes" | "No";
      agencyUrl?: string;
      promoCode?: string;
      /** "Other" reveals the free-text Platform Name field. */
      platform?: string;
      platformName?: string;
    } = {},
  ): Promise<CompanyDetails> {
    const companyName = overrides.companyName ?? uniqueCompanyName();
    const websiteUrl =
      overrides.websiteUrl ??
      `https://www.qa-${Math.random().toString(36).slice(2, 8)}.com`;
    const address = "1234 Test Street";
    const city = "Lake";
    const state = "Alaska";

    await this.companyName.fill(companyName);
    await this.websiteUrl.fill(websiteUrl);
    await this.address.fill(address);

    // Country and State are MUI Autocompletes: the option text becomes the
    // input value, so it is captured here for the caller to assert on.
    await this.country.click();
    const countryOption = this.page.locator('li[role="option"]').first();
    const country = (await countryOption.textContent())?.trim() ?? "";
    await countryOption.click();

    await this.city.fill(city);

    await this.state.click();
    await this.page.getByRole("option", { name: state }).click();

    await this.zip.fill(ZIP_CODE);
    await this.phone.fill(PHONE_NUMBER);

    const agency = overrides.agency ?? "No";
    await this.advertisingAgency.click();
    await this.page.getByRole("option", { name: agency, exact: true }).click();
    if (agency === "Yes") {
      await expect(this.agencyUrl).toBeVisible();
      await this.agencyUrl.fill(overrides.agencyUrl ?? websiteUrl);
    }

    if (overrides.promoCode) await this.promoCode.fill(overrides.promoCode);

    const platform = overrides.platform ?? "WordPress.org";
    await this.platform.click();
    await this.page.getByRole("option", { name: platform, exact: true }).click();
    if (platform === "Other") {
      await expect(this.platformName).toBeVisible();
      await this.platformName.fill(overrides.platformName ?? "QA custom platform");
    }

    return {
      companyName,
      websiteUrl,
      address,
      country,
      city,
      state,
      zip: ZIP_CODE,
      phone: PHONE_NUMBER,
    };
  }

  /**
   * Step 3 - "Do you currently have an affiliate program?".
   *
   * Answering "No" is what the page itself instructs when the advertiser is not
   * coming from another network; the remaining two dropdowns then no longer
   * need answering before Save & Submit.
   */
  async fillProgramDetails() {
    await this.continueBtn.click();
    await expect(this.affiliate).toBeVisible({ timeout: 30_000 });
    await this.affiliate.click();
    await this.page
      .getByRole("option", { name: "No", exact: true })
      .first()
      .click();
  }

  async submitForm() {
    await this.submitBtn.click();
  }

  /** The whole registration, returning everything needed to act on the account. */
  async registerNewAdvertiser(): Promise<CreatedAdvertiser> {
    await this.goto();
    const user = await this.fillUserDetails();
    await this.continueToCompanyStep();
    const company = await this.fillCompanyDetails();
    await this.fillProgramDetails();
    await this.submitForm();
    return { ...user, ...company };
  }
}
