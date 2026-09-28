import { expect, test } from "@playwright/test";
import { AUTH_FILE } from "../../config/environment";
import ConversionTrackingPage, {
  TRACKING_PARAMETERS,
  TrackingParameter,
} from "../../pages/ConversionTrackingPage";
import ReconcileSalesPage from "../../pages/ReconcileSalesPage";
import {
  TRACKING_PROGRAM_ID,
  TRACKING_PROGRAM_NAME,
} from "../../fixtures/testConstants";

/**
 * Settings → Conversion Tracking: program selection, the entry-page and
 * confirmation-page scripts, every parameter the integration step exposes,
 * and the Copy control over each script (a button holding <img alt="Copy">,
 * floating over the code block on the Implementation and Integration steps).
 * Read-only — the dialog never saves anything.
 */
test.describe("Conversion Tracking - JavaScript integration", () => {
  test.use({ storageState: AUTH_FILE });

  let tracking: ConversionTrackingPage;

  /** Whitespace-insensitive form, so indentation differences do not matter. */
  const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

  test.beforeEach(async ({ page }) => {
    tracking = new ConversionTrackingPage(page);
    await tracking.goto();
  });

  test("offers JavaScript, Server 2 Server and Ecommerce Plugins @smoke", async () => {
    for (const name of ["JAVASCRIPT", "SERVER 2 SERVER", "ECOMMERCE PLUGINS"] as const) {
      await expect(tracking.tab(name), `tab "${name}" missing`).toBeVisible();
    }
    await expect(tracking.getJavaScriptButton).toBeVisible();
  });

  test("entry-page script loads the tracking library and stores the click @blocker", async () => {
    await tracking.openJavaScriptWizard(TRACKING_PROGRAM_NAME);
    const code = await tracking.goToImplementation();

    expect(code).toContain("FuseTwo.tracking.lib.js");
    expect(code).toMatch(/FuseTwoTrack\.init\("[0-9a-f-]{36}"\)/);
    expect(code).toContain("FuseTwoTrack.getClick()");
  });

  test("integration step exposes every tracking parameter @blocker", async () => {
    await tracking.openJavaScriptWizard(TRACKING_PROGRAM_NAME);
    await tracking.goToImplementation();
    await tracking.goToIntegration();

    await expect(tracking.advertiserIdField).toHaveValue(/^[0-9a-f-]{36}$/);
    for (const [label, { placeholder }] of Object.entries(TRACKING_PARAMETERS)) {
      await expect(
        tracking.parameterField(label as TrackingParameter),
        `parameter "${label}"`,
      ).toHaveValue(placeholder);
    }

    const code = await tracking.generatedCode();
    const advertiserId = await tracking.advertiserIdField.inputValue();
    expect(code).toContain(`FuseTwoTrack.init("${advertiserId}")`);
    expect(code).toContain("FuseTwoTrack.track(");
    for (const snippet of [
      "order_number: '{{order_number}}'",
      "order_amount: {{order_amount}}",
      "order_coupon: '{{coupon}}'",
      "order_currency: '{{currency}}'",
      "order_geo: '{{geo}}'",
      "order_commissionid: '{{commissionId}}'",
      "order_items:",
      'order_platform: "JavaScript"',
    ]) {
      expect(code, `generated code is missing ${snippet}`).toContain(snippet);
    }
  });

  test("Advertiser ID matches the program's tracking ID from the API", async ({ page }) => {
    test.skip(TRACKING_PROGRAM_ID === undefined, "program id not recorded for this environment");
    await tracking.openJavaScriptWizard(TRACKING_PROGRAM_NAME);
    await tracking.goToImplementation();
    await tracking.goToIntegration();
    const shown = await tracking.advertiserIdField.inputValue();

    const api = await new ReconcileSalesPage(page).getAdvertiserTracking(
      TRACKING_PROGRAM_ID!,
    );
    expect(api?.result?.trackingID).toBe(shown);
  });

  test("editing a parameter rewrites the confirmation script", async () => {
    await tracking.openJavaScriptWizard(TRACKING_PROGRAM_NAME);
    await tracking.goToImplementation();
    await tracking.goToIntegration();

    await tracking.parameterField("Order Amount").fill("{{cart_total}}");
    await tracking.parameterField("Coupon").fill("{{promo_code}}");

    await expect
      .poll(() => tracking.generatedCode())
      .toContain("order_amount: {{cart_total}}");
    expect(await tracking.generatedCode()).toContain(
      "order_coupon: '{{promo_code}}'",
    );
  });

  test.describe("Copy button", () => {
    // navigator.clipboard.readText() rejects without these permissions.
    test.use({ permissions: ["clipboard-read", "clipboard-write"] });

    test("copies the entry-page script to the clipboard @blocker", async () => {
      await tracking.openJavaScriptWizard(TRACKING_PROGRAM_NAME);
      const shown = await tracking.goToImplementation();
      await expect(tracking.copyButton).toBeVisible();

      const copied = await tracking.copyGeneratedCode();

      expect(copied.length).toBeGreaterThan(0);
      expect(collapse(copied)).toBe(collapse(shown));
      expect(copied).toMatch(/FuseTwoTrack\.init\("[0-9a-f-]{36}"\)/);
      expect(copied).toContain("FuseTwoTrack.getClick()");
    });

    test("copies the confirmation script, including edited parameters", async () => {
      await tracking.openJavaScriptWizard(TRACKING_PROGRAM_NAME);
      await tracking.goToImplementation();
      await tracking.goToIntegration();
      await tracking.parameterField("Order Number").fill("{{invoice_id}}");
      await expect
        .poll(() => tracking.generatedCode())
        .toContain("order_number: '{{invoice_id}}'");

      const shown = await tracking.generatedCode();
      const copied = await tracking.copyGeneratedCode();

      expect(collapse(copied)).toBe(collapse(shown));
      expect(copied).toContain("FuseTwoTrack.track(");
      expect(copied).toContain("order_number: '{{invoice_id}}'");
    });
  });
});
