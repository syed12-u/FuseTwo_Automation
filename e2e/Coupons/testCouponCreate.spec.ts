import { expect, Page, test } from "@playwright/test";
import CouponsOffersPage from "../../pages/CouponsOffersPage";
import { AUTH_FILE } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";
import {
  COUPON_CODE_PREFIX,
  COUPON_CREATE_SUCCESS_MESSAGE,
  COUPON_DESCRIPTION_PREFIX,
  COUPON_DESTINATION_URL,
  COUPON_PROGRAM_NAME,
  COUPON_TITLE_PREFIX,
} from "../../fixtures/testConstants";

/**
 * Coupons & Offers — create a coupon end to end, reopen it and check what was
 * saved (active/expire date + time, Set to Auto-Renew), then disable it. @write.
 *
 * The wizard validates that the Destination URL belongs to the selected
 * program's registered domain (COUPON_PROGRAM_NAME → cakebrandusa.com), so the
 * URL is COUPON_DESTINATION_URL, which lives under that domain. This was the
 * root cause that previously blocked the coupon flow (a mismatched URL).
 *
 * The listing opens on whichever program sorts first, so a new coupon is only
 * visible once the Programs filter is switched to COUPON_PROGRAM_NAME.
 */
const ACTIVE_TIME = "09:30 AM";
const EXPIRE_TIME = "05:45 PM";

test.describe("Coupons & Offers - create @write", () => {
  test.use({ storageState: AUTH_FILE });
  test.setTimeout(4 * 60 * 1000);

  /** Titles this run created and has not yet disabled. */
  const pendingCleanup = new Set<string>();

  /** Fill and save one coupon; returns what was entered. */
  async function createCoupon(
    page: Page,
    coupons: CouponsOffersPage,
    options: { autoRenew?: boolean } = {},
  ) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const title = `${COUPON_TITLE_PREFIX}${suffix}`;
    const description = `${COUPON_DESCRIPTION_PREFIX}${suffix}`;
    const couponCode = `${COUPON_CODE_PREFIX}${suffix}`;

    await coupons.startAddCoupon();
    await page.waitForTimeout(1000);
    await page
      .getByRole("button", { name: /^No$/ })
      .click({ timeout: 4000 })
      .catch(() => {});

    await coupons.selectProgram(COUPON_PROGRAM_NAME);
    await coupons.fillCouponDetails({
      destinationUrl: COUPON_DESTINATION_URL,
      title,
      description,
      couponCode,
    });
    const activeDate = await coupons.selectActiveDate("1", ACTIVE_TIME);
    const expireDate = await coupons.selectExpireDate("28", EXPIRE_TIME);
    // A fresh form always starts with Set to Auto-Renew = No.
    expect(await coupons.autoRenewState()).toBe("No");
    if (options.autoRenew !== undefined) {
      await coupons.setAutoRenew(options.autoRenew);
    }
    // Re-typing the URL last clears the stale domain-validation message that
    // otherwise keeps Next on step 1.
    await coupons.clickAndRefillDestinationURL(COUPON_DESTINATION_URL);
    await coupons.goNext();
    await coupons.markVisibleToSelectedPublishers();
    await coupons.addPublisher();
    await coupons.saveCoupon();

    await expect(coupons.alertMessage).toContainText(
      COUPON_CREATE_SUCCESS_MESSAGE,
      { timeout: 30_000 },
    );
    pendingCleanup.add(title);
    await coupons.filterByProgram(COUPON_PROGRAM_NAME);
    await expect(coupons.getCouponTitle(title)).toBeVisible({
      timeout: 30_000,
    });
    console.log(`created coupon "${title}"`);
    return { title, activeDate, expireDate };
  }

  async function disableCoupon(coupons: CouponsOffersPage, title: string) {
    await coupons.disableCouponByTitle(title);
    pendingCleanup.delete(title);
    await coupons.openDisabledTab();
    await expect(coupons.getCouponTitle(title)).toBeVisible({
      timeout: 30_000,
    });
  }

  test("a coupon can be created and keeps its active/expire date + time @blocker @crud", async ({
    page,
  }) => {
    const coupons = new CouponsOffersPage(page);
    await coupons.openCouponsAndOffers();
    await dismissPaymentReminderIfPresent(page);

    const entered = await createCoupon(page, coupons);

    const saved = await coupons.readSavedCoupon(entered.title);
    expect(saved.activeDate).toBe(entered.activeDate);
    expect(saved.activeTime).toBe(ACTIVE_TIME);
    expect(saved.expireDate).toBe(entered.expireDate);
    expect(saved.expireTime).toBe(EXPIRE_TIME);
    expect(saved.autoRenew).toBe("No");

    // Cleanup: Disable is the only removal the UI offers.
    await coupons.openCouponsAndOffers();
    await dismissPaymentReminderIfPresent(page);
    await coupons.filterByProgram(COUPON_PROGRAM_NAME);
    await disableCoupon(coupons, entered.title);
  });

  test("Set to Auto-Renew = Yes persists after save @crud", async ({
    page,
  }) => {
    const coupons = new CouponsOffersPage(page);
    await coupons.openCouponsAndOffers();
    await dismissPaymentReminderIfPresent(page);

    const entered = await createCoupon(page, coupons, { autoRenew: true });

    const saved = await coupons.readSavedCoupon(entered.title);
    expect(saved.autoRenew).toBe("Yes");
    expect(saved.activeTime).toBe(ACTIVE_TIME);
    expect(saved.expireTime).toBe(EXPIRE_TIME);

    await coupons.openCouponsAndOffers();
    await dismissPaymentReminderIfPresent(page);
    await coupons.filterByProgram(COUPON_PROGRAM_NAME);
    await disableCoupon(coupons, entered.title);
  });

  // Safety net: disable anything a failed test left active.
  test.afterAll(async ({ browser }) => {
    if (pendingCleanup.size === 0) return;
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const page = await context.newPage();
    try {
      const coupons = new CouponsOffersPage(page);
      for (const title of [...pendingCleanup]) {
        await coupons.openCouponsAndOffers();
        await dismissPaymentReminderIfPresent(page);
        await coupons.filterByProgram(COUPON_PROGRAM_NAME);
        if (!(await coupons.getCouponTitle(title).isVisible().catch(() => false))) {
          continue;
        }
        await coupons.disableCouponByTitle(title).catch((error: Error) => {
          console.log(`cleanup: could not disable "${title}": ${error.message}`);
        });
        console.log(`cleanup: disabled coupon "${title}"`);
      }
    } finally {
      await context.close();
    }
  });
});
