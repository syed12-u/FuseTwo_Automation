import { defineConfig, devices } from "@playwright/test";
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
const excludedTags = ["@known-bug", ...(env.allowWriteTests ? [] : ["@write"])];
const excludeTagPattern = new RegExp(excludedTags.join("|"));

// Print the resolved target once at startup. Without this a run against the
// wrong environment looks identical in the logs to a correct one.
console.log(
  `[fusetwo-e2e] TEST_ENV=${env.name}  app=${env.appBaseUrl}  management=${env.managementBaseUrl}  ` +
    `writes=${
      env.allowWriteTests ? "allowed" : "blocked"
    }  skipping=${excludedTags.join(",")}`,
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

    /* Day-to-day run. Suites listed in testIgnore need dedicated data, a proxy,
       Windows-SSO into management, or a configured mailbox -- none of which the
       CI agent has -- so they are exercised by their own npm scripts locally
       instead of gating the build. */
    {
      name: "chromium",
      testIgnore: [
        /Auth[\\/].*GeoLogin\.spec\.ts/,
        /Auth[\\/].*FlexOffersSignUp\.spec\.ts/,
        /Accounting[\\/].*\.spec\.ts/,
        /MessageCenter[\\/].*\.spec\.ts/,
        /Reporting[\\/]testReporting\.spec\.ts/,
        // Special scenario suites -- run via their own npm scripts, not the gate.
        /ExecutiveRegression[\\/].*\.spec\.ts/,
        /MeetingVideoRegression[\\/].*\.spec\.ts/,
        /TicketVerification[\\/].*\.spec\.ts/,
        // Need management Windows-SSO and/or a real mailbox -- not available on
        // the CI agent (it runs as a service account, no Outlook). Run locally.
        /Onboarding[\\/]provisionApprovedAccount\.spec\.ts/,
        /Onboarding[\\/]testEmailVerification\.spec\.ts/,
        /Onboarding[\\/]testStatusEmail\.spec\.ts/,
        /Onboarding[\\/]testManagementAdvertiserCrud\.spec\.ts/,
        /Onboarding[\\/]testOnboardingLifecycle\.spec\.ts/,
      ],
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
      testIgnore: [/Auth[\\/].*GeoLogin\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },

    /* Regression guards for defects that are still open. Expected to fail
       until the bug is fixed — run it to check whether a release fixed them. */
    {
      name: "known-bugs",
      grep: /@known-bug/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },

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
