// ---------------------------------------------------------------------------
// Single source of truth for "which environment am I testing?".
//
// Pick the target with TEST_ENV (dev | staging | prod). Default is dev, so
// existing commands keep working unchanged:
//
//   npm test                    -> dev
//   TEST_ENV=staging npm test   -> staging
//   npm run test:prod           -> production (read-only by default)
//
// Resolution order (first hit wins):
//   1. real environment variables (CLI export, Azure pipeline variables)
//   2. .env.<env>.local          per-developer overrides, git-ignored
//   3. .env                      shared credentials, git-ignored
//   4. config/env/<env>.env      committed host defaults
//
// dotenv never overwrites a key that is already set, which is what produces the
// precedence above — so load the files from most- to least-specific.
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import { config as dotenvConfig } from "dotenv";

export type TestEnvName = "dev" | "staging" | "prod";

const ENV_ALIASES: Record<string, TestEnvName> = {
  dev: "dev",
  develop: "dev",
  development: "dev",
  stg: "staging",
  stage: "staging",
  staging: "staging",
  prod: "prod",
  production: "prod",
  live: "prod",
};

function resolveEnvName(): TestEnvName {
  const requested = (process.env.TEST_ENV ?? "dev").trim().toLowerCase();
  const resolved = ENV_ALIASES[requested];

  if (!resolved) {
    throw new Error(
      `Unknown TEST_ENV "${process.env.TEST_ENV}". ` +
        `Use one of: dev, staging, prod (aliases: stg, stage, production, live).`,
    );
  }

  return resolved;
}

const REPO_ROOT = path.resolve(__dirname, "..");

export const ENV_NAME: TestEnvName = resolveEnvName();

// Azure pipelines write ".env" from pipeline variables. When a variable is not
// defined the file receives the literal macro "$(SOME_VAR)" instead of a value,
// which then silently poisons a URL or a password. Treat those as unset.
function isUnresolvedMacro(value: string | undefined): boolean {
  return !!value && value.trim().startsWith("$(");
}

function loadEnvFile(file: string) {
  if (fs.existsSync(file)) {
    dotenvConfig({ path: file });
  }
}

loadEnvFile(path.join(REPO_ROOT, `.env.${ENV_NAME}.local`));
loadEnvFile(path.join(REPO_ROOT, ".env"));
loadEnvFile(path.join(REPO_ROOT, "config", "env", `${ENV_NAME}.env`));

