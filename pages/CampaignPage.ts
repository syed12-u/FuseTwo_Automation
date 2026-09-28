import { expect, Locator, Page } from "@playwright/test";
import BasePage from "./BasePage";
import { appUrl, PATHS } from "../config/environment";

/** Everything the wizard was given for one campaign, as the app formats it. */
export interface CreatedCampaign {
  name: string;
  programName: string;
  subcategory: string;
  couponCode: string;
  /** mm/dd/yyyy */
  activeDate: string;
  /** hh:mm AM */
  activeTime: string;
  expireDate: string;
  expireTime: string;
}

export interface CreateCampaignOptions {
  programName?: string;
  couponCode?: string;
  /** Exact Subcategory option; the first option when omitted. */
  subcategory?: string;
  /** "hh:mm AM" — see pickTime. */
  activeTime?: string;
  expireTime?: string;
}

const DEFAULT_ACTIVE_TIME = "09:30 AM";
const DEFAULT_EXPIRE_TIME = "05:45 PM";

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

  /** The listing prints dates as mm-dd-yyyy where the form uses mm/dd/yyyy. */
  static listingDate(formDate: string): string {
    return formDate.replace(/\//g, "-");
  }

  async gotoListing() {
    await this.page.goto(appUrl(PATHS.campaigns), {
      waitUntil: "domcontentloaded",
    });
  }

  /** Pick the first option of an autocomplete combobox; returns its label. */
  private async pickCombo(name: string): Promise<string> {
    await this.page.locator(`[name="${name}"]`).click();
    const option = this.page.getByRole("option").first();
    await expect(option).toBeVisible({ timeout: 10_000 });
    const label = (await option.innerText()).trim();
    await option.click();
    await expect(this.page.locator(`[name="${name}"]`)).toHaveValue(label);
    return label;
  }

  /** Pick a named option in an autocomplete combobox. */
  private async pickComboOption(name: string, option: string) {
    await this.page.locator(`[name="${name}"]`).click();
    await this.page
      .getByRole("option", { name: option, exact: true })
      .click({ timeout: 15_000 });
    await expect(this.page.locator(`[name="${name}"]`)).toHaveValue(option);
  }

  /**
   * Set a read-only time field ("Active Time" / "Expire Time") to `value`,
   * given as "hh:mm AM|PM". The field is a MUI TimePicker: clicking it opens a
   * "Select time" dialog with an analog clock that shows the hours view first
   * and switches to minutes once an hour is chosen, plus AM/PM toggles and OK.
   * The clock face is one hit-mask that maps the pointer angle to a value, so a
   * number is chosen by clicking the face at that number's angle. The field's
   * value is asserted afterwards, so a picker that did not take the time fails
   * here rather than at save.
   */
  async pickTime(name: string, value: string) {
    const { hour, minute, ampm, formatted } = parseTime(value);
    // Close any open date-calendar overlay that could sit over the time field.
    await this.page.keyboard.press("Escape").catch(() => {});
    const field = this.page.locator(`[name="${name}"]`).first();
    await field.scrollIntoViewIfNeeded();
    await field.click({ timeout: 10_000 });

    const dialog = this.page
      .getByRole("dialog")
      .filter({ hasText: /Select time/i })
      .last();
    await expect(dialog, `time picker for "${name}" did not open`).toBeVisible({
      timeout: 10_000,
    });
    await clickClockFace(dialog, "hours", (hour % 12) * 30);
    await clickClockFace(dialog, "minutes", minute * 6);
    await dialog.getByRole("button", { name: ampm, exact: true }).click();
    await dialog.getByRole("button", { name: /^OK$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(field, `"${name}" did not take ${formatted}`).toHaveValue(
      formatted,
    );
  }

  /**
   * Create a campaign through the full wizard. Returns the name used.
   * Ends on the campaigns listing with the "Campaign Created" alert.
   */
  async createCampaign(options: CreateCampaignOptions = {}): Promise<string> {
    return (await this.createCampaignDetailed(options)).name;
  }

  /** As createCampaign, but returns every value the wizard was given. */
  async createCampaignDetailed(
    options: CreateCampaignOptions = {},
  ): Promise<CreatedCampaign> {
    const name = this.randomName();
    await this.page.goto(appUrl(`${PATHS.campaigns}/new`), {
      waitUntil: "domcontentloaded",
    });
    await expect(
      this.page.getByRole("heading", { name: /Add New Campaign/i }),
    ).toBeVisible({ timeout: 30_000 });

    // General section
    let programName = options.programName ?? "";
    if (options.programName) {
      await this.pickComboOption("programName", options.programName);
    } else {
      programName = await this.pickCombo("programName");
    }
    await this.page.locator('[name="campaignName"]').fill(name);
    let subcategory = options.subcategory ?? "";
    if (options.subcategory) {
      await this.pickComboOption("categoryName", options.subcategory);
    } else {
      subcategory = await this.pickCombo("categoryName");
    }
    await this.page
      .locator('textarea[name="description"]')
      .fill("QA automation campaign");
    const activeDate = this.dateFromNow(30);
    const expireDate = this.dateFromNow(60);
    await this.page.locator('[name="activeDate"]').fill(activeDate);
    await this.page.locator('[name="expireDate"]').fill(expireDate);
    const activeTime = options.activeTime ?? DEFAULT_ACTIVE_TIME;
    const expireTime = options.expireTime ?? DEFAULT_EXPIRE_TIME;
    await this.pickTime("activeTime", activeTime);
    await this.pickTime("expiryTime", expireTime);
    if (options.couponCode) {
      await this.page.locator('[name="couponCode"]').fill(options.couponCode);
    }

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
    return {
      name,
      programName,
      subcategory,
      couponCode: options.couponCode ?? "",
      activeDate,
      activeTime: parseTime(activeTime).formatted,
      expireDate,
      expireTime: parseTime(expireTime).formatted,
    };
  }

  /**
   * Listing rows matching `name`. The table also renders hidden duplicate rows
   * (other breakpoints, the other status tab), so only visible ones count.
   */
  campaignRowByName(name: string): Locator {
    return this.page.locator("tbody tr:visible").filter({ hasText: name });
  }

  /** Open a campaign's edit page from the listing and read its saved General fields. */
  async readSavedCampaign(name: string): Promise<Omit<CreatedCampaign, "name">> {
    await this.gotoListing();
    const row = this.campaignRowByName(name).first();
    await expect(row, `campaign "${name}" not found`).toBeVisible({
      timeout: 30_000,
    });
    // The Edit column is an unlabeled icon button (pencil), so find it by icon.
    await row
      .locator("button")
      .filter({ has: this.page.locator('svg[data-testid="EditIcon"]') })
      .first()
      .click();
    await this.page.waitForURL(/\/app\/campaigns\/\d+/, { timeout: 30_000 });
    const field = (n: string) => this.page.locator(`[name="${n}"]`).first();
    await expect(field("campaignName")).toHaveValue(name, { timeout: 30_000 });
    // The Subcategory combobox is filled a beat after the rest of the form,
    // once its option list has loaded; an empty value here means it did not
    // persist.
    await expect(
      field("categoryName"),
      "Subcategory is empty in the edit view",
    ).not.toHaveValue("", { timeout: 30_000 });
    return {
      programName: await field("programName").inputValue(),
      subcategory: await field("categoryName").inputValue(),
      couponCode: await field("couponCode").inputValue(),
      activeDate: await field("activeDate").inputValue(),
      activeTime: await field("activeTime").inputValue(),
      expireDate: await field("expireDate").inputValue(),
      expireTime: await field("expiryTime").inputValue(),
    };
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
      // The table shows "No records available" until GET /api/<id>/campaigns
      // answers (several seconds for a few hundred campaigns), and an empty
      // listing is a legitimate outcome — so anchor on the response, not a row.
      const loaded = this.page
        .waitForResponse(
          (r) =>
            r.request().method() === "GET" &&
            /\/api\/\d+\/campaigns(\?|$)/.test(r.url()),
          { timeout: 30_000 },
        )
        .catch(() => null);
      await this.gotoListing();
      await loaded;
      // The rows render a beat after the response, so wait for a match rather
      // than peek; the one bounded wait that finds nothing ends the sweep.
      const row = this.campaignRowByName(needle).first();
      const found = await row
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      if (!found) break;
      const btn = row.getByRole("button", { name: /deactivate/i }).first();
      if (!(await btn.isVisible().catch(() => false))) break;
      await btn.click();
      await this.page.waitForTimeout(2500);
      count++;
    }
    return count;
  }
}

/** Split "h:mm AM" into parts and the zero-padded "hh:mm AM" the field shows. */
function parseTime(value: string): {
  hour: number;
  minute: number;
  ampm: "AM" | "PM";
  formatted: string;
} {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (!m) throw new Error(`time "${value}" must look like "hh:mm AM"`);
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 1 || hour > 12 || minute > 59) {
    throw new Error(`time "${value}" is not a valid 12-hour time`);
  }
  const ampm = m[3].toUpperCase() as "AM" | "PM";
  return {
    hour,
    minute,
    ampm,
    formatted: `${String(hour).padStart(2, "0")}:${m[2]} ${ampm}`,
  };
}

