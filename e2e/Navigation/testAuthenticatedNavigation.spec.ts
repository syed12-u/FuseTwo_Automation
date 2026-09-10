import { expect, test } from '@playwright/test';
import { AUTH_FILE } from '../../config/environment';

const routes = [
  { name: 'Programs', path: '/app/programs' },
  { name: 'Campaigns', path: '/app/campaigns' },
  { name: 'Creatives', path: '/app/creatives' },
  { name: 'Coupons & Offers', path: '/app/couponsandoffers' },
  { name: 'Products', path: '/app/products' },
  { name: 'Publisher List', path: '/app/publishers/publisherlist' },
  { name: 'Reconcile Sales', path: '/app/accounting/reconcile' },
  { name: 'Performance', path: '/app/reports/performance' },
  { name: 'Sales Summary', path: '/app/reports/salessummary' },
  { name: 'Clicks Detailed', path: '/app/reports/clicksdetailed' },
  { name: 'My Account', path: '/app/settings/myaccount' },
  { name: 'Help Desk', path: '/app/support/helpdesk' },
] as const;

test.describe('Authenticated navigation', () => {
  test.use({ storageState: AUTH_FILE });

  for (const route of routes) {
    test(`${route.name} route loads without an auth redirect or server error`, async ({ page }) => {
      const response = await page.goto(new URL(route.path, process.env.URL).toString(), {
        waitUntil: 'domcontentloaded',
      });

      expect(response, `${route.name} should return a document response`).not.toBeNull();
      expect(response!.status(), `${route.name} returned HTTP ${response!.status()}`).toBeLessThan(400);
      await expect(page).toHaveURL(new RegExp(`${route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`));
      await expect(page).not.toHaveURL(/\/signin/i);
      await expect(page.locator('body')).not.toContainText(/502 Bad Gateway|Internal Server Error/i);
    });
  }
});
