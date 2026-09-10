import { expect, test } from '@playwright/test';
import { MANAGEMENT_SITE_URL } from '../../../fixtures/testConstants';
import ManagementLoginPage from '../../../pages/ManagementLoginPage';

test.describe('@meeting-video Management read-only flows', () => {
  test.setTimeout(3 * 60 * 1000);

  test.beforeEach(async ({ page }) => {
    await page.goto(`${MANAGEMENT_SITE_URL}/milo-ai-agents`, {
      waitUntil: 'domcontentloaded',
      timeout: 2 * 60 * 1000,
    });
    await new ManagementLoginPage(page).loginIfRequired();
  });

  test('Management loads without an authentication or server error', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(new URL(MANAGEMENT_SITE_URL).host));
    await expect(page.locator('body')).not.toContainText(
      /401\s*-\s*Unauthorized|invalid login|502 Bad Gateway|Internal Server Error|Application error/i,
    );
  });

  test('meeting navigation exposes Dashboard, Advertisers, Accounting, and Reports', async ({
    page,
  }) => {
    for (const section of ['Dashboard', 'Advertisers', 'Accounting', 'Reports']) {
      await expect(
        page.getByText(section, { exact: true }).first(),
        `${section} navigation is missing`,
      ).toBeVisible({ timeout: 30_000 });
    }
  });

  test('Milo AI Agents page does not produce failed API calls', async ({ page }) => {
    const failedApis: string[] = [];
    page.on('response', (response) => {
      if (/\/api\//i.test(response.url()) && response.status() >= 400) {
        failedApis.push(`${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    expect(failedApis, `Failed Management APIs:\n${failedApis.join('\n')}`).toEqual([]);
  });
});
