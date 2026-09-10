import { expect, test } from '@playwright/test';
import SignUpPage from '../../pages/FlexOffersSignUpPage';
import LoginPage from '../../pages/LoginPage';
import ManagementAdvertiserPage from '../../pages/ManagementAdvertiserPage';
import { PATHS } from '../../config/environment';
import { ADVERTISER_STATUSES } from '../../fixtures/onboardingData';
import { isMailboxAvailable, mailboxUnavailableReason, waitForVerificationMail } from '../../utility/mailbox';
import { dismissPaymentReminderIfPresent } from '../../utility/appActions';

/**
 * One-off: provision a fresh, verified, APPROVED advertiser and prove it can
 * sign in to the dashboard. Prints the credentials and screenshots the result.
 *
 * @write — creates and approves a real advertiser. Run on dev/staging only.
 */
test.describe('Onboarding - provision an approved test account @write', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(6 * 60 * 1000);
  test.skip(() => !isMailboxAvailable(), mailboxUnavailableReason());

  test('register -> verify -> approve -> sign in to dashboard', async ({ page }) => {
    // 1. Register
    const signUp = new SignUpPage(page);
    const advertiser = await signUp.registerNewAdvertiser();
    await expect(page.getByText(/thank you/i).first()).toBeVisible({ timeout: 60_000 });

    // 2. Verify via the real e-mail link
    const mail = await waitForVerificationMail(advertiser.email, { timeoutMs: 180_000 });
    await page.goto(mail.link, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(5_000);

    // 3. Approve in management
    const management = new ManagementAdvertiserPage(page);
    const advertiserId = await management.searchAndOpen(advertiser.companyName);
    await management.changeStatus(ADVERTISER_STATUSES.approved);
    const status = await (async () => {
      await management.openAdvertiserById(advertiserId);
      return management.readStatus();
    })();
    expect(
      ManagementAdvertiserPage.sameStatus(status, ADVERTISER_STATUSES.approved),
      `account was not approved (shows "${status}")`,
    ).toBe(true);

    // 4. Sign in as the advertiser and confirm the dashboard
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(advertiser.email, advertiser.password);
    await page.waitForTimeout(8_000);
    if (page.url().startsWith('chrome-error://')) {
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
      await page.waitForTimeout(4_000);
    }
    await dismissPaymentReminderIfPresent(page);

    await expect(page, 'approved account did not reach the dashboard').toHaveURL(
      new RegExp(PATHS.dashboard),
    );
    await page.screenshot({ path: 'docs/stage-screens/approved-account-dashboard.png', fullPage: true });

    console.log('\n==================  APPROVED TEST ACCOUNT  ==================');
    console.log(`  advertiser id : ${advertiserId}`);
    console.log(`  company       : ${advertiser.companyName}`);
    console.log(`  email         : ${advertiser.email}`);
    console.log(`  password      : ${advertiser.password}`);
    console.log(`  landed on     : ${page.url()}`);
    console.log('============================================================\n');
  });
});
