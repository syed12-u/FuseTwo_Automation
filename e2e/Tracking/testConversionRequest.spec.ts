import { expect, test } from "@playwright/test";
import { AUTH_FILE } from "../../config/environment";
import ConversionTrackingPage from "../../pages/ConversionTrackingPage";
import { TRACKING_PROGRAM_NAME } from "../../fixtures/testConstants";
import {
  installMerchantSite,
  placeOrder,
  sampleOrder,
} from "../../utility/trackingSimulator";

/**
 * Browser-side check of the conversion call: the confirmation-page script
 * (with this program's Advertiser ID) must POST the order to da.ashx on the
 * tracking host with every parameter, the line items as the JSON body, and get
 * a successful answer. There is no publisher click in this test, so the
 * endpoint's expected answer is "No click ID found" — the order is not
 * attributed and no sale is recorded.
 */
test.describe("Conversion tracking request (network)", () => {
  test.use({ storageState: AUTH_FILE });

  test("confirmation page posts the order to da.ashx with all parameters @write", async ({
    page,
    context,
  }) => {
    const tracking = new ConversionTrackingPage(page);
    await tracking.goto();
    await tracking.openJavaScriptWizard(TRACKING_PROGRAM_NAME);
    await tracking.goToImplementation();
    await tracking.goToIntegration();
    const advertiserId = await tracking.advertiserIdField.inputValue();

    const order = sampleOrder();
    await installMerchantSite(context, advertiserId, order);
    const shop = await context.newPage();
    const { request, response, params, items } = await placeOrder(shop);

    expect(request.method()).toBe("POST");
    expect(new URL(request.url()).host).toMatch(/^track.*\.fusetwo\.com$/);
    expect(request.headers()["content-type"]).toContain("application/json");

    expect(params.get("advertiserid")).toBe(advertiserId);
    expect(params.get("ordernumber")).toBe(order.order_number);
    expect(Number(params.get("orderamount"))).toBe(order.order_amount);
    expect(params.get("coupon")).toBe(order.order_coupon);
    expect(params.get("currency")).toBe(order.order_currency);
    expect(params.get("geo")).toBe(order.order_geo);
    expect(params.get("commissionid")).toBe(order.order_commissionid);
    expect(params.get("platform")).toBe("JavaScript");

    expect(items).toHaveLength(order.order_items.length);
    order.order_items.forEach((expected, i) => {
      expect(items[i]).toMatchObject({
        sku: expected.sku,
        amount: expected.amount,
        quantity: expected.quantity,
      });
    });

    expect(response, "da.ashx never answered").not.toBeNull();
    expect(response!.status()).toBe(200);
    expect(await response!.text()).toMatch(/No click ID found/i);
  });
});
