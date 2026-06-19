import { defineConfig, devices, test } from '@playwright/test';
import process from 'process';
//import HomePage from './pages/HomePage';
let baseURL = process.env.HOME_URL;

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  timeout: 2 * 60 * 1000,
  expect: {
    timeout: 30 * 1000,
  },
  // globalSetup: "./global-setup",
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  //workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  /* Run all tests sequentially */
  workers:  1,
  reporter: process.env.CI
    ? [
        ['list'],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        ['html', { open: 'never' }],
      ]
    : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    // baseURL: process.env.URL,
  //   trace: 'on-first-retry',
  // launchOptions: {
  //   slowMo: 500, // smoother base delay
  // },
    // storageState: "./LoginAuth.json",
  },

  /* Configure projects for major browsers */
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      testIgnore: [
        /Auth[\\/].*GeoLogin\.spec\.ts/,
        /Auth[\\/].*FlexOffersSignUp\.spec\.ts/,
        /Accounting[\\/].*\.spec\.ts/,
        /MessageCenter[\\/].*\.spec\.ts/,
        /Reporting[\\/]testReporting\.spec\.ts/,
      ],
      use: {
        ...devices['Desktop Chrome'],
        //storageState: 'playwright/.auth/hrUser.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'geo-login',
      testMatch: /testGeoLogin\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
      // No setup dependency — these tests manage their own browser context with proxy
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});

// test.beforeAll(async ({ browser }) => {
//   const context = await browser.newContext(); // Create a browser context
//   const page = await context.newPage(); // Create a new page within the context

//   // Navigate to the main page
//   // await page.goto('your_main_page_url_here');
//   const homePage = new HomePage(page);
//   if (typeof baseURL === 'string') { await homePage.navigateTo(baseURL); }
// });
