import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import path from "path";
import process from "process";

// Resolves TEST_ENV (dev | staging | prod), loads the matching config/env/*.env
// plus .env, and exposes typed hosts/credentials. Importing it also backfills
// the legacy process.env.URL / HOME_URL used by older specs.
import { env } from "./config/environment";

/**
 * See https://playwright.dev/docs/test-configuration.
 */

// Optional CI-only DNS override for the internal dev host. Leave CI_DEV_HOST_IP
// unset when the agent can resolve advertiser.dev.fusetwo.com normally. Set it
// only when the agent's DNS is broken and the override IP is confirmed
// reachable from that agent. Never applied outside the dev environment.
const ciDevHostIp = process.env.CI_DEV_HOST_IP;
const hasCiDevHostIp = !!ciDevHostIp && !ciDevHostIp.startsWith("$(");
const ciBrowserArgs =
  process.env.CI && hasCiDevHostIp && env.name === "dev"
    ? [
        `--host-resolver-rules=MAP ${
          new URL(env.appBaseUrl).hostname
        } ${ciDevHostIp}`,
      ]
    : [];

// The management portal is IIS with Windows Integrated Authentication and
// answers 401 with "WWW-Authenticate: Negotiate, NTLM" before the application
// loads. Playwright's httpCredentials cannot satisfy that (Basic/Digest only),
// so Chromium is allowed to single-sign-on with the current Windows domain
// session for these hosts. Without this every management test sees the IIS
// "401 - Unauthorized" page instead of the app.
const ssoArgs = [
  `--auth-server-allowlist=${env.authServerAllowlist}`,
  `--auth-negotiate-delegate-allowlist=${env.authServerAllowlist}`,
];

// Tag policy
// ----------
// @blocker    must pass before a release ships — the release gate runs these
// @crud       create/read/update/delete coverage for a module
// @smoke      fastest signal that the app is alive
// @write      mutates real data; skipped automatically on prod
// @known-bug  guards an open defect, so it is expected to fail today. Excluded
//             from every gating run and reported by the `known-bugs` project.
// @pending-review  new scenario written by the daily explorer agent that a QA
//             lead has not approved yet. Excluded from every run except the
//             `review` project (npm run review:cases, headed). Approving a case
//             (npm run approve:cases) removes the tag and adds it to the suite.
const runAllTests = process.env.RUN_ALL_TESTS === "true";
const excludedTags = [
  "@pending-review",
  ...(runAllTests ? [] : ["@known-bug"]),
  ...(env.allowWriteTests ? [] : ["@write"]),
];
const excludeTagPattern = excludedTags.length ? new RegExp(excludedTags.join("|")) : undefined;

// Optional machine-local additions: extra projects and folders that belong to
// one QA machine and are not part of the shared suite. The file is not in git
// (absent on CI), so the shared config works without it. It exports
// ({ devices, env, ssoArgs, ciBrowserArgs }) => ({ testIgnore, projects }).
const localConfigFile = path.join(__dirname, "playwright.local.js");
const local: { testIgnore: RegExp[]; projects: any[] } = fs.existsSync(localConfigFile)
  ? require(localConfigFile)({ devices, env, ssoArgs, ciBrowserArgs })
  : { testIgnore: [], projects: [] };

// Print the resolved target once at startup. Without this a run against the
// wrong environment looks identical in the logs to a correct one.
console.log(
  `[fusetwo-e2e] TEST_ENV=${env.name}  app=${env.appBaseUrl}  management=${env.managementBaseUrl}  ` +
    `writes=${
      env.allowWriteTests ? "allowed" : "blocked"
    }  allTests=${runAllTests}  skipping=${excludedTags.join(",") || "none"}`,
);

export default defineConfig({
  timeout: 2 * 60 * 1000,
  expect: {
    timeout: 30 * 1000,
  },
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Run all tests sequentially */
  workers: 1,
  reporter: process.env.CI
    ? [
        ["list"],
        ["junit", { outputFile: "test-results/junit.xml" }],
        ["html", { open: "never" }],
      ]
    : "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Resolved from TEST_ENV, so page.goto('/app/programs') hits the right host. */
    baseURL: env.appBaseUrl,
    ignoreHTTPSErrors: env.ignoreHttpsErrors,
    trace: "on-first-retry",
    video: "retain-on-failure",
    launchOptions: {
      args: [...ssoArgs, ...ciBrowserArgs],
    },
  },

  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },

    /* Day-to-day run. Suites listed in testIgnore need dedicated data or a
       proxy and are exercised by their own npm scripts instead. */
    {
      name: "chromium",
      testIgnore: [
        ...local.testIgnore,
        ...(runAllTests
          ? []
          : [
              /Auth[\\/].*GeoLogin\.spec\.ts/,
              /Auth[\\/].*FlexOffersSignUp\.spec\.ts/,
              /Accounting[\\/].*\.spec\.ts/,
              /MessageCenter[\\/].*\.spec\.ts/,
              /Reporting[\\/]testReporting\.spec\.ts/,
            ]),
      ],
      grepInvert: excludeTagPattern,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },

    /* Accounting suites (Reconcile Sales UI + API, adjustment e-mail). Kept
       out of the day-to-day run because they adjust real sale amounts (each
       test reverts its own change); run them with npm run test:accounting. */
    {
      name: "accounting",
      testMatch: /Accounting[\\/].*\.spec\.ts/,
      grepInvert: excludeTagPattern,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },

    /* Release gate: every @blocker scenario across all modules, with no
       testIgnore. This is the one to run against a release candidate. */
    {
      name: "release-gate",
      grep: /@blocker/,
      grepInvert: excludeTagPattern,
      testIgnore: [...local.testIgnore, ...(runAllTests ? [] : [/Auth[\\/].*GeoLogin\.spec\.ts/])],
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },

    /* Regression guards for defects that are still open. Expected to fail
       until the bug is fixed — run it to check whether a release fixed them. */
    {
      name: "known-bugs",
      grep: /@known-bug/,
      grepInvert: /@pending-review/,
      testIgnore: [...local.testIgnore],
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },

    /* Review of new explorer-agent scenarios (@pending-review), shown in a
       visible browser, slowed down so each step can be followed. Run with
       npm run review:cases, then approve / reject with approve:cases. */
    {
      name: "review",
      grep: /@pending-review/,
      testIgnore: [...local.testIgnore],
      use: {
        ...devices["Desktop Chrome"],
        // Visible and slowed down for the reviewer; the unattended explorer
        // agent sets REVIEW_HEADLESS=true to run the same project headless.
        headless: process.env.REVIEW_HEADLESS === "true",
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: [...ssoArgs, ...ciBrowserArgs],
          slowMo: process.env.REVIEW_HEADLESS === "true" ? 0 : Number(process.env.REVIEW_SLOWMO || 400),
        },
        video: "on",
      },
      dependencies: ["setup"],
    },

    // Machine-local projects (see playwright.local.js at the top of this file).
    ...local.projects,

    // geo-login disabled: the BrightData proxy variables (BRIGHTDATA_HOST/PORT/
    // USERNAME/PASSWORD) are not defined in the Azure pipeline, so the .env on the
    // agent gets literal "$(BRIGHTDATA_HOST)" macros and every geo test fails with
    // ERR_PROXY_CONNECTION_FAILED. Re-enable this project once those variables are
    // configured in the pipeline.
    // {
    //   name: 'geo-login',
    //   testMatch: /testGeoLogin\.spec\.ts/,
    //   use: {
    //     ...devices['Desktop Chrome'],
    //   },
    //   // No setup dependency — these tests manage their own browser context with proxy
    // },
  ],
});
