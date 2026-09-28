import { expect, test } from "@playwright/test";
import { AUTH_FILE } from "../../config/environment";
import ConversionTrackingPage from "../../pages/ConversionTrackingPage";
import TrackingDiagnosisPage from "../../pages/TrackingDiagnosisPage";
import { TRACKING_PROGRAM_NAME } from "../../fixtures/testConstants";
import {
  installMerchantSite,
  MERCHANT_ORIGIN,
  placeOrder,
  sampleOrder,
} from "../../utility/trackingSimulator";

/**
 * Support → Tracking Diagnosis: pick a program, follow the publisher test
 * link, buy on the (simulated) merchant site, then come back and confirm the
 * test transaction was recorded as a success with no error.
 */
test.describe("Tracking Diagnosis Tool", () => {
  test.use({ storageState: AUTH_FILE });

  test("wizard issues a publisher test link and lists the purchase steps @blocker", async ({
    page,
  }) => {
    const diagnosis = new TrackingDiagnosisPage(page);
    await diagnosis.goto();
    const link = await diagnosis.diagnoseProgram(TRACKING_PROGRAM_NAME);

    expect(link).toMatch(
      /\/g\.ashx\?foid=156464\.\d+\.\d+&trid=\d+\.\d+&trackingid=\d+$/,
    );
    for (const step of [
      /Purchase products/i,
      /Add more than 2 items/i,
      /apply a discount/i,
      /Return here to/i,
    ]) {
      await expect(diagnosis.instruction(step)).toBeVisible();
    }
    for (const header of ["Program Name", "Test Date", "Status", "Error Message"]) {
      await expect(
        diagnosis.resultsTable.getByRole("columnheader", { name: header }),
      ).toBeVisible();
    }
  });

  // Found 2026-09-24 during flow discovery on staging: every program's test
  // link (g.ashx) answers 500 with an ASP.NET "Server Error in '/' Application
  // — NullReferenceException" page instead of redirecting to the advertiser,
  // so no test transaction can be created. Not yet reported.
  test("publisher test link redirects to the advertiser site @known-bug", async ({
    page,
  }) => {
    const diagnosis = new TrackingDiagnosisPage(page);
    await diagnosis.goto();
    const link = await diagnosis.diagnoseProgram(TRACKING_PROGRAM_NAME);

    const response = await page.request.get(link, { maxRedirects: 0 });
    expect(response.status(), await response.text()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers()["location"]).toBeTruthy();
  });

  // Depends on the redirect above, so it is guarded by the same defect.
  test("test purchase is reported as a successful transaction @write @known-bug", async ({
    page,
    context,
  }) => {
    test.setTimeout(6 * 60_000);

    const tracking = new ConversionTrackingPage(page);
    await tracking.goto();
    await tracking.openJavaScriptWizard(TRACKING_PROGRAM_NAME);
    await tracking.goToImplementation();
    await tracking.goToIntegration();
    const advertiserId = await tracking.advertiserIdField.inputValue();

    const diagnosis = new TrackingDiagnosisPage(page);
    await diagnosis.goto();
    const link = await diagnosis.diagnoseProgram(TRACKING_PROGRAM_NAME);

    // Follow the publisher link only as far as its redirect, then land on the
    // simulated merchant with the same query string (it carries the click id).
    const redirect = await page.request.get(link, { maxRedirects: 0 });
    const location = redirect.headers()["location"];
    expect(location, "publisher link did not redirect").toBeTruthy();
    const landing = new URL(location, link);

    const order = sampleOrder();
    await installMerchantSite(context, advertiserId, order);
    const shop = await context.newPage();
    await shop.goto(`${MERCHANT_ORIGIN}/landing${landing.search}`);
    await expect
      .poll(async () =>
        (await context.cookies(MERCHANT_ORIGIN)).some((c) =>
          c.name.startsWith("FuseTwo_clickId"),
        ),
      )
      .toBe(true);

    const conversion = await placeOrder(shop);
    expect(conversion.params.get("clickid")).toBeTruthy();
    expect(conversion.response?.status()).toBe(200);
    await shop.close();

    // Back on FuseTwo: the transaction appears as a success with no error.
    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await diagnosis.diagnoseProgram(TRACKING_PROGRAM_NAME);
      await expect(diagnosis.resultRows(TRACKING_PROGRAM_NAME).first()).toBeVisible({
        timeout: 5_000,
      });
    }).toPass({ timeout: 4 * 60_000, intervals: [15_000] });

    const row = diagnosis.resultRows(TRACKING_PROGRAM_NAME).first();
    await expect(row).toContainText(/success/i);
    await expect(row.locator("td").last()).toHaveText(/^\s*$/);
  });
});