function read(key: string): string | undefined {
  const value = process.env[key];
  if (value === undefined || isUnresolvedMacro(value)) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function require_(key: string): string {
  const value = read(key);
  if (!value) {
    throw new Error(
      `Missing configuration "${key}" for TEST_ENV=${ENV_NAME}. ` +
        `Set it in config/env/${ENV_NAME}.env (hosts) or .env (credentials).`,
    );
  }
  return value;
}

function readBool(key: string, fallback: boolean): boolean {
  const value = read(key);
  if (value === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}

/** Strip a trailing slash so URL joining stays predictable. */
function normalizeOrigin(url: string, key: string): string {
  try {
    return new URL(url).origin;
  } catch {
    throw new Error(
      `Configuration "${key}" is not a valid absolute URL: "${url}"`,
    );
  }
}

// --- Paths are identical across environments, so they live in code ----------
export const PATHS = {
  signin: "/signin",
  signup: "/signup",
  forgotPassword: "/forgotpassword",
  dashboard: "/app/dashboard",
  programs: "/app/programs",
  campaigns: "/app/campaigns",
  creatives: "/app/creatives",
  couponsAndOffers: "/app/couponsandoffers",
  products: "/app/products",
  productsManage: "/app/products/manage",
  publisherList: "/app/publishers/publisherlist",
  reconcileSales: "/app/accounting/reconcile",
  reportPerformance: "/app/reports/performance",
  reportSalesSummary: "/app/reports/salessummary",
  reportSalesDetailed: "/app/reports/salesdetailed",
  reportClicksSummary: "/app/reports/clickssummary",
  reportClicksDetailed: "/app/reports/clicksdetailed",
  myAccount: "/app/settings/myaccount",
  helpDesk: "/app/support/helpdesk",
  terms: "/terms",
  privacy: "/privacy",
} as const;

const appBaseUrl = normalizeOrigin(require_("APP_BASE_URL"), "APP_BASE_URL");
const managementBaseUrl = normalizeOrigin(
  read("MANAGEMENT_BASE_URL") ?? read("MANAGEMENT_URL") ?? appBaseUrl,
  "MANAGEMENT_BASE_URL",
);
const controlBaseUrl = normalizeOrigin(
  read("CONTROL_BASE_URL") ?? "https://control.corp.flexoffers.com",
  "CONTROL_BASE_URL",
);

/** Absolute URL on the advertiser app for the given path. */
export function appUrl(pathname: string): string {
  return new URL(pathname, appBaseUrl).toString();
}

/** Absolute URL on the management portal for the given path. */
export function managementUrl(pathname: string): string {
  return new URL(pathname, managementBaseUrl).toString();
}

/** Absolute URL on the legacy control site for the given path. */
export function controlUrl(pathname: string): string {
  return new URL(pathname, controlBaseUrl).toString();
}

export const env = {
  name: ENV_NAME,
  isProd: ENV_NAME === "prod",

  appBaseUrl,
  managementBaseUrl,
  controlBaseUrl,

  signinUrl: appUrl(PATHS.signin),
  signupUrl: appUrl(PATHS.signup),
  dashboardUrl: appUrl(PATHS.dashboard),

  advertiser: {
    username: read("FO_USERNAME"),
    password: read("FO_PASSWORD"),
  },
  management: {
    username: read("MANAGEMENT_USERNAME") ?? read("CONTROL_USERNAME"),
    password: read("MANAGEMENT_PASSWORD") ?? read("CONTROL_PASSWORD"),
  },

  /**
   * Whether tests that create/edit/delete real data (@write) may run.
   * Defaults to false on prod so a live release gate stays read-only unless
   * someone explicitly opts in with ALLOW_WRITE_TESTS=true.
   */
  allowWriteTests: readBool("ALLOW_WRITE_TESTS", ENV_NAME !== "prod"),

  /**
   * Relax TLS verification. Needed only where a host presents a certificate
   * from the internal FLEX-DC01 CA that Chromium does not trust (management
   * staging). Off everywhere else, so a genuinely broken certificate on dev or
   * prod still fails the run.
   */
  ignoreHttpsErrors: readBool("IGNORE_HTTPS_ERRORS", false),

  /**
   * Hosts for which Chromium may answer an HTTP Negotiate/NTLM challenge using
   * the machine's current Windows domain session.
   *
   * The management portal is IIS with Windows Integrated Authentication: it
   * replies 401 with "WWW-Authenticate: Negotiate, NTLM" before the app is ever
   * reached. Playwright's httpCredentials only speaks Basic/Digest, so it cannot
   * answer that challenge; single sign-on is the only way in. Chromium performs
   * it only for allowlisted hosts, which is why this is set explicitly.
   */
  authServerAllowlist: read("AUTH_SERVER_ALLOWLIST") ?? "*fusetwo.com",

  /**
   * Microsoft Graph access to the real QA mailbox, used to read the signup
   * verification e-mail. Every registration is plus-addressed
   * (syed.shah+auto...@flexoffers.com), so one mailbox receives them all.
   *
   * An Azure AD app registration with the Mail.Read application permission is
   * required. A mailbox password is deliberately not supported: Microsoft has
   * disabled basic authentication on modern tenants, and MFA would block it.
   */
  graph: {
    tenantId: read("GRAPH_TENANT_ID"),
    clientId: read("GRAPH_CLIENT_ID"),
    clientSecret: read("GRAPH_CLIENT_SECRET"),
    mailbox: read("MAILBOX_ADDRESS") ?? "syed.shah@flexoffers.com",
  },
} as const;

/** Whether mailbox-backed tests can run. */
export function isMailboxConfigured(): boolean {
  return !!(env.graph.tenantId && env.graph.clientId && env.graph.clientSecret);
}

/** Signed-in storage state, kept per environment so sessions never cross over. */
export const AUTH_FILE = `playwright/.auth/advertiser.${ENV_NAME}.json`;
export const MANAGEMENT_AUTH_FILE = `playwright/.auth/management.${ENV_NAME}.json`;

/** Credentials required to reach a signed-in state; throws with a clear message. */
export function requireAdvertiserCredentials(): {
  username: string;
  password: string;
} {
  const { username, password } = env.advertiser;
  if (!username || !password) {
    throw new Error(
      `FO_USERNAME / FO_PASSWORD are not set for TEST_ENV=${ENV_NAME}. ` +
        `Add them to .env or .env.${ENV_NAME}.local.`,
    );
  }
  return { username, password };
}

// --- Backwards compatibility ----------------------------------------------
// Specs written before this module read process.env.URL (the sign-in URL) and
// process.env.HOME_URL (the dashboard path). Derive both from the resolved
// environment and overwrite whatever .env happened to contain, otherwise a
// dev-specific URL left in .env would hijack a staging or prod run.
process.env.URL = env.signinUrl;
process.env.HOME_URL = PATHS.dashboard;
process.env.FLEXOFFERS_SIGNUP_URL = env.signupUrl;
process.env.MANAGEMENT_URL = managementBaseUrl;

export default env;
