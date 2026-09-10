import { expect, test } from "@playwright/test";
import { AUTH_FILE, appUrl, PATHS } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Coupons & Offers — listing, status tabs, action entry points, and the
 * Add-Coupon wizard's required fields. Read/validation only (no coupon is
 * created; end-to-end create is blocked by a program-data issue documented in
 * testCouponsOffers.spec.ts). Safe on every environment.
 */
const REQUIRED_LABELS = [
  "Program",
  "Destination URL",
  "Text Link Content",
  "Description",
  "Promotion Type",
  "Coupon Code",
  "Active Date",
  "Expire Date",
];

test.describe("Coupons & Offers - listing and Add form", () => {
  test.use({ storageState: AUTH_FILE });

  test.beforeEach(async ({ page }) => {
    await page.goto(appUrl(PATHS.couponsAndOffers), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
  });

  test("the listing loads with its status tabs @blocker @smoke", async ({
    page,
  }) => {
    for (const tab of ["ACTIVE", "INACTIVE", "DISABLED"]) {
      await expect(
        page.getByRole("tab", { name: new RegExp(`^${tab}`, "i") }),
        `tab "${tab}" missing from Coupons & Offers`,
      ).toBeVisible();
    }
    await expect(page.locator("body")).not.toContainText(
      /502 Bad Gateway|Internal Server Error|Application error/i,
    );
  });

  test("the action entry points are present @blocker", async ({ page }) => {
    for (const label of ["Add Coupon or Offer", "Bulk Import", "Export"]) {
      await expect(
        page.getByRole("button", { name: new RegExp(label, "i") }).first(),
        `action "${label}" missing`,
      ).toBeVisible();
    }
  });

  test("Add Coupon or Offer opens the wizard with required fields @crud", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: /Add Coupon or Offer/i })
      .first()
      .click();

    await expect(
      page.getByText(/Add Coupon or Offer/i).first(),
    ).toBeVisible({ timeout: 30_000 });

    for (const label of REQUIRED_LABELS) {
      await expect(
        page.locator("label").filter({ hasText: new RegExp(label) }).first(),
        `required field "${label}" missing from Add Coupon form`,
      ).toBeVisible({ timeout: 30_000 });
    }
  });
});
