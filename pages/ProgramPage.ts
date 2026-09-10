import { expect, Page, Locator } from "@playwright/test";
import BasePage from "./BasePage";
import { appUrl, PATHS } from "../config/environment";

export default class ProgramPage extends BasePage {
  // ===== Locators =====
  readonly programsMenuBtn: Locator;
  readonly programsLink: Locator;
  readonly addProgramBtn: Locator;

  readonly programNameInput: Locator;
  readonly domainUrlInput: Locator;
  readonly closeAutomationAssistanceModal: Locator;
  readonly categoryDropdown: Locator;
  readonly categoryOption: Locator;
  readonly countryDropdown: Locator;
  readonly countryOption: Locator;
  readonly generalInformationHeading: Locator;
  readonly descriptionInput: Locator;

  readonly continueBtn: Locator;

  readonly commissionInput: Locator;
  readonly returnDaysInput: Locator;
  readonly payoutInput: Locator;
  readonly subCategoryDropdown: Locator;
  readonly subCategoryOption: Locator;

  readonly manualReviewCheckbox: Locator;

  readonly trackingInput: Locator;
  readonly addKerwordButton: Locator;

  readonly saveContinueBtn: Locator;

  readonly successAlert: Locator;
  readonly programTable: Locator;

  constructor(page: Page) {
    super(page);

    this.programsMenuBtn = page.getByRole("button", { name: " Programs" });
    this.programsLink = page.getByRole("link", { name: "Programs" });
    this.addProgramBtn = page.getByRole("button", { name: "Add Program" });

    this.programNameInput = page.getByRole("textbox", {
      name: "Program Name *",
    });
    this.domainUrlInput = page.getByRole("textbox", { name: "Domain URL *" });

    this.generalInformationHeading = page.getByRole("heading", {
      name: "General information about",
    });

    this.closeAutomationAssistanceModal = page.getByRole("button", {
      name: "No",
    });

    this.categoryDropdown = page.getByRole("combobox", { name: "Category *" });
    this.categoryOption = page.getByRole("option", { name: "Automotive" });

    this.countryDropdown = page.getByRole("combobox", { name: "Country *" });
    this.countryOption = page.getByRole("option", {
      name: "United States",
      exact: true,
    });

    this.descriptionInput = page.getByRole("textbox", {
      name: "Description *",
    });

    this.continueBtn = page.getByRole("button", { name: "Continue" });

    this.commissionInput = page.getByRole("spinbutton", {
      name: "Commission Amount *",
    });
    this.returnDaysInput = page.getByRole("textbox", { name: "Return Days *" });
    this.payoutInput = page.getByRole("textbox", {
      name: "Example: The payout is $25",
    });

    this.subCategoryDropdown = page.getByRole("combobox", {
      name: "Subcategory *",
    });
    this.subCategoryOption = page.getByRole("option", {
      name: "Car Buying and Selling",
    });

    this.manualReviewCheckbox = page.getByRole("checkbox", {
      name: "Manual Review",
    });

    this.trackingInput = page.locator('input[name="searchTag"]');
    this.addKerwordButton = page.getByRole("button", { name: "Add Keywords" });

    this.saveContinueBtn = page.getByRole("button", {
      name: "Save & Continue",
    });

    this.successAlert = page.getByRole("alert");
    this.programTable = page.getByRole("table");
  }

  // ===== Reusable Random Generator (same concept as signup) =====
  private generateRandomAlphaString(length: number): string {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    let result = "";

    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
  }

  private generateProgramName(): string {
    return `testautomationprogram${this.generateRandomAlphaString(5)}`;
  }

  // ===== Navigation =====
  async navigateToPrograms() {
    // Go straight to the listing (the old sidebar-menu traversal relied on a
    // button label that no longer matches), then start a new program.
    await this.gotoListing();
    await expect(this.addProgramBtn).toBeVisible({ timeout: 30_000 });
    await this.addProgramBtn.click();
  }

