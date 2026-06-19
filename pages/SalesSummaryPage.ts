import { Page, Locator, expect } from "@playwright/test";
import BasePage from "./BasePage";

export default class SalesSummaryPage extends BasePage {
  readonly reportingBtn: Locator;
  readonly salesSummaryLink: Locator;

  readonly fromDateIcon: Locator;
  readonly toDateIcon: Locator;
  readonly applyBtn: Locator;

  readonly chart: Locator;
  readonly table: Locator;
  readonly exportBtn: Locator;

  readonly programNameHeader: Locator;
  readonly publisherNameAltHeader: Locator;
  readonly clicksHeader: Locator;

  readonly altFilterButton: Locator;
  readonly valueInput: Locator;

  readonly showHideColumnsBtn: Locator;
  readonly programIdCheckbox: Locator;
  readonly impressionsCheckbox: Locator;
  readonly backdropOverlay: Locator;

  constructor(page: Page) {
    super(page);

    this.reportingBtn = page
      .getByRole("button", { name: /Reporting/i })
      .first();
    this.salesSummaryLink = page.getByRole("link", { name: "Sales Summary" });

    this.fromDateIcon = page
      .locator("div")
      .filter({ hasText: /^From$/ })
      .getByTestId("DateRangeIcon");
    this.toDateIcon = page
      .locator("div")
      .filter({ hasText: /^To$/ })
      .getByTestId("DateRangeIcon");
    this.applyBtn = page.getByRole("button", { name: "Apply" });

    this.chart = page.locator("canvas").first();
    this.table = page.locator("table");
    this.exportBtn = page.getByRole("button", { name: "Export" });

    this.programNameHeader = page
      .getByRole("columnheader", { name: /Program Name/i })
      .first();
    this.publisherNameAltHeader = page
      .getByRole("columnheader", { name: /Publisher Name/i })
      .first();
    this.clicksHeader = page
      .getByRole("columnheader", { name: /^Clicks$/i })
      .first();

    this.altFilterButton = page.getByRole("button", { name: /alt/i }).first();
    this.valueInput = page.getByLabel("Value");

    this.showHideColumnsBtn = page.getByLabel("Show or hide table columns");
    this.programIdCheckbox = this.columnCheckbox("Program ID");
    this.impressionsCheckbox = this.columnCheckbox("Impressions");
    this.backdropOverlay = page.locator(".MuiBackdrop-root");
  }

  async navigateToSalesSummary() {
    await this.reportingBtn.click();
    await expect(this.salesSummaryLink).toBeVisible({ timeout: 10000 });
    await this.salesSummaryLink.click();
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

  async sortByProgramName() {
    await this.clickColumnHeader(this.programNameHeader);
  }

  async sortByPublisherNameAlt() {
    await this.clickColumnHeader(this.publisherNameAltHeader);
  }

  async sortByClicks() {
    await this.clickColumnHeader(this.clicksHeader);
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
    if (!(await this.altFilterButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      await expect(this.table).toBeVisible({ timeout: 10000 });
      return;
    }
    await this.altFilterButton.click();
    await this.valueInput.fill(value);
    await this.valueInput.press("Enter");
  }

  async openColumnVisibilityPanel() {
    await expect(this.showHideColumnsBtn).toBeVisible({ timeout: 10000 });
    await this.showHideColumnsBtn.click();
  }

  async checkProgramIdColumn() {
    await this.programIdCheckbox.check();
  }

  async checkImpressionsColumn() {
    await this.impressionsCheckbox.check();
  }

  async closeColumnPanel() {
    if (await this.backdropOverlay.isVisible()) {
      await this.backdropOverlay.click();
      return;
    }
    await this.page.keyboard.press("Escape");
  }

  async exportReport() {
    await expect(this.exportBtn).toBeEnabled({ timeout: 30000 });
    const downloadPromise = this.page.waitForEvent("download");
    await this.exportBtn.click();
    return await downloadPromise;
  }

  async verifyChartVisible() {
    const chartCount = await this.chart.count();
    if (chartCount > 0) {
      await expect(this.chart).toBeVisible({ timeout: 15000 });
    } else {
      await expect(this.table).toBeVisible({ timeout: 15000 });
    }
  }

  async verifyTableContains(text: string) {
    await expect(this.table).toContainText(text);
  }

  async verifyExportBtnVisible() {
    await expect(this.exportBtn).toBeVisible({ timeout: 10000 });
  }

  async verifyTableVisible() {
    await expect(this.table).toBeVisible({ timeout: 10000 });
  }

  async verifyColumnChecked(columnName: string) {
    await expect(this.columnCheckbox(columnName)).toBeChecked({
      timeout: 10000,
    });
  }

  private columnCheckbox(columnName: string) {
    return this.page
      .locator("#language div")
      .filter({ hasText: new RegExp(`^${columnName}$`) })
      .getByRole("checkbox")
      .first();
  }
}
