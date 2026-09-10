import { expect, test } from '@playwright/test';
import { AUTH_FILE } from '../../config/environment';

const authFile = AUTH_FILE;

function appUrl(path: string) {
  if (!process.env.URL) {
    throw new Error('URL must be configured before running the executive regression suite.');
  }
  return new URL(path, process.env.URL).toString();
}

test.describe('@executive @regression detailed feature surfaces', () => {
  test.use({ storageState: authFile });

  test('Programs exposes its listing and program creation entry point', async ({ page }) => {
    await page.goto(appUrl('/app/programs'));

    await expect(page.getByRole('button', { name: 'Add Program' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Internal Server Error|Application error/i);
  });

  test('Creatives exposes text-link and banner workflows', async ({ page }) => {
    await page.goto(appUrl('/app/creatives'));

    await expect(page.getByRole('button', { name: 'Add Text Link' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Banner' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Internal Server Error|Application error/i);
  });

  test('Products exposes setup, import, and management areas', async ({ page }) => {
    await page.goto(appUrl('/app/products'));

    for (const tabName of ['SETUP', 'IMPORT', 'MANAGE']) {
      await expect(page.getByRole('tab', { name: tabName })).toBeVisible();
    }
    await expect(page.locator('body')).not.toContainText(/Internal Server Error|Application error/i);
  });

  test('Reconcile Sales exposes data and safe operational controls', async ({ page }) => {
    await page.goto(appUrl('/app/accounting/reconcile'));

    await expect(page.getByRole('button', { name: 'ADD NEW' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'API RECONCILE' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('Performance report exposes filters and report actions', async ({ page }) => {
    await page.goto(appUrl('/app/reports/performance'));

    await expect(page.locator('#mui-component-select-timeFrame')).toBeVisible();
    await expect(page.locator('#mui-component-select-performanceReportBy')).toBeVisible();
    await expect(page.getByRole('button', { name: 'RUN REPORT' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
  });
});