  async navigateToProgramsMenu() {
    await this.programsMenuBtn.click();
  }

  // ===== Main Flow =====
  async createProgram(): Promise<string> {
    const programName = this.generateProgramName();
    const domain = `https://${programName.toLowerCase()}.com`;

    // Step 1
    await this.programNameInput.fill(programName);
    await this.domainUrlInput.fill(domain);
    await this.generalInformationHeading.click();
    await this.closeAutomationAssistanceModal.click();

    await this.categoryDropdown.click();
    await this.categoryOption.click();

    await this.countryDropdown.click();
    await this.countryOption.click();

    await this.descriptionInput.fill(programName);

    await this.continueBtn.click();

    // Step 2
    await this.commissionInput.fill("10");
    await this.returnDaysInput.fill("7");
    await this.payoutInput.fill(programName);

    await this.subCategoryDropdown.click();
    await this.subCategoryOption.click();

    await this.continueBtn.click();

    // Step 3
    await this.manualReviewCheckbox.check();
    await this.continueBtn.click();

    // Step 4
    await this.trackingInput.fill(programName);
    await this.page.waitForTimeout(1000);

    await this.addKerwordButton.click();

    await this.saveContinueBtn.click();

    return programName;
  }

  async goToProgramsList() {
    await this.programsLink.click();
  }

  // ===== Dynamic Locator =====
  getProgramRow(programName: string): Locator {
    return this.page.getByRole("cell", { name: `${programName} All` });
  }

  // ===== Read / navigation (safe, no writes) =====

  /** Column headers the programs listing must expose. */
  static readonly LISTING_COLUMNS = [
    "Program ID",
    "Program Name",
    "Payout",
    "Campaigns",
    "Status",
    "Actions",
  ] as const;

  /** Status tab by the label prefix the app renders, e.g. "Active Programs (129)". */
  statusTab(prefix: "Active" | "Pending" | "Deactivated"): Locator {
    return this.page.getByRole("tab", {
      name: new RegExp(`${prefix} Programs`),
    });
  }

  /** Go straight to the programs listing (no menu traversal). */
  async gotoListing() {
    await this.page.goto(appUrl(PATHS.programs), {
      waitUntil: "domcontentloaded",
    });
  }

  /** All data rows currently in the listing table. */
  dataRows(): Locator {
    return this.page.locator("tbody tr");
  }

  /** A listing row matching the given program name (paging-independent). */
  programRowByName(name: string): Locator {
    return this.dataRows().filter({ hasText: name });
  }

  /** Open a program from the listing by name; returns its id from the URL. */
  async openProgramByName(name: string): Promise<string> {
    const row = this.programRowByName(name).first();
    await expect(row, `program "${name}" not found in the listing`).toBeVisible(
      {
        timeout: 30_000,
      },
    );
    await row.getByRole("button", { name: /edit/i }).first().click();
    await this.page.waitForURL(/\/app\/programs\/\d+/, { timeout: 30_000 });
    await expect(
      this.page.getByRole("heading", { name: /Update Program/i }),
    ).toBeVisible({
      timeout: 30_000,
    });
    return this.page.url().match(/\/app\/programs\/(\d+)/)?.[1] ?? "";
  }

  /** The description textarea, addressed by name (reliable on the update page). */
  get programDescriptionField(): Locator {
    return this.page.locator('textarea[name="programDescription"]');
  }

