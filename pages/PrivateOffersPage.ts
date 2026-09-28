import { expect, Locator, Page } from "@playwright/test";
import BasePage from "./BasePage";
import { appUrl } from "../config/environment";
import { dismissPaymentReminderIfPresent } from "../utility/appActions";

export type OfferModel = "Fixed" | "Tier Fixed" | "Tier Cumulative";

export interface PrivateOfferInput {
  programName: string;
  name: string;
  description: string;
  offerModel?: OfferModel;
  referralPeriod?: number;
  amount: number;
  /** mm/dd/yyyy */
  startDate: string;
  /** mm/dd/yyyy */
  endDate: string;
}

/** Field values as the View / Edit dialogs display them (all strings). */
export interface PrivateOfferDetails {
  programName: string;
  name: string;
  description: string;
  offerModel: string;
  referralPeriod: string;
  amount: string;
  /** MM/DD/YYYY */
  startDate: string;
  /** MM/DD/YYYY */
  endDate: string;
}

export type OfferRowAction = "View Offer" | "Edit";

/**
 * Publishers → Private Offers (/app/publishers/privateoffers).
 *
 * "Add Private Offer" opens a "Create Private Offer" dialog. The date inputs
 * accept typed mm/dd/yyyy but pop a calendar that must be closed before the
 * next field is usable. Saved offers land in Active (start date today or
 * earlier) or Inactive (future start). There is no delete in the UI.
 *
 * Each row's Actions cell has "View Offer" (read-only "Display Private Offer"
 * dialog), "View Publishers" and "Edit" ("Update Private Offer" dialog with
 * SAVE). Both detail dialogs reuse the create form's field names.
 */
export default class PrivateOffersPage extends BasePage {
  readonly addButton: Locator;
  readonly dialog: Locator;
  readonly viewDialog: Locator;
  readonly editDialog: Locator;
  readonly saveButton: Locator;
  readonly successAlert: Locator;

  constructor(page: Page) {
    super(page);
    this.addButton = page.getByRole("button", { name: /add private offer/i });
    this.dialog = page
      .locator(".MuiDialog-paper")
      .filter({ hasText: "Create Private Offer" });
    this.viewDialog = page
      .locator(".MuiDialog-paper")
      .filter({ hasText: "Display Private Offer" });
    this.editDialog = page
      .locator(".MuiDialog-paper")
      .filter({ hasText: "Update Private Offer" });
    this.saveButton = this.dialog.getByRole("button", { name: /^Save$/i });
    this.successAlert = page.getByRole("alert");
  }

  async goto() {
    await this.page.goto(appUrl("/app/publishers/privateoffers"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(this.page);
    await expect(this.addButton).toBeVisible({ timeout: 30_000 });
  }

  tab(name: "Active" | "Inactive" | "Recruitment" | "Expired"): Locator {
    return this.page.getByRole("tab", { name: new RegExp(`^${name}`, "i") });
  }

  private async typeDate(name: string, value: string) {
    const input = this.dialog.locator(`[name="${name}"]`);
    await input.click();
    await input.press("Control+A");
    await input.fill(value);
    // Close the calendar popover by clicking the dialog title.
    await this.dialog.getByText("Create Private Offer", { exact: true }).click();
    await this.page.waitForTimeout(400);
  }

  async create(offer: PrivateOfferInput) {
    await this.addButton.click();
    await expect(this.dialog).toBeVisible({ timeout: 30_000 });

    await this.dialog.locator('[name="programName"]').click();
    await this.page
      .getByRole("option", { name: offer.programName, exact: true })
      .click();
    await this.dialog.locator('[name="name"]').fill(offer.name);
    await this.dialog
      .locator('textarea[name="description"]')
      .fill(offer.description);

    if (offer.offerModel) {
      await this.dialog.locator("#mui-component-select-offerModel").click();
      await this.page
        .getByRole("option", { name: offer.offerModel, exact: true })
        .click();
    }
    if (offer.referralPeriod !== undefined) {
      await this.dialog
        .locator('[name="referralPeriod"]')
        .fill(String(offer.referralPeriod));
    }
    await this.dialog
      .locator('[name="privateOfferAmount"]')
      .fill(String(offer.amount));
    await this.typeDate("startDate", offer.startDate);
    await this.typeDate("endDate", offer.endDate);

    await this.saveButton.click();
    await expect(this.successAlert).toContainText(/Private offer created/i, {
      timeout: 30_000,
    });
  }

  /** Visible rows for an offer (the table repeats per breakpoint, like Publisher List). */
  offerRow(name: string): Locator {
    return this.page.locator("tbody tr:visible").filter({ hasText: name });
  }

  /** Click a row action and return the dialog it opened. */
  async openOffer(name: string, action: OfferRowAction): Promise<Locator> {
    await this.offerRow(name)
      .first()
      .getByRole("button", { name: action, exact: true })
      .click();
    const dialog = action === "Edit" ? this.editDialog : this.viewDialog;
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    return dialog;
  }

  /** Read every field of a View / Edit dialog as displayed. */
  async readOffer(dialog: Locator): Promise<PrivateOfferDetails> {
    // The program is an (always disabled) autocomplete whose input has no
    // name; it is the only combobox in the dialog.
    await expect(dialog.locator('[name="name"]')).not.toHaveValue("", { timeout: 15_000 });
    return {
      programName: await dialog.getByRole("combobox").first().inputValue(),
      name: await dialog.locator('[name="name"]').inputValue(),
      description: await dialog.locator('textarea[name="description"]').first().inputValue(),
      offerModel: await dialog.locator('[name="offerModel"]').inputValue(),
      referralPeriod: await dialog.locator('[name="referralPeriod"]').inputValue(),
      amount: await dialog.locator('[name="privateOfferAmount"]').inputValue(),
      startDate: await dialog.locator('[name="startDate"]').inputValue(),
      endDate: await dialog.locator('[name="endDate"]').inputValue(),
    };
  }

  /** CLOSE a detail dialog without saving. */
  async closeDialog(dialog: Locator) {
    await dialog.getByRole("button", { name: /^Close$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  }

  /** mm/dd/yyyy `days` from today. */
  static dateFromNow(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${mm}/${dd}/${d.getFullYear()}`;
  }
}
