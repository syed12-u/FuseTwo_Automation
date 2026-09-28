import { expect, Locator, Page } from "@playwright/test";
import BasePage from "./BasePage";
import { appUrl, PATHS } from "../config/environment";
import { dismissPaymentReminderIfPresent } from "../utility/appActions";

/** Integration-step parameter inputs, keyed by the label the dialog renders. */
export const TRACKING_PARAMETERS = {
  "Order Amount": { name: "orderamount", placeholder: "{{order_amount}}" },
  "Order Number": { name: "ordernumber", placeholder: "{{order_number}}" },
  Coupon: { name: "coupon", placeholder: "{{coupon}}" },
  Currency: { name: "currency", placeholder: "{{currency}}" },
  "Geo Location": { name: "geo", placeholder: "{{geo}}" },
  "Commission ID": { name: "commissionID", placeholder: "{{commissionId}}" },
} as const;

export type TrackingParameter = keyof typeof TRACKING_PARAMETERS;

/**
 * Settings → Conversion Tracking (/app/settings/trackingpixel).
 *
 * The page offers three integrations as tabs (JavaScript, Server 2 Server,
 * Ecommerce Plugins). "GET JAVASCRIPT" opens a three-step dialog:
 *   1 Select a Program → 2 Implementation (entry-page script)
 *   → 3 Integration (Advertiser ID + parameter inputs + confirmation-page script).
 * The parameter inputs are bound to the generated confirmation script, so
 * editing one rewrites the code shown beneath it.
 */
export default class ConversionTrackingPage extends BasePage {
  readonly dialog: Locator;
  readonly getJavaScriptButton: Locator;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly advertiserIdField: Locator;
  /**
   * The copy control floating over the current code block. It is a MUI button
   * whose only content is an <img alt="Copy">, which gives it its name.
   */
  readonly copyButton: Locator;

  constructor(page: Page) {
    super(page);
    this.getJavaScriptButton = page.getByRole("button", {
      name: /GET JAVASCRIPT/i,
    });
    this.dialog = page
      .getByRole("dialog")
      .filter({ hasText: /Select a Program/ });
    this.nextButton = this.dialog.getByRole("button", { name: "NEXT" });
    this.backButton = this.dialog.getByRole("button", { name: "BACK" });
    this.advertiserIdField = this.dialog.getByRole("textbox", {
      name: "Advertiser ID",
    });
    this.copyButton = this.dialog.getByRole("button", { name: "Copy" }).last();
  }

  async goto() {
    await this.page.goto(appUrl(PATHS.conversionTracking), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(this.page);
    await expect(
      this.page.getByRole("heading", { name: /Getting Started With/i }),
    ).toBeVisible({ timeout: 30_000 });
  }

  tab(name: "JAVASCRIPT" | "SERVER 2 SERVER" | "ECOMMERCE PLUGINS"): Locator {
    return this.page.getByRole("tab", { name });
  }

  /** Open the JavaScript wizard and choose the program (step 1). */
  async openJavaScriptWizard(programName: string) {
    await this.tab("JAVASCRIPT").click();
    await this.getJavaScriptButton.click();
    await expect(this.dialog).toBeVisible({ timeout: 30_000 });
    await this.dialog.locator('input[name="programName"]').click();
    await this.page
      .getByRole("option", { name: programName, exact: true })
      .click();
    await expect(this.dialog.locator('input[name="programName"]')).toHaveValue(
      programName,
    );
  }

  /** Step 2 — the script every entry page must carry. */
  async goToImplementation(): Promise<string> {
    await this.nextButton.click();
    await expect(
      this.dialog.getByText("Entry Page Code", { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    return this.generatedCode();
  }

  /** Step 3 — parameters and the confirmation-page script. */
  async goToIntegration() {
    await this.nextButton.click();
    await expect(this.parameterField("Order Amount")).toBeVisible({
      timeout: 30_000,
    });
  }

  parameterField(parameter: TrackingParameter): Locator {
    return this.dialog.locator(
      `input[name="${TRACKING_PARAMETERS[parameter].name}"]`,
    );
  }

  /** The script currently shown in the dialog (the last code block). */
  async generatedCode(): Promise<string> {
    const code = this.dialog.locator("pre, code").last();
    await expect(code).toBeVisible({ timeout: 30_000 });
    return code.innerText();
  }

  /**
   * Press Copy and return what landed on the clipboard. The browser context
   * must have been created with the clipboard-read / clipboard-write
   * permissions, otherwise readText() rejects.
   */
  async copyGeneratedCode(): Promise<string> {
    await expect(this.copyButton).toBeVisible({ timeout: 30_000 });
    await this.copyButton.click();
    return this.page.evaluate(() => navigator.clipboard.readText());
  }
}
