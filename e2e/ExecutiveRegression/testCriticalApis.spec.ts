import { expect, test, type Page, type Response } from '@playwright/test';
import { AUTH_FILE } from '../../config/environment';

const authFile = AUTH_FILE;
const apiPages = [
  { name: 'Dashboard', path: '/app/dashboard' },
  { name: 'Programs', path: '/app/programs' },
  { name: 'Creatives', path: '/app/creatives' },
  { name: 'Products', path: '/app/products' },
  { name: 'Reconcile Sales', path: '/app/accounting/reconcile' },
  { name: 'Performance', path: '/app/reports/performance' },
] as const;

type ApiObservation = {
  method: string;
  url: string;
  status: number;
  contentType: string;
  durationMs: number;
  response: Response;
};

function appUrl(path: string) {
  if (!process.env.URL) {
    throw new Error('URL must be configured before running the API regression suite.');
  }
  return new URL(path, process.env.URL).toString();
}

async function observePageApis(page: Page, path: string) {
  const startedAt = new Map<string, number>();
  const observations: ApiObservation[] = [];

  page.on('request', (request) => {
    if (new URL(request.url()).pathname.toLowerCase().includes('/api/')) {
      startedAt.set(request.url(), Date.now());
    }
  });
  page.on('response', (response) => {
    const url = response.url();
    if (!new URL(url).pathname.toLowerCase().includes('/api/')) return;

    observations.push({
      method: response.request().method(),
      url,
      status: response.status(),
      contentType: response.headers()['content-type'] ?? '',
      durationMs: Date.now() - (startedAt.get(url) ?? Date.now()),
      response,
    });
  });

  await page.goto(appUrl(path), { waitUntil: 'domcontentloaded' });
  await expect.poll(() => observations.length, { timeout: 15_000 }).toBeGreaterThan(0);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);

  return observations;
}

test.describe('@executive @regression critical API health', () => {
  test.use({ storageState: authFile });

  for (const apiPage of apiPages) {
    test(`${apiPage.name} APIs return successful, timely, valid responses`, async ({ page }) => {
      const observations = await observePageApis(page, apiPage.path);
      const failures = observations
        .filter(({ status }) => status >= 400)
        .map(({ method, status, url }) => `${method} ${status} ${new URL(url).pathname}`);

      expect(failures, `Failed ${apiPage.name} API calls:\n${failures.join('\n')}`).toEqual([]);
      console.log(
        `${apiPage.name} API coverage:\n${observations
          .map(
            ({ method, status, durationMs, url }) =>
              `  ${method} ${status} ${durationMs}ms ${new URL(url).pathname}`,
          )
          .join('\n')}`,
      );

      for (const observation of observations) {
        expect(
          observation.durationMs,
          `${observation.method} ${new URL(observation.url).pathname} took ${observation.durationMs}ms`,
        ).toBeLessThan(15_000);

        if (
          observation.status !== 204 &&
          observation.contentType.toLowerCase().includes('application/json')
        ) {
          await expect(
            observation.response.json(),
            `${new URL(observation.url).pathname} did not contain valid JSON`,
          ).resolves.not.toBeUndefined();
        }
      }
    });
  }

  test('an API used by the dashboard rejects an unauthenticated browser', async ({
    page,
    browser,
  }) => {
    const observations = await observePageApis(page, '/app/dashboard');
    const protectedGet = observations.find(
      ({ method, status, url }) =>
        method === 'GET' &&
        status >= 200 &&
        status < 300 &&
        /\/api\/\d+\/myaccount\/getuser$/i.test(new URL(url).pathname),
    );

    expect(protectedGet, 'Dashboard did not call the authenticated user-profile API').toBeDefined();

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(appUrl('/signin'), { waitUntil: 'domcontentloaded' });
    const anonymousResult = await anonymousPage.evaluate(async (url) => {
      const response = await fetch(url, { redirect: 'manual' });
      return { status: response.status, type: response.type };
    }, protectedGet!.url);
    await anonymousContext.close();

    expect(
      [401, 403],
      `Unauthenticated ${new URL(protectedGet!.url).pathname} returned ${anonymousResult.status} (${anonymousResult.type})`,
    ).toContain(anonymousResult.status);
  });
});
