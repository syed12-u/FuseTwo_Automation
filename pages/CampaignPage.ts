import { expect, Locator, Page } from "@playwright/test";
import BasePage from "./BasePage";
import { appUrl, PATHS } from "../config/environment";

/**
 * Add Campaign is a multi-section wizard (General → Links → Payout). The
 * General section carries autocomplete comboboxes (Program, Subcategory),
 * editable date inputs and read-only time pickers; the Links section carries
 * the Destination URL; the final section exposes Save.
 */
export default class CampaignPage extends BasePage {
  readonly successAlert: Locator;

  constructor(page: Page) {
    super(page);
    this.successAlert = page.getByRole("alert");
  }

  private randomName(): string {
    const s = Math.random().toString(36).slice(2, 7);
    return `testautocampaign${s}`;
  }

  /** mm/dd/yyyy `days` from today. */
  private dateFromNow(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${mm}/${dd}/${d.getFullYear()}`;
  }

  async gotoListing() {
    await this.page.goto(appUrl(PATHS.campaigns), {
      waitUntil: "domcontentloaded",
    });
  }

  private async pickCombo(name: string) {
    await this.page.locator(`[name="${name}"]`).click();
    await this.page.waitForTimeout(700);
    await this.page.getByRole("option").first().click({ timeout: 10_000 });
    await this.page.waitForTimeout(400);
  }

  private async pickTime(name: string) {
    // Close any open date-calendar overlay that could sit over the time field.
    await this.page.keyboard.press("Escape").catch(() => {});
    const field = this.page.locator(`[name="${name}"]`);
    await field.scrollIntoViewIfNeeded();
    await field.click({ timeout: 10_000 });
    await this.page.waitForTimeout(600);
    await this.page
      .getByRole("option")
      .first()
      .click({ timeout: 8_000 })
      .catch(() => {});
    await this.page.keyboard.press("Escape").catch(() => {});
    await this.page.waitForTimeout(400);
  }

  /**
   * Create a campaign through the full wizard. Returns the name used.
   * Ends on the campaigns listing with the "Campaign Created" alert.
   */
  async createCampaign(): Promise<string> {
    const name = this.randomName();
    await this.page.goto(appUrl(`${PATHS.campaigns}/new`), {
      waitUntil: "domcontentloaded",
    });
    await expect(
      this.page.getByRole("heading", { name: /Add New Campaign/i }),
    ).toBeVisible({ timeout: 30_000 });

    // General section
    await this.pickCombo("programName");
    await this.page.locator('[name="campaignName"]').fill(name);
    await this.pickCombo("categoryName");
    await this.page
      .locator('textarea[name="description"]')
      .fill("QA automation campaign");
    await this.page.locator('[name="activeDate"]').fill(this.dateFromNow(30));
    await this.page.locator('[name="expireDate"]').fill(this.dateFromNow(60));
    await this.pickTime("activeTime");
    await this.pickTime("expiryTime");

    await this.page
      .getByRole("button", { name: /^Continue$/i })
      .first()
      .click();
    await this.page.waitForTimeout(1500);

    // Links section
    const dest = this.page.getByRole("textbox", { name: /Destination URL/i });
    await expect(dest.first()).toBeVisible({ timeout: 30_000 });
    await dest.first().fill(`https://${name}.com`);

    // Final section → Save
    await this.page
      .getByRole("button", { name: /^Save$/i })
      .first()
      .click();

    await expect(this.successAlert).toContainText(/Campaign Created/i, {
      timeout: 30_000,
    });
    return name;
  }

  campaignRowByName(name: string): Locator {
    return this.page.locator("tbody tr").filter({ hasText: name });
  }

  /** Deactivate a campaign from its listing row (no confirm dialog). */
  async deactivateCampaign(name: string) {
    await this.gotoListing();
    const row = this.campaignRowByName(name).first();
    await expect(row, `campaign "${name}" not found`).toBeVisible({
      timeout: 30_000,
    });
    await row
      .getByRole("button", { name: /deactivate/i })
      .first()
      .click();
    await this.page.waitForTimeout(2500);
  }

  /** Deactivate every Active campaign whose name contains `needle`. */
  async deactivateAllMatching(needle: string, max = 20): Promise<number> {
    let count = 0;
    for (let i = 0; i < max; i++) {
      await this.gotoListing();
      await this.page.waitForTimeout(1500);
      const row = this.campaignRowByName(needle).first();
      if (!(await row.isVisible().catch(() => false))) break;
      const btn = row.getByRole("button", { name: /deactivate/i }).first();
      if (!(await btn.isVisible().catch(() => false))) break;
      await btn.click();
      await this.page.waitForTimeout(2500);
      count++;
    }
    return count;
  }
}