/**
 * Click the MUI clock face at `degrees` clockwise from 12 o'clock. The numbers
 * sit on a ring at ~42% of the face's width from its centre; the face itself
 * (`.MuiClock-squareMask`) is the only element that takes pointer events and
 * derives the value from the click angle.
 */
async function clickClockFace(
  dialog: Locator,
  view: "hours" | "minutes",
  degrees: number,
) {
  // The listbox is labelled "Select hours. …" / "Select minutes. …", which is
  // how the picker announces which view is showing. It has no box of its own
  // (its numbers are absolutely positioned), so check attachment plus a
  // visible number rather than the wrapper's visibility.
  const listbox = dialog.locator(
    `[role="listbox"][aria-label^="Select ${view}"]`,
  );
  await expect(listbox, `time picker did not show the ${view} view`).toBeAttached({
    timeout: 10_000,
  });
  await expect(listbox.getByRole("option").first()).toBeVisible({
    timeout: 10_000,
  });
  const face = dialog.locator(".MuiClock-squareMask");
  const box = await face.boundingBox();
  if (!box) throw new Error("time picker clock face is not rendered");
  const radius = box.width * 0.42;
  const rad = (degrees * Math.PI) / 180;
  await face.click({
    position: {
      x: box.width / 2 + radius * Math.sin(rad),
      y: box.height / 2 - radius * Math.cos(rad),
    },
  });
}
