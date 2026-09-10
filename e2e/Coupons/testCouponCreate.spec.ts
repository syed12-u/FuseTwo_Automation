import { expect, test } from "@playwright/test";
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
 * Coupons & Offers — create a coupon end to end. @write.
 *
 * The wizard validates that the Destination URL belongs to the selected
 * program's registered domain (COUPON_PROGRAM_NAME → cakebrandusa.com), so the
 * URL is COUPON_DESTINATION_URL, which lives under that domain. This was the
 * root cause that previously blocked the coupon flow (a mismatched URL).
 */
test.describe("Coupons & Offers - create @write", () => {
  test.use({ storageState: AUTH_FILE });
  test.setTimeout(3 * 60 * 1000);

  test("a coupon can be created @blocker @crud", async ({ page }) => {
    const coupons = new CouponsOffersPage(page);
    await coupons.openCouponsAndOffers();
    await dismissPaymentReminderIfPresent(page);

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
    await coupons.selectActiveDate("1");
    await coupons.selectExpireDate("28");
    await coupons.goNext();
    await coupons.markVisibleToSelectedPublishers();
    await coupons.addPublisher();
    await coupons.saveCoupon();

    await expect(coupons.alertMessage).toContainText(
      COUPON_CREATE_SUCCESS_MESSAGE,
      { timeout: 30_000 },
    );
    await expect(coupons.getCouponTitle(title)).toBeVisible({
      timeout: 30_000,
    });
    console.log(`created coupon "${title}"`);
  });
});
