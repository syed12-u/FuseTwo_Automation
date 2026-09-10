import { expect, test } from '@playwright/test';
import ManagementLoginPage from '../../../pages/ManagementLoginPage';
import { MANAGEMENT_SITE_URL } from '../../../fixtures/testConstants';

test.describe.skip('@ticket-371 Programs API for Advertiser Details', () => {
  test.setTimeout(5 * 60 * 1000);

  test('Control loads and exposes the Advertiser Details Programs workflow', async ({ page }) => {
    await test.step('Open the Control site and authenticate', async () => {
      await page.goto(`${MANAGEMENT_SITE_URL}/milo-ai-agents`, {
        waitUntil: 'domcontentloaded',
        timeout: 2 * 60 * 1000,
      });
      await new ManagementLoginPage(page).loginIfRequired();
      await expect(page).toHaveURL(new RegExp(new URL(MANAGEMENT_SITE_URL).host), {
        timeout: 2 * 60 * 1000,
      });
      await expect(page.locator('body')).not.toContainText(
        /502 Bad Gateway|Internal Server Error|Application error/i,
      );
    });

    await test.step('Open Advertiser Details, Users, and Programs', async () => {
      const advertisers = page
        .locator('a:visible, button:visible')
        .filter({ hasText: /^Advertisers$/i })
        .first();
      await expect(advertisers).toBeVisible({ timeout: 60_000 });
      await advertisers.click();

      const overview = page
        .locator('a:visible, button:visible')
        .filter({ hasText: /^Overview$/i })
        .first();
      await expect(overview).toBeVisible({ timeout: 60_000 });
      await overview.click();

      const advertiserRow = page.locator('tbody tr').first();
      await expect(advertiserRow, 'No advertiser was available in Overview').toBeVisible({
        timeout: 60_000,
      });
      await advertiserRow.click();

      const details = page
        .locator('a:visible, button:visible, [role="tab"]:visible')
        .filter({ hasText: /^Details$/i })
        .first();
      await expect(details, 'A visible Details control was not found').toBeVisible({
        timeout: 60_000,
      });
      await details.click();

      const users = page
        .locator('a:visible, button:visible, [role="tab"]:visible')
        .filter({ hasText: /^Users?$/i })
        .first();
      await expect(users, 'The Users section did not appear after opening Details').toBeVisible({
        timeout: 60_000,
      });
      await users.click();

      const programs = page
        .locator('a:visible, button:visible, [role="tab"]:visible')
        .filter({ hasText: /^Programs$/i })
        .first();
      await expect(programs, 'The Programs tab did not appear').toBeVisible({
        timeout: 60_000,
      });

      const programsResponsePromise = page.waitForResponse(
        (response) =>
          /\/api\/.*program/i.test(response.url()) &&
          response.request().method() === 'GET',
        { timeout: 60_000 },
      );
      await programs.click();

      const programsResponse = await programsResponsePromise;
      expect(
        programsResponse.status(),
        `Programs API returned HTTP ${programsResponse.status()}: ${programsResponse.url()}`,
      ).toBeLessThan(400);
      expect(
        programsResponse.headers()['content-type'] ?? '',
        'Programs API should return JSON',
      ).toContain('application/json');
      await expect(programsResponse.json()).resolves.not.toBeNull();

      await expect(page.locator('body')).not.toContainText(
        /502 Bad Gateway|Internal Server Error|Application error/i,
      );
    });
  });
});
