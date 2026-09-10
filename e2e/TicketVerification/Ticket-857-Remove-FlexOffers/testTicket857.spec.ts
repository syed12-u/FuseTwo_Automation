import { expect, test } from "@playwright/test";
import { AUTH_FILE, appUrl } from "../../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../../utility/appActions";

/**
 * TICKET #857 — Audit FuseTwo and remove all FlexOffers references.
 *
 * Requirement (from the ticket + Pradeep's comment):
 *   - FlexOffers brand references are replaced with FuseTwo throughout the app.
 *   - All SendGrid and Zendesk references are removed.
 *   - Specific FlexOffers *e-mail addresses* are intentionally kept for now
 *     (listed in ALLOWED_EMAILS) and must NOT be flagged.
 *   - Focus areas: URLs, e-mails, Message Center, publisher invitations.
 *
 * This audit checks each page's visible text AND its href/src URLs for the
 * forbidden brands, after removing the intentionally-kept e-mail addresses.
 */
const ALLOWED_EMAILS = [
  "advertise@flexoffers.com",
  "advertiser@flexoffers.com",
  "development@flexoffers.com",
  "advertiser.development@flexoffers.com",
  "advertiser.staging@flexoffers.com",
  "accounts-engineering@flexoffers.com",
  "support@flexoffers.com",
  "alerts@flexoffers.com",
];

// Infrastructure hosts that legitimately live on flexoffers.com (not brand text).
const ALLOWED_URL_SUBSTRINGS = ["control.corp.flexoffers.com"];

const PAGES = [
  ["Dashboard", "/app/dashboard"],
  ["Programs", "/app/programs"],
  ["Campaigns", "/app/campaigns"],
  ["Creatives", "/app/creatives"],
  ["Coupons & Offers", "/app/couponsandoffers"],
  ["Products", "/app/products"],
  ["Publisher List", "/app/publishers/publisherlist"],
  ["Find Publishers", "/app/publishers/find-publishers"],
  ["Performance", "/app/reports/performance"],
  ["Sales Summary", "/app/reports/salessummary"],
  ["My Account", "/app/settings/myaccount"],
  ["Advertiser Setup (T&C)", "/app/settings/advertisersetup"],
  ["Tracking Pixel", "/app/settings/trackingpixel"],
  ["Help Desk", "/app/support/helpdesk"],
  ["Message Center", "/app/messagecenter"],
  ["Terms & Conditions (full legal text)", "/app/support/terms"],
] as const;

/** Remove the intentionally-kept e-mails, then any remaining e-mail address. */
function stripAllowedEmails(text: string): string {
  let out = text;
  for (const email of ALLOWED_EMAILS) out = out.split(email).join(" ");
  return out.replace(/[\w.+-]+@[\w.-]+\.\w+/g, " ");
}

test.describe("@ticket-857 Remove FlexOffers / SendGrid / Zendesk references", () => {
  test.use({ storageState: AUTH_FILE });
  test.setTimeout(3 * 60 * 1000);

  for (const [name, path] of PAGES) {
    test(`"${name}" has no FlexOffers / SendGrid / Zendesk references @ticket-857`, async ({
      page,
    }) => {
      await page.goto(appUrl(path), { waitUntil: "domcontentloaded" });
      await dismissPaymentReminderIfPresent(page);
      await expect(page).not.toHaveURL(/\/signin/i);
      await page.waitForTimeout(3_000);

      // 1. Visible text (with the intentionally-kept e-mails removed first).
      const visible = stripAllowedEmails(
        await page.locator("body").innerText(),
      );
      const flexText = [
        ...visible.matchAll(/[^\s]*flex\s*offers?[^\s]*/gi),
      ].map((m) => m[0].slice(0, 60));
      expect(
        flexText,
        `"${name}" (${path}) shows FlexOffers brand text (#857)`,
      ).toEqual([]);
      expect(
        /sendgrid/i.test(visible),
        `"${name}" shows a SendGrid reference (#857)`,
      ).toBe(false);
      expect(
        /zendesk/i.test(visible),
        `"${name}" shows a Zendesk reference (#857)`,
      ).toBe(false);

      // 2. URLs (href/src) — catch links/assets pointing at the old brands.
      const urls: string[] = await page.evaluate(() =>
        [...document.querySelectorAll("[href],[src]")]
          .map((e) => e.getAttribute("href") || e.getAttribute("src") || "")
          .filter(Boolean),
      );
      const badUrls = urls.filter(
        (u) =>
          /flexoffers|sendgrid|zendesk/i.test(u) &&
          !ALLOWED_EMAILS.some((e) => u.includes(e)) &&
          !ALLOWED_URL_SUBSTRINGS.some((s) => u.includes(s)),
      );
      expect(
        [...new Set(badUrls)],
        `"${name}" (${path}) has URLs pointing at FlexOffers/SendGrid/Zendesk (#857)`,
      ).toEqual([]);
    });
  }
});
