// Test data for the advertiser onboarding journey.

/**
 * Mailbox that receives every signup this suite creates.
 *
 * Plus-addressing keeps each registration unique while delivering to a real
 * inbox, so the verification and onboarding e-mails can actually be read. The
 * previous fake domain (flexverify.com) silently discarded them.
 */
export const SIGNUP_MAILBOX = "syed.shah@flexoffers.com";

/** Prefix that makes automated signups easy to find and clean up. */
export const SIGNUP_TAG = "auto";

/**
 * Build a unique, deliverable address, e.g.
 * syed.shah+auto1787378997840x7f3@flexoffers.com
 */
export function uniqueSignupEmail(): string {
  const [local, domain] = SIGNUP_MAILBOX.split("@");
  const unique = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 5)}`;
  return `${local}+${SIGNUP_TAG}${unique}@${domain}`;
}

/** Company name carrying the same marker, so it is searchable in management. */
export function uniqueCompanyName(): string {
  const unique = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 5)}`;
  return `QA ${SIGNUP_TAG} ${unique}`;
}

/**
 * Statuses offered by the management "Change Advertiser Status" dialog.
 * The dialog only lists transitions valid from the advertiser's current state,
 * so not every value is available at every point.
 */
export const ADVERTISER_STATUSES = {
  collectPayment: "Collect Payment",
  initialSetup: "Initial Setup",
  followUp: "Follow Up",
  approved: "Approved",
  declined: "Declined",
  deactivated: "Deactivated",
  fraud: "Fraud",
  removedDueToAudit: "Removed due to Audit",
  collectPaymentFree: "Collect Payment - Free",
  followUpFree: "Follow Up - Free",
} as const;

export type AdvertiserStatus =
  (typeof ADVERTISER_STATUSES)[keyof typeof ADVERTISER_STATUSES];

/** Statuses that must NOT let the advertiser reach the dashboard. */
export const BLOCKING_STATUSES: AdvertiserStatus[] = [
  ADVERTISER_STATUSES.declined,
  ADVERTISER_STATUSES.deactivated,
  ADVERTISER_STATUSES.fraud,
  ADVERTISER_STATUSES.removedDueToAudit,
];

/** Onboarding stages an advertiser passes through before going active. */
export const ONBOARDING_STAGES: AdvertiserStatus[] = [
  ADVERTISER_STATUSES.collectPayment,
  ADVERTISER_STATUSES.initialSetup,
  ADVERTISER_STATUSES.followUp,
];

/**
 * Where a verified advertiser lands when signing in at each status, as observed
 * on dev (2026-08-24). The path is what proves the gate: e.g. only Approved
 * reaches /app/dashboard. Used to turn the per-stage checks into real
 * assertions rather than logging the URL.
 */
export const STAGE_LANDING: Record<string, RegExp> = {
  Pending: /\/account\/pending-account/,
  "Collect Payment": /\/account\/collect-payment/,
  "Initial Setup": /\/app\/settings\/advertisersetup/,
  "Follow Up": /\/account\/pending-account/,
  Approved: /\/app\/dashboard/,
  Deactivated: /\/account\/deactivated-account/,
  Declined: /\/account\/declined-account/,
};
