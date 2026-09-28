import { expect, test } from "@playwright/test";
import CouponsOffersPage from "../../pages/CouponsOffersPage";
import { AUTH_FILE } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";
import {
  COUPON_CODE_PREFIX,
  COUPON_DESTINATION_URL,
  COUPON_PROGRAM_NAME,
  COUPON_TITLE_PREFIX,
  REQUIRED_FIELD_MESSAGE,
} from "../../fixtures/testConstants";

/**
 * Coupons & Offers — required-field validation. Nothing is saved: the wizard
 * must refuse to leave step 1 while Description is empty.
 */
test.describe("Coupons & Offers - validation", () => {
  test.use({ storageState: AUTH_FILE });

  test("an empty Description blocks Next with a required-field error @blocker", async ({
    page,
  }) => {
    const coupons = new CouponsOffersPage(page);
    await coupons.openCouponsAndOffers();
    await dismissPaymentReminderIfPresent(page);

    const suffix = Math.random().toString(36).slice(2, 8);
    await coupons.startAddCoupon();
    await page.waitForTimeout(1000);
    await page
      .getByRole("button", { name: /^No$/ })
      .click({ timeout: 4000 })
      .catch(() => {});

    await coupons.selectProgram(COUPON_PROGRAM_NAME);
    // Every field except Description.
    await coupons.destinationUrlInput.fill(COUPON_DESTINATION_URL);
    await coupons.textLinkContentInput.fill(`${COUPON_TITLE_PREFIX}${suffix}`);
    await coupons.promotionTypeDropdown.click();
    await page.getByRole("option", { name: "Coupon", exact: true }).click();
    await coupons.couponCodeInput.fill(`${COUPON_CODE_PREFIX}${suffix}`);
    await coupons.selectActiveDate("1", "12:00 AM");
    await coupons.selectExpireDate("28", "11:59 PM");
    // The read-only time fields hold what the clock dialog was given.
    await expect(coupons.activeTimeInput).toHaveValue("12:00 AM");
    await expect(coupons.expireTimeInput).toHaveValue("11:59 PM");
    expect(await coupons.autoRenewState()).toBe("No");

    await coupons.goNext();

    // Still on step 1: the description is flagged and the targeting step never renders.
    await expect(coupons.descriptionInput).toBeVisible();
    await expect(coupons.descriptionInput).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(REQUIRED_FIELD_MESSAGE).first()).toBeVisible();
    await expect(page.getByText("Visible to selected publishers")).toBeHidden();
  });
});
