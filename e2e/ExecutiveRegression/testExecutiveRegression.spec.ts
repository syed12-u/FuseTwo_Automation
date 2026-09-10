import { expect, test } from '@playwright/test';
import { AUTH_FILE } from '../../config/environment';

const authFile = AUTH_FILE;

const criticalPages = [
  { name: 'Programs', path: '/app/programs' },
  { name: 'Campaigns', path: '/app/campaigns' },
  { name: 'Creatives', path: '/app/creatives' },
  { name: 'Products', path: '/app/products' },
  { name: 'Publisher List', path: '/app/publishers/publisherlist' },
  { name: 'Reconcile Sales', path: '/app/accounting/reconcile' },
  { name: 'Performance', path: '/app/reports/performance' },
] as const;

function appUrl(path: string) {
  if (!process.env.URL) {
    throw new Error('URL must be configured before running the executive regression suite.');
  }

  return new URL(path, process.env.URL).toString();
}

async function dismissPaymentReminderIfPresent(page: import('@playwright/test').Page) {
  const remindMeLater = page.getByRole('button', { name: 'Remind me later' });

  if (await remindMeLater.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await remindMeLater.click();
    await expect(remindMeLater).toBeHidden();
  }
}

test.describe('@executive @regression CEO demo readiness', () => {
  test.use({ storageState: authFile });

  test('authenticated session survives refresh and browser history navigation', async ({ page }) => {
    await page.goto(appUrl('/app/dashboard'));
    await expect(page.getByRole('heading', { name: 'Welcome to FuseTwo' })).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/app\/dashboard\/?$/);
    await expect(page).not.toHaveURL(/\/signin/i);

    await page.goto(appUrl('/app/programs'));
    await expect(page).toHaveURL(/\/app\/programs\/?$/);

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/app\/dashboard\/?$/);

    await page.goForward({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/app\/programs\/?$/);
  });

  test('primary menu destinations are correctly wired', async ({ page }) => {
    await page.goto(appUrl('/app/dashboard'));
    await dismissPaymentReminderIfPresent(page);

    for (const destination of criticalPages) {
      await expect(
        page.getByRole('link', { name: destination.name, exact: true }),
        `${destination.name} is missing from the advertiser navigation`,
      ).toHaveAttribute(
        'href',
        destination.path,
      );
    }
  });

  test('critical pages return successful documents and no broken same-origin assets', async ({
    page,
  }) => {
    const brokenResponses: string[] = [];

    page.on('response', (response) => {
      const responseUrl = new URL(response.url());
      const appOrigin = new URL(process.env.URL!).origin;
      const resourceType = response.request().resourceType();

      if (
        responseUrl.origin === appOrigin &&
        ['document', 'script', 'stylesheet', 'image', 'font'].includes(resourceType) &&
        response.status() >= 400
      ) {
        brokenResponses.push(`${response.status()} ${responseUrl.pathname}`);
      }
    });

    for (const destination of criticalPages) {
      const response = await page.goto(appUrl(destination.path), {
        waitUntil: 'domcontentloaded',
      });

      expect(response, `${destination.name} did not return a document`).not.toBeNull();
      expect(response!.status(), `${destination.name} returned HTTP ${response!.status()}`).toBeLessThan(
        400,
      );
    }

    expect(
      [...new Set(brokenResponses)],
      `Broken app resources detected:\n${[...new Set(brokenResponses)].join('\n')}`,
    ).toEqual([]);
  });

  test('dashboard remains usable at a common laptop resolution', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(appUrl('/app/dashboard'));

    await expect(page.getByRole('heading', { name: 'Welcome to FuseTwo' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Programs', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Performance', exact: true })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      contentWidth: document.documentElement.scrollWidth,
    }));

    expect(
      dimensions.contentWidth,
      `Dashboard overflows horizontally at 1366px (${dimensions.contentWidth}px wide)`,
    ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  });
});

test.describe('@executive @regression access protection', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unauthenticated visitors cannot open the advertiser dashboard', async ({ page }) => {
    await page.goto(appUrl('/app/dashboard'));

    await expect(page).toHaveURL(/\/signin(?:[/?#]|$)/i);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
