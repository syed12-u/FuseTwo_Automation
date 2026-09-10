import { test, expect } from '@playwright/test';
import CouponsOffersPage from '../../pages/CouponsOffersPage';
import { navigateToHome } from '../../utility/navigationUtils';
import { AUTH_FILE } from '../../config/environment';
import {
  COUPON_CODE_PREFIX,
  COUPON_CREATE_SUCCESS_MESSAGE,
  COUPON_DESCRIPTION_PREFIX,
  COUPON_DESTINATION_URL,
  COUPON_PROGRAM_NAME,
  COUPON_PUBLISHER_REQUIRED_MESSAGE,
  COUPON_TITLE_PREFIX,
  COUPON_UPDATE_SUCCESS_MESSAGE,
  RANDOME_STRING_INPUT_VALUE,
  RANDOM_STRING_LENGTH,
} from '../../fixtures/testConstants';

test.describe('Coupons & Offers Flow', () => {
  test.use({ storageState: AUTH_FILE });

  // Coupon CREATE is now fixed and covered green by e2e/Coupons/testCouponCreate.spec.ts
  // (the original blocker was a Destination-URL/program-domain mismatch — see
  // COUPON_DESTINATION_URL). This longer create+update+toggle lifecycle still
  // needs its edit-mode selectors refreshed (setCouponCode/openEditForCoupon in
  // the edit view), so it stays skipped until those are updated.
  test.skip('Create, update, and toggle coupon', async ({ page }) => {
    await navigateToHome(page);

    const couponsPage = new CouponsOffersPage(page);
    await couponsPage.openCouponsAndOffers();
    await couponsPage.filterByProgram(COUPON_PROGRAM_NAME);

    const createRandom = generateRandomString(RANDOM_STRING_LENGTH, RANDOME_STRING_INPUT_VALUE);
    const updateRandom = generateRandomString(RANDOM_STRING_LENGTH, RANDOME_STRING_INPUT_VALUE);

    const couponTitle = `${COUPON_TITLE_PREFIX}${createRandom}`;
    const couponDescription = `${COUPON_DESCRIPTION_PREFIX}${createRandom}`;
    const couponCode = `${COUPON_CODE_PREFIX}${createRandom}`;
    const updatedCouponCode = `${COUPON_CODE_PREFIX}${updateRandom}`;

    await couponsPage.startAddCoupon();
    await couponsPage.selectProgram(COUPON_PROGRAM_NAME);
    await couponsPage.fillCouponDetails({
      destinationUrl: COUPON_DESTINATION_URL,
      title: couponTitle,
      description: couponDescription,
      couponCode,
    });
    // await couponsPage.clickAndRefillDestinationURL(COUPON_DESTINATION_URL);
    await couponsPage.selectActiveDate('1');
    await couponsPage.selectExpireDate('28');
    await couponsPage.goNext();
    await couponsPage.markVisibleToSelectedPublishers();
    await couponsPage.addPublisher();
    await couponsPage.saveCoupon();

    await expect(couponsPage.alertMessage).toContainText(COUPON_CREATE_SUCCESS_MESSAGE);
    await expect(couponsPage.alertMessage).toBeVisible();
    await expect(couponsPage.getCouponTitle(couponTitle)).toBeVisible();

    await couponsPage.openEditForCoupon(couponTitle);
    // await couponsPage.clickAndRefillDestinationURL(COUPON_DESTINATION_URL);
    await couponsPage.setCouponCode(updatedCouponCode);
    await couponsPage.goNext();
    await couponsPage.updateCoupon();
    await expect(couponsPage.alertMessage).toContainText(COUPON_UPDATE_SUCCESS_MESSAGE);

    await couponsPage.openEditForCoupon(couponTitle);
    // await couponsPage.clickAndRefillDestinationURL(COUPON_DESTINATION_URL);
    await couponsPage.goNext();
    await couponsPage.removePublisher();
    await couponsPage.updateCoupon();
    await expect(couponsPage.publisherRequiredMessage).toContainText(
      COUPON_PUBLISHER_REQUIRED_MESSAGE,
    );
    await couponsPage.addPublisher();
    await couponsPage.updateCoupon();
    await expect(couponsPage.alertMessage).toContainText(COUPON_UPDATE_SUCCESS_MESSAGE);

    await couponsPage.openEditForCoupon(couponTitle);
    // await couponsPage.clickAndRefillDestinationURL(COUPON_DESTINATION_URL);
    await couponsPage.goNext();
    await couponsPage.disableCoupon();
    await couponsPage.openDisabledTab();
    await expect(couponsPage.getCouponTitle(couponTitle)).toBeVisible();

    await couponsPage.openEditForCoupon(couponTitle);
    // await couponsPage.clickAndRefillDestinationURL(COUPON_DESTINATION_URL);
    await couponsPage.goNext();
    await couponsPage.enableCoupon();
    await couponsPage.openActiveTab();
    await expect(couponsPage.getCouponTitle(couponTitle)).toBeVisible();

    await couponsPage.openEditForCoupon(couponTitle);
    // await couponsPage.clickAndRefillDestinationURL(COUPON_DESTINATION_URL);
    await couponsPage.goNext();
    await couponsPage.disableCoupon();
    await couponsPage.openDisabledTab();
    await expect(couponsPage.getCouponTitle(couponTitle)).toBeVisible();
  });
});

function generateRandomString(length: number, chars: string): string {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
