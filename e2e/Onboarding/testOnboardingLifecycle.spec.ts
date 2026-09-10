import { expect, test } from "@playwright/test";
import SignUpPage, {
  type CreatedAdvertiser,
} from "../../pages/FlexOffersSignUpPage";
import LoginPage from "../../pages/LoginPage";
import ManagementAdvertiserPage from "../../pages/ManagementAdvertiserPage";
import ManagementLoginPage from "../../pages/ManagementLoginPage";
import { PATHS } from "../../config/environment";
import {
  ADVERTISER_STATUSES,
  ONBOARDING_STAGES,
} from "../../fixtures/onboardingData";

/**
 * The advertiser onboarding journey, end to end across both portals:
 *
 *   register on the advertiser app
 *     -> the account exists but cannot sign in until it is verified
 *     -> it appears in the management portal
 *     -> management moves it through the onboarding stages
 *     -> a terminal status still keeps it out
 *
 * The tests run in order and share one freshly registered advertiser, because
 * each step depends on the record the previous step created.
 *
 * Everything here creates or mutates real records, so the whole file is @write
 * and is excluded from live runs automatically.
 */
test.describe("Onboarding - advertiser lifecycle @write", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(4 * 60 * 1000);

  let advertiser: CreatedAdvertiser;
  let advertiserId: string;

  test("a prospect can register and reaches the thank-you step @blocker @crud", async ({
    page,
  }) => {
    const signUp = new SignUpPage(page);
    advertiser = await signUp.registerNewAdvertiser();

    await expect(page.getByText(/thank you/i).first()).toBeVisible({
      timeout: 60_000,
    });
    console.log(`registered "${advertiser.companyName}" <${advertiser.email}>`);
  });

  test("the new account cannot sign in until it is verified @blocker @security", async ({
    page,
  }) => {
    expect(advertiser, "registration step did not complete").toBeTruthy();

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(advertiser.email, advertiser.password);
    await page.waitForTimeout(6_000);

    // An unverified account must be refused, and must say why.
    await expect(page).toHaveURL(new RegExp(`${PATHS.signin}/?$`, "i"));
    await expect(page.getByText(/needs to be verified/i)).toBeVisible();
    await expect(page).not.toHaveURL(new RegExp(PATHS.dashboard));
  });

  test("the new advertiser appears in the management portal @blocker", async ({
    page,
  }) => {
    expect(advertiser, "registration step did not complete").toBeTruthy();

    const management = new ManagementAdvertiserPage(page);
    await management.openOverview();
    await new ManagementLoginPage(page).assertAuthenticated();

    advertiserId = await management.searchAndOpen(advertiser.companyName);
    expect(advertiserId, "no advertiser id in the detail URL").toMatch(/^\d+$/);

    const status = await management.readStatus();
    console.log(`advertiser ${advertiserId} initial status: "${status}"`);
    expect(
      status,
      "a newly registered advertiser should have a status",
    ).not.toBe("");
  });

  test("management can move the advertiser through the onboarding stages @crud", async ({
    page,
  }) => {
    expect(
      advertiserId,
      "the advertiser was not located in management",
    ).toBeTruthy();

    const management = new ManagementAdvertiserPage(page);
    await management.openAdvertiserById(advertiserId);

    const offered = await management
      .openChangeStatusDialog()
      .then(() => management.availableStatuses());
    console.log(
      `statuses offered from the initial state: ${offered.join(", ")}`,
    );
    await management.statusDialogClose.click();

    const reachable = ONBOARDING_STAGES.filter((stage) =>
      offered.includes(stage),
    );
    test.skip(
      reachable.length === 0,
      `management offered no onboarding stage to move to (offered: ${offered.join(
        ", ",
      )})`,
    );

    for (const stage of reachable) {
      await management.openAdvertiserById(advertiserId);
      await management.changeStatus(stage);

      await management.openAdvertiserById(advertiserId);
      const status = await management.readStatus();
      expect(
        ManagementAdvertiserPage.sameStatus(status, stage),
        `management did not persist the change to "${stage}" (detail shows "${status}")`,
      ).toBe(true);
      console.log(`moved advertiser ${advertiserId} to "${stage}"`);
    }
  });

  test("a declined advertiser is still kept out of the portal @security", async ({
    page,
  }) => {
    expect(
      advertiserId,
      "the advertiser was not located in management",
    ).toBeTruthy();

    const management = new ManagementAdvertiserPage(page);
    await management.openAdvertiserById(advertiserId);
    await management.openChangeStatusDialog();
    const offered = await management.availableStatuses();
    await management.statusDialogClose.click();

    test.skip(
      !offered.includes(ADVERTISER_STATUSES.declined),
      `"Declined" was not offered from the current state (offered: ${offered.join(
        ", ",
      )})`,
    );

    await management.openAdvertiserById(advertiserId);
    await management.changeStatus(ADVERTISER_STATUSES.declined);

    await management.openAdvertiserById(advertiserId);
    const declinedStatus = await management.readStatus();
    expect(
      ManagementAdvertiserPage.sameStatus(
        declinedStatus,
        ADVERTISER_STATUSES.declined,
      ),
      `management shows "${declinedStatus}" after declining`,
    ).toBe(true);

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(advertiser.email, advertiser.password);
    await page.waitForTimeout(6_000);

    await expect(
      page,
      "a declined advertiser reached the dashboard",
    ).not.toHaveURL(new RegExp(PATHS.dashboard));
  });
});
