import { test, expect, chromium, Request, Response } from '@playwright/test';
import LoginPage from '../../pages/LoginPage';
import { GEO_PROXIES, GeoProxyConfig } from '../../fixtures/proxyConstants';
import fs from 'fs';
import path from 'path';

const loginURL = 'https://advertiser.dev.fusetwo.com/signin';
// const loginURL = 'https://publisherprobeta.flexoffers.com';
const homePageURL = 'app/dashboard';
const username = process.env.FO_USERNAME ?? '';
const password = process.env.FO_PASSWORD ?? '';

interface RequestLog {
  timestamp: string;
  url: string;
  method: string;
  status: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  responseBody: string;
  duration: string;
}

async function loginFromCountry(proxyConfig: GeoProxyConfig) {
  const failedRequests: RequestLog[] = [];
  const allRequests: RequestLog[] = [];
  const requestTimings = new Map<string, number>();

  const browser = await chromium.launch({
    proxy: { server: 'http://per-context' },
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    proxy: {
      server: proxyConfig.proxyServer,
      username: proxyConfig.proxyUsername,
      password: proxyConfig.proxyPassword,
    },
  });

  const page = await context.newPage();

  // Track request start times
  page.on('request', (req: Request) => {
    requestTimings.set(req.url(), Date.now());
  });

  // Monitor all responses — log errors with full details
  page.on('response', async (resp: Response) => {
    const startTime = requestTimings.get(resp.url());
    const duration = startTime ? `${Date.now() - startTime}ms` : 'unknown';

    if (resp.status() >= 400) {
      let body = '';
      try {
        body = await resp.text();
      } catch {
        body = '[Could not read body]';
      }

      const entry: RequestLog = {
        timestamp: new Date().toISOString(),
        url: resp.url(),
        method: resp.request().method(),
        status: resp.status(),
        requestHeaders: resp.request().headers(),
        responseHeaders: resp.headers(),
        responseBody: body.substring(0, 2000),
        duration,
      };

      allRequests.push(entry);
      if (resp.status() === 502) {
        failedRequests.push(entry);
      }
    }
  });

  try {
    const loginPage = new LoginPage(page);

    // Navigate to login page
    const response = await page.goto(loginURL, { waitUntil: 'domcontentloaded' }).catch((err) => {
      console.log(`\n[${proxyConfig.country}] page.goto failed: ${err.message}`);
      return null;
    });

    const pageStatus = response?.status() ?? 0;
    console.log(`[${proxyConfig.country}] Page load status: ${pageStatus} | URL: ${page.url()}`);

    // If page load failed entirely (502 via proxy), generate report and fail
    if (!response || pageStatus === 502) {
      await page.waitForTimeout(2000);
      await generateReport(proxyConfig, pageStatus, page.url(), failedRequests, allRequests, page);
      expect(
        false,
        `Page load failed from ${proxyConfig.country} (status: ${pageStatus}). See test-results/502-report-${proxyConfig.countryCode}.json`
      ).toBeTruthy();
    }

    // Wait for login form to be fully loaded
    await loginPage.loginEmailField.waitFor({ state: 'visible', timeout: 30000 });

    // Perform login
    await loginPage.login(username, password);

    // Wait for post-login API calls to complete
    await page.waitForTimeout(5000);

    // If any 502 was captured from API calls, generate report and fail
    if (failedRequests.length > 0) {
      await generateReport(proxyConfig, pageStatus, page.url(), failedRequests, allRequests, page);
      expect(
        false,
        `Got ${failedRequests.length} 502 error(s) from ${proxyConfig.country}. See test-results/502-report-${proxyConfig.countryCode}.json`
      ).toBeTruthy();
    }

    // Verify successful navigation to home page
    const completeURL = new URL(homePageURL, loginURL).toString();
    await page.waitForURL(completeURL, { timeout: 60000, waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(completeURL);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function generateReport(
  proxyConfig: GeoProxyConfig,
  pageStatus: number,
  currentURL: string,
  failedRequests: RequestLog[],
  allRequests: RequestLog[],
  page: import('@playwright/test').Page,
) {
  try {
    await page.screenshot({ path: `test-results/502-${proxyConfig.countryCode}.png`, fullPage: true });
  } catch {
    console.log(`[${proxyConfig.country}] Could not capture screenshot`);
  }

  const report = {
    testRun: new Date().toISOString(),
    country: proxyConfig.country,
    countryCode: proxyConfig.countryCode,
    proxyServer: proxyConfig.proxyServer,
    proxyUsername: proxyConfig.proxyUsername,
    pageLoadStatus: pageStatus,
    currentURL,
    total502Errors: failedRequests.length,
    totalErrorResponses: allRequests.length,
    failedEndpoints: failedRequests.map((r) => ({
      endpoint: r.url,
      method: r.method,
      status: r.status,
      duration: r.duration,
      timestamp: r.timestamp,
      requestHeaders: r.requestHeaders,
      responseHeaders: r.responseHeaders,
      responseBody: r.responseBody,
    })),
    allErrorResponses: allRequests.map((r) => ({
      endpoint: r.url,
      method: r.method,
      status: r.status,
      duration: r.duration,
      timestamp: r.timestamp,
      responseHeaders: r.responseHeaders,
      responseBody: r.responseBody.substring(0, 500),
    })),
  };

  const reportDir = 'test-results';
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `502-report-${proxyConfig.countryCode}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n========== 502 DIAGNOSTIC REPORT: ${proxyConfig.country} ==========`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nFull report saved to: ${reportPath}`);
  console.log(`Screenshot saved to: test-results/502-${proxyConfig.countryCode}.png`);
  console.log(`==========================================================\n`);
}

test.describe('Geo-Location Login Tests - 502 Bad Gateway Verification', () => {
  test.setTimeout(120000);
  test('Login from India via BrightData proxy', async () => {
    await loginFromCountry(GEO_PROXIES.india);
  });

  test('Login from Indonesia via BrightData proxy', async () => {
    await loginFromCountry(GEO_PROXIES.indonesia);
  });

  test('Login from Canada via BrightData proxy', async () => {
    await loginFromCountry(GEO_PROXIES.canada);
  });

  test('Login from Colombia via BrightData proxy', async () => {
    await loginFromCountry(GEO_PROXIES.colombia);
  });

  test('Login from Brazil via BrightData proxy', async () => {
    await loginFromCountry(GEO_PROXIES.brazil);
  });
});
