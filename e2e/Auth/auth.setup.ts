import { test as setup, expect, Page } from "@playwright/test";
import LoginPage from "../../pages/LoginPage";
import {
  AUTH_FILE,
  PATHS,
  env,
  requireAdvertiserCredentials,
} from "../../config/environment";
import { acceptTermsIfPresent } from "../../utility/appActions";

setup(
  `Authenticate With Advertiser Max Login (${env.name})`,
  async ({ page }) => {
    const { username, password } = requireAdvertiserCredentials();

    const loginPage = new LoginPage(page);
    await loginPage.navigateTo(env.signinUrl);
    await loginPage.login(username, password);

    // Leaving /signin for an authenticated page is the proof the session is real.
    // The exact landing page depends on the account's onboarding status — an
    // approved account lands on /app/dashboard, but one in "Initial Setup" lands
    // on /app/settings/advertisersetup, one in "Collect Payment" on
    // /account/collect-payment, etc. Waiting strictly for the dashboard would
    // break whenever the shared test account is not fully approved, so wait for
    // "no longer on signin" and confirm the app shell rendered instead.
    await page.waitForURL((url) => !/\/signin/i.test(url.pathname), {
      timeout: 90_000,
    });
    await expect(page).not.toHaveURL(new RegExp(PATHS.signin, "i"));
    await expect(page.getByText(/needs to be verified/i)).toHaveCount(0);

    // Accept the Terms modal once here; until it is accepted it covers every
    // page and hides the app from role-based locators in every suite.
    await acceptTermsIfPresent(page);

    await page.context().storageState({ path: AUTH_FILE });
  },
);
