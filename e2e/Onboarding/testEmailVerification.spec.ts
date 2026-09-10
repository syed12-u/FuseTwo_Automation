import { expect, test } from "@playwright/test";
import SignUpPage, {
  type CreatedAdvertiser,
} from "../../pages/FlexOffersSignUpPage";
import LoginPage from "../../pages/LoginPage";
import ManagementAdvertiserPage from "../../pages/ManagementAdvertiserPage";
import { PATHS } from "../../config/environment";
import {
  isMailboxAvailable,
  mailboxBackend,
  mailboxUnavailableReason,
  waitForVerificationMail,
} from "../../utility/mailbox";
import {
  ADVERTISER_STATUSES,
  ONBOARDING_STAGES,
  STAGE_LANDING,
} from "../../fixtures/onboardingData";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Registration through to a working sign-in, using the real QA mailbox.
 *
 * This is what unlocks "what does the advertiser see at each onboarding
 * status?": a brand new account cannot sign in until it is verified, and the
 * verification link only exists in the e-mail.
 *
 * Skips with a clear reason when mailbox access is not configured, rather than
 * passing and giving the impression the flow was covered.
 */
test.describe("Onboarding - email verification and per-stage access @write", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(6 * 60 * 1000);

  test.skip(() => !isMailboxAvailable(), mailboxUnavailableReason());

  let advertiser: CreatedAdvertiser;
  let advertiserId: string;
  let verified = false;

  test("the verification email arrives and carries a single verification link @blocker", async ({
    page,
  }) => {
    const signUp = new SignUpPage(page);
    advertiser = await signUp.registerNewAdvertiser();
    await expect(page.getByText(/thank you/i).first()).toBeVisible({
      timeout: 60_000,
    });
    console.log(`registered ${advertiser.email}`);

    console.log(`reading the mailbox via the "${mailboxBackend()}" backend`);
    const mail = await waitForVerificationMail(advertiser.email, {
      timeoutMs: 180_000,
    });

    console.log(`mail received: "${mail.subject}" at ${mail.receivedTime}`);
    console.log(`verification link: ${mail.link.slice(0, 120)}...`);

    expect(mail.to.toLowerCase()).toContain(advertiser.email.toLowerCase());
    expect(mail.link, "no verification link in the e-mail").toMatch(
      /^https?:\/\//,
    );
  });

  test("following the verification link lets the advertiser sign in @blocker @crud", async ({
    page,
  }) => {
    expect(advertiser, "registration step did not complete").toBeTruthy();

    const mail = await waitForVerificationMail(advertiser.email, {
      timeoutMs: 180_000,
    });

    // The link is a HubSpot tracking redirect, so following it is what lands on
    // the advertiser host; it cannot be matched against the app domain up front.
    await page.goto(mail.link, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(6_000);
    console.log(`verification link resolved to ${page.url()}`);

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(advertiser.email, advertiser.password);
    await page.waitForTimeout(8_000);

    // Verification must clear the "needs to be verified" gate.
    await expect(page.getByText(/needs to be verified/i)).toBeHidden();
    verified = true;
    console.log(`after verification the account landed on ${page.url()}`);
  });

  test("management can locate the verified advertiser @blocker", async ({
    page,
  }) => {
    expect(verified, "verification step did not complete").toBe(true);

    const management = new ManagementAdvertiserPage(page);
    advertiserId = await management.searchAndOpen(advertiser.companyName);
    const status = await management.readStatus();
    console.log(
      `advertiser ${advertiserId} status after verification: "${status}"`,
    );
    expect(advertiserId).toMatch(/^\d+$/);
  });

  /**
   * The heart of the request: for every onboarding status, record what the
   * advertiser actually gets when signing in. Each stage asserts only what is
   * safe to assert (no server error, and a terminal status keeps them out); the
   * landing URL is logged so the expected behaviour per stage can be agreed and
   * then tightened into real assertions.
   */
  for (const stage of [...ONBOARDING_STAGES, ADVERTISER_STATUSES.approved]) {
    test(`a verified advertiser at "${stage}" can sign in @crud`, async ({
      page,
    }) => {
      expect(
        advertiserId,
        "the advertiser was not located in management",
      ).toBeTruthy();

      const management = new ManagementAdvertiserPage(page);
      await management.openAdvertiserById(advertiserId);
      await management.changeStatus(stage);

      await management.openAdvertiserById(advertiserId);
      const status = await management.readStatus();
      expect(
        ManagementAdvertiserPage.sameStatus(status, stage),
        `management did not persist "${stage}" (shows "${status}")`,
      ).toBe(true);

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(advertiser.email, advertiser.password);
      await page.waitForTimeout(8_000);

      // A cross-navigation during sign-in occasionally surfaces a transient
      // chrome-error page; reload settles it before the URL is asserted.
      if (page.url().startsWith("chrome-error://")) {
        await page
          .reload({ waitUntil: "domcontentloaded" })
          .catch(() => undefined);
        await page.waitForTimeout(4_000);
      }
      await dismissPaymentReminderIfPresent(page);

      console.log(`status "${stage}" -> advertiser landed on ${page.url()}`);

      await expect(page.locator("body")).not.toContainText(
        /502 Bad Gateway|Internal Server Error|Application error/i,
      );

      // Only "Approved" grants the dashboard; every other stage routes to its
      // own gate page. These landing paths were captured on dev on 2026-08-24.
      const expectedLanding = STAGE_LANDING[stage];
      if (expectedLanding) {
        await expect(
          page,
          `"${stage}" should land on ${expectedLanding}`,
        ).toHaveURL(expectedLanding);
      }
      if (stage !== ADVERTISER_STATUSES.approved) {
        await expect(
          page,
          `"${stage}" must not reach the dashboard`,
        ).not.toHaveURL(new RegExp(PATHS.dashboard));
      }
    });
  }

  test(`a deactivated advertiser cannot sign in @security`, async ({
    page,
  }) => {
    expect(
      advertiserId,
      "the advertiser was not located in management",
    ).toBeTruthy();

    const management = new ManagementAdvertiserPage(page);
    await management.openAdvertiserById(advertiserId);
    await management.changeStatus(ADVERTISER_STATUSES.deactivated);

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(advertiser.email, advertiser.password);
    await page.waitForTimeout(8_000);

    await expect(
      page,
      "a deactivated advertiser reached the dashboard",
    ).not.toHaveURL(new RegExp(PATHS.dashboard));
  });
});
