import { Page, Locator, expect } from "@playwright/test";
import BasePage from "./BasePage";

export default class SalesDetailsPage extends BasePage {
  readonly reportingBtn: Locator;
  readonly salesDetailsLink: Locator;

  readonly fromDateIcon: Locator;
  readonly toDateIcon: Locator;
  readonly applyBtn: Locator;

  readonly salesDetailsPanel: Locator;
  readonly programNameHeader: Locator;
  readonly saleIdHeader: Locator;
  readonly orderNumberHeader: Locator;

  readonly altFilterButton: Locator;
  readonly valueInput: Locator;

  readonly showHideColumnsBtn: Locator;
  readonly programNameCheckbox: Locator;
  readonly dateEnteredCheckbox: Locator;
  readonly backdropOverlay: Locator;

  readonly exportBtn: Locator;
  readonly table: Locator;

  constructor(page: Page) {
    super(page);

    this.reportingBtn = page
      .getByRole("button", { name: /Reporting/i })
      .first();
    this.salesDetailsLink = page.getByRole("link", { name: "Sales Detailed" });

    this.fromDateIcon = page
      .locator("div")
      .filter({ hasText: /^From$/ })
      .getByTestId("DateRangeIcon");
    this.toDateIcon = page
      .locator("div")
      .filter({ hasText: /^To$/ })
      .getByTestId("DateRangeIcon");
    this.applyBtn = page.getByRole("button", { name: "Apply" });

    this.salesDetailsPanel = page.locator("div:nth-child(2) > .col-sm-12");
    this.programNameHeader = page.getByRole("columnheader", {
      name: "Program Name",
    });
    this.saleIdHeader = page.getByRole("columnheader", { name: "Sale ID" });
    this.orderNumberHeader = page.getByRole("columnheader", {
      name: "Order Number",
    });

    this.altFilterButton = page.getByRole("button", { name: /alt/i }).first();
    this.valueInput = page.getByLabel("Value");

    this.showHideColumnsBtn = page.getByLabel("Show or hide table columns");
    this.programNameCheckbox = page
      .locator("#language div")
      .filter({ hasText: /^Program Name$/ })
      .getByRole("checkbox")
      .first();
    this.dateEnteredCheckbox = page
      .locator("#language div")
      .filter({ hasText: /^Date Entered$/ })
      .getByRole("checkbox")
      .first();
    this.backdropOverlay = page.locator(".MuiBackdrop-root");

    this.exportBtn = page.getByRole("button", { name: "Export" });
    this.table = page.locator("table");
  }

  async navigateToSalesDetails() {
    await this.reportingBtn.click();
    await expect(this.salesDetailsLink).toBeVisible({ timeout: 10000 });
    await this.salesDetailsLink.click();
    await expect(this.exportBtn).toBeVisible({ timeout: 15000 });
    await expect(this.table).toBeVisible({ timeout: 15000 });
  }

  async selectDateRange(startDay: string, endDay: string) {
    await this.fromDateIcon.click();
    await this.clickCalendarDay(startDay);
    await this.toDateIcon.click();
    await this.clickCalendarDay(endDay);
    await this.applyBtn.click();
  }

  async clickCalendarDay(day: string) {
    const dayCell = this.page
      .locator('button[role="gridcell"]:not([disabled])')
      .filter({ hasText: new RegExp(`^${day}$`) })
      .first();
    await expect(dayCell).toBeVisible({ timeout: 10000 });
    await dayCell.click();
  }

  async clickSalesDetailsPanel() {
    await this.salesDetailsPanel.click();
  }

  async sortByProgramName() {
    await this.clickColumnHeader(this.programNameHeader);
  }

  async sortBySaleId() {
    await this.clickColumnHeader(this.saleIdHeader);
  }

  async sortByOrderNumber() {
    await this.clickColumnHeader(this.orderNumberHeader);
  }

  async clickColumnHeader(header: Locator) {
    await expect(header).toBeVisible({ timeout: 10000 });
    const button = header.getByRole("button").first();
    if ((await button.count()) > 0) {
      await button.click();
      return;
    }
    await header.click();
  }

  async applyAltValueFilter(value: string) {
    await this.altFilterButton.click();
    await this.valueInput.fill(value);
    await this.valueInput.press("Enter");
  }

  async openColumnVisibilityPanel() {
    await expect(this.showHideColumnsBtn).toBeVisible({ timeout: 10000 });
    await this.showHideColumnsBtn.click();
  }

  async toggleProgramNameColumn() {
    await this.programNameCheckbox.click();
  }

  async checkDateEnteredColumn() {
    await expect(this.dateEnteredCheckbox).toBeVisible({ timeout: 10000 });
    await this.dateEnteredCheckbox.check();
  }

  async closeColumnPanel() {
    if (await this.backdropOverlay.isVisible()) {
      await this.backdropOverlay.click();
      return;
    }
    await this.page.keyboard.press("Escape");
  }

  async verifyDateEnteredVisible() {
    await expect(this.page.getByText("Date Entered").first()).toBeVisible({
      timeout: 10000,
    });
  }

  async exportReport() {
    await expect(this.exportBtn).toBeEnabled({ timeout: 30000 });
    const downloadPromise = this.page.waitForEvent("download");
    await this.exportBtn.click();
    return await downloadPromise;
  }

  async verifyTableVisible() {
    await expect(this.table).toBeVisible({ timeout: 10000 });
  }
}