  /**
   * Change the description on an open Update Program page and save.
   * The editor is a multi-tab wizard ending in "Save & Continue" (as in
   * create), so Continue is pressed until that final button appears.
   */
  async updateDescription(newDescription: string) {
    await expect(this.programDescriptionField).toBeVisible({ timeout: 30_000 });
    // The program's saved values hydrate into the form a moment after mount; if
    // we type before that, the async load overwrites what we typed. Wait for
    // the field to be populated first, then replace it.
    await expect(this.programDescriptionField).not.toHaveValue("", {
      timeout: 30_000,
    });
    await this.programDescriptionField.fill(newDescription);

    // Walk the wizard's Continue steps; the last tab (Search Keywords) exposes
    // a plain "Save" button (create uses "Save & Continue" instead).
    const saveButton = this.page.getByRole("button", {
      name: /^Save( & Continue)?$/,
    });
    for (let step = 0; step < 5; step++) {
      if (await saveButton.count()) break;
      if (await this.continueBtn.isVisible().catch(() => false)) {
        await this.continueBtn.click();
        await this.page.waitForTimeout(1_500);
      }
    }
    await expect(saveButton.first()).toBeVisible({ timeout: 30_000 });
    await saveButton.first().click();

    // Wait for the save to be acknowledged before the caller navigates away,
    // otherwise the change can be lost in flight.
    await expect(this.successAlert).toContainText(/updated successfully/i, {
      timeout: 30_000,
    });
    // The toast fires a moment before the write settles server-side; a short
    // pause here prevents an immediate re-open from reading the old value.
    await this.page.waitForTimeout(4_000);
  }

  /** Open a program detail/update page directly by id. */
  async gotoProgramDetail(id: string) {
    await this.page.goto(appUrl(`${PATHS.programs}/${id}`), {
      waitUntil: "domcontentloaded",
    });
    await expect(
      this.page.getByRole("heading", { name: /Update Program/i }),
    ).toBeVisible({
      timeout: 30_000,
    });
  }

  /** Deactivate a program from its listing row, confirming the dialog. */
  async deactivateProgram(name: string) {
    const row = this.programRowByName(name).first();
    await expect(row, `program "${name}" not found to deactivate`).toBeVisible({
      timeout: 30_000,
    });
    await row
      .getByRole("button", { name: /deactivate/i })
      .first()
      .click();
    await this.page
      .getByRole("button", { name: /yes, deactivate it/i })
      .click();
  }

  /**
   * Cleanup helper: deactivate every Active program whose name contains
   * `needle`, one at a time (the listing re-renders after each). Returns how
   * many were deactivated. Bounded by `max` so a runaway can never loop forever.
   */
  async deactivateAllMatching(needle: string, max = 40): Promise<number> {
    let count = 0;
    for (let i = 0; i < max; i++) {
      await this.gotoListing();
      // Make sure we are on the Active tab (that is where deactivate lives).
      const active = this.statusTab("Active");
      if (await active.count()) await active.click().catch(() => {});
      await this.page.waitForTimeout(1_000);

      const row = this.dataRows().filter({ hasText: needle }).first();
      if (!(await row.isVisible().catch(() => false))) break;

      const btn = row.getByRole("button", { name: /deactivate/i }).first();
      if (!(await btn.isVisible().catch(() => false))) break;
      await btn.click();
      await this.page
        .getByRole("button", { name: /yes, deactivate it/i })
        .click();
      await this.page.waitForTimeout(2_500);
      count++;
    }
    return count;
  }

  /** How many Active programs currently match `needle`. */
  async countActiveMatching(needle: string): Promise<number> {
    await this.gotoListing();
    const active = this.statusTab("Active");
    if (await active.count()) await active.click().catch(() => {});
    await this.page.waitForTimeout(1_000);
    return this.dataRows().filter({ hasText: needle }).count();
  }

  /** Open a program's detail/update page and confirm it loaded. Returns the id. */
  async openFirstProgram(): Promise<string> {
    const editButton = this.dataRows()
      .first()
      .getByRole("button", { name: /edit/i });
    await editButton.first().click();
    await this.page.waitForURL(/\/app\/programs\/\d+/, { timeout: 30_000 });
    await expect(
      this.page.getByRole("heading", { name: /Update Program/i }),
    ).toBeVisible({
      timeout: 30_000,
    });
    return this.page.url().match(/\/app\/programs\/(\d+)/)?.[1] ?? "";
  }
}
