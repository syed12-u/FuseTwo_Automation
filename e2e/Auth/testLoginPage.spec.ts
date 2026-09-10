import { expect, test } from '@playwright/test';
import LoginPage, { LOGIN_API_PATH } from '../../pages/LoginPage';
import AppShellPage from '../../pages/AppShellPage';
import { env, PATHS, appUrl, requireAdvertiserCredentials } from '../../config/environment';
import {
  CREDENTIAL_LEAK_KEYS,
  LOGIN_INVALID_CREDENTIALS_MESSAGE,
} from '../../fixtures/testConstants';
import {
  dismissPaymentReminderIfPresent,
  expectRedirectToSignin,
} from '../../utility/appActions';

// These specs drive sign-in themselves, so they must start signed out. The
// chromium project sets no storageState, which keeps every context anonymous.

const WRONG_PASSWORD = 'DefinitelyNotThePassword!987';
const UNKNOWN_EMAIL = 'no-such-advertiser-9f3a1c@fusetwo.com';

test.describe('Authentication - Login page', () => {
  test('renders the complete sign-in form with usable controls @blocker @smoke', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(loginPage.loginEmailField).toBeVisible();
    await expect(loginPage.loginEmailField).toBeEditable();
    await expect(loginPage.loginPasswordField).toBeVisible();
    await expect(loginPage.loginPasswordField).toBeEditable();
    await expect(loginPage.loginPasswordField).toHaveAttribute('type', 'password');
    await expect(loginPage.loginButton).toBeVisible();
    await expect(loginPage.loginButton).toBeEnabled();
    await expect(loginPage.forgotPasswordLink).toBeVisible();
  });

  test('does not expose a password after it is entered', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.loginPasswordField.fill('password-display-check');

    await expect(loginPage.loginPasswordField).toHaveAttribute('type', 'password');
  });

  test('valid credentials sign in and land on the dashboard @blocker @smoke', async ({ page }) => {
    const { username, password } = requireAdvertiserCredentials();
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    const response = await loginPage.loginCapturingApiResponse(username, password);

    expect(response.status(), `${LOGIN_API_PATH} rejected valid credentials`).toBe(200);
    await page.waitForURL(new RegExp(`${PATHS.dashboard}/?$`));
    await expect(page).not.toHaveURL(/\/signin/i);
    await expect(loginPage.errorBanner).toBeHidden();
  });

  test('rejects a wrong password and grants no session @blocker', async ({ page }) => {
    const { username } = requireAdvertiserCredentials();
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    const response = await loginPage.loginCapturingApiResponse(username, WRONG_PASSWORD);

    expect(response.status(), 'a wrong password must not return 200').toBe(400);
    await expect(loginPage.errorBanner).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${PATHS.signin}/?$`, 'i'));

    // The real check: no session was established, so a protected route still
    // bounces back to sign-in. A visible error alone does not prove that.
    await expectRedirectToSignin(page, PATHS.dashboard);
  });

  test('gives the same message for an unknown email as for a wrong password @blocker @security', async ({
    page,
  }) => {
    const { username } = requireAdvertiserCredentials();
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.loginCapturingApiResponse(username, WRONG_PASSWORD);
    await expect(loginPage.errorBanner).toBeVisible();
    const wrongPasswordMessage = (await loginPage.errorBanner.innerText()).trim();

    await loginPage.goto();
    await loginPage.loginCapturingApiResponse(UNKNOWN_EMAIL, WRONG_PASSWORD);
    await expect(loginPage.errorBanner).toBeVisible();
    const unknownEmailMessage = (await loginPage.errorBanner.innerText()).trim();

    // Differing messages would let an attacker enumerate valid accounts.
    expect(
      unknownEmailMessage,
      'an unknown email must not be distinguishable from a wrong password',
    ).toBe(wrongPasswordMessage);
    expect(wrongPasswordMessage).toContain(LOGIN_INVALID_CREDENTIALS_MESSAGE);
  });

  test('flags both fields as required when the form is submitted empty @blocker', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    let loginRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes(LOGIN_API_PATH) && request.method() === 'POST') {
        loginRequests += 1;
      }
    });

    await loginPage.submitEmpty();

    // One message for email, one for password.
    await expect(loginPage.requiredFieldMessages).toHaveCount(2);
    await expect(page).toHaveURL(new RegExp(`${PATHS.signin}/?$`, 'i'));
    expect(loginRequests, 'an empty form must not reach the sign-in endpoint').toBe(0);
  });

  test('sign-in response never carries a password or security answer @blocker @security', async ({
    page,
  }) => {
    const { username, password } = requireAdvertiserCredentials();
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    const response = await loginPage.loginCapturingApiResponse(username, password);

    expect(response.status()).toBe(200);

    // Sanity check that the request really did carry the password, otherwise
    // the assertion below would pass for the wrong reason.
    expect(response.request().postData() ?? '').toContain('Password');

    const body = (await response.text()).toLowerCase();
    for (const key of CREDENTIAL_LEAK_KEYS) {
      expect(body, `${LOGIN_API_PATH} response leaked "${key}" (see bug #682)`).not.toContain(key);
    }
  });

  test('logging out clears the session and locks protected routes @blocker', async ({ page }) => {
    const { username, password } = requireAdvertiserCredentials();
    const loginPage = new LoginPage(page);
    const shell = new AppShellPage(page);

    await loginPage.goto();
    await loginPage.login(username, password);
    await page.waitForURL(new RegExp(`${PATHS.dashboard}/?$`));
    await dismissPaymentReminderIfPresent(page);

    await shell.logout();
    await expect(page).toHaveURL(new RegExp(`${PATHS.signin}/?$`, 'i'));
    // Let the sign-out redirect finish before navigating again.
    await expect(loginPage.loginEmailField).toBeVisible();

    // The session must really be gone, not just navigated away from.
    await expectRedirectToSignin(page, PATHS.dashboard);
  });

  // Kept separate from the logout blocker above: the session is genuinely
  // cleared (a direct hit on /app/dashboard redirects), but pressing Back can
  // still repaint the previous dashboard from the browser's back-forward cache
  // without re-running the route guard. That leaves account data on screen
  // after sign-out on a shared machine, so it is tracked as a security issue
  // rather than a release blocker.
  //
  // Observed 2026-08-20: passes on dev, fails on staging (advertiserstg).
  test('the back button does not repaint the dashboard after logout @security', async ({ page }) => {
    const { username, password } = requireAdvertiserCredentials();
    const loginPage = new LoginPage(page);
    const shell = new AppShellPage(page);

    await loginPage.goto();
    await loginPage.login(username, password);
    await page.waitForURL(new RegExp(`${PATHS.dashboard}/?$`));
    await dismissPaymentReminderIfPresent(page);

    await shell.logout();
    await expect(loginPage.loginEmailField).toBeVisible();

    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {
      // A client-side guard may cancel the history navigation; the assertion
      // below decides whether the dashboard came back.
    });

    await expect(
      page,
      'pressing Back after logout must not return to the dashboard',
    ).not.toHaveURL(new RegExp(`${PATHS.dashboard}/?$`));
  });
});

test.describe('Authentication - environment wiring', () => {
  test('the suite is pointed at the environment it was asked for @smoke', async ({ page }) => {
    const response = await page.goto(env.signinUrl, { waitUntil: 'domcontentloaded' });

    expect(response?.status(), `${env.signinUrl} did not serve the sign-in page`).toBeLessThan(400);
    expect(new URL(page.url()).origin).toBe(env.appBaseUrl);
  });
});
