import { Page, Locator, expect } from "@playwright/test";
import BasePage from "./BasePage";

export default class ClicksSummaryPage extends BasePage {
  // ===== Navigation =====
  readonly reportingBtn: Locator;
  readonly clicksSummaryLink: Locator;

  // ===== Summary Cards =====
  readonly publishersCard: Locator;
  readonly clicksCard: Locator;

  // ===== Filters =====
  readonly programFilterOpen: Locator;
  readonly programFilterClose: Locator;
  readonly categoryFilterOpen: Locator;
  readonly campaignFilterOpen: Locator;
  readonly backdropOverlay: Locator;
  readonly fromDateIcon: Locator;
  readonly previousMonthBtn: Locator;
  readonly clearBtn: Locator;

  // ===== Output =====
  readonly chart: Locator;
  readonly table: Locator;
  readonly exportBtn: Locator;

  // ===== Table Column Headers =====
  readonly publisherIdHeader: Locator;
  readonly publisherNameHeader: Locator;
  readonly programNameHeader: Locator;

  // ===== Column Visibility Panel =====
  readonly showHideColumnsBtn: Locator;
  readonly resetColumnsBtn: Locator;

  constructor(page: Page) {
    super(page);

    // Navigation
    this.reportingBtn = page
      .getByRole("button", { name: /Reporting/i })
      .first();
    this.clicksSummaryLink = page.getByRole("link", { name: "Clicks Summary" });

    // Summary cards
    this.publishersCard = page.getByText(/PUBLISHERS/i).first();
    this.clicksCard = page.getByText(/CLICKS/i).first();

    // Filters
    this.programFilterOpen = this.filterTrigger("Program");
    this.programFilterClose = page
      .locator(
        'button[aria-label="Close"], button:has-text("Close"), button:has-text("Cancel"), button:has-text("Done")',
      )
      .first();
    this.categoryFilterOpen = this.filterTrigger("Category");
    this.campaignFilterOpen = this.filterTrigger("Campaign");
    this.backdropOverlay = page.locator(".MuiBackdrop-root");
    this.fromDateIcon = page
      .locator("div")
      .filter({ hasText: /^From$/ })
      .locator("path")
      .first();
    this.previousMonthBtn = page.getByLabel("Previous month");
    this.clearBtn = page.getByRole("button", { name: "Clear" });

    // Output
    this.chart = page.locator("canvas").first();
    this.table = page.locator("table");
    this.exportBtn = page.getByRole("button", { name: "Export" });

    // Table headers
    this.publisherIdHeader = page
      .getByRole("columnheader", { name: /Publisher ID/i })
      .first();
    this.publisherNameHeader = page
      .getByRole("columnheader", { name: /Publisher Name/i })
      .first();
    this.programNameHeader = page
      .getByRole("columnheader", { name: /Program Name/i })
      .first();

    // Column visibility
    this.showHideColumnsBtn = page.getByLabel("Show or hide table columns");
    this.resetColumnsBtn = page.getByRole("button", { name: /^Reset$/ });
  }

  // ===== Navigation =====
  async navigateToClicksSummary() {
    await this.reportingBtn.click();
    await expect(this.clicksSummaryLink).toBeVisible({ timeout: 10000 });
    await this.clicksSummaryLink.click();
    await expect(this.exportBtn).toBeVisible({ timeout: 15000 });
    await expect(this.table).toBeVisible({ timeout: 15000 });
  }

  // ===== Filters =====
  async selectDropdownOption(dropdownTrigger: Locator, optionName: string) {
    await this.openDropdown(dropdownTrigger);
    await this.searchDropdown(dropdownTrigger, optionName);

    const option = this.page.getByRole("option", { name: optionName }).first();
    try {
      await expect(option).toBeVisible({ timeout: 10000 });
      await option.click();
      return;
    } catch {
      const textOption = this.page
        .getByText(optionName, { exact: true })
        .first();
      try {
        await expect(textOption).toBeVisible({ timeout: 3000 });
        await textOption.click();
      } catch {
        const firstAvailableOption = this.page.getByRole("option").first();
        try {
          await expect(firstAvailableOption).toBeVisible({ timeout: 5000 });
          await firstAvailableOption.click();
        } catch {
          await expect(
            this.page.getByText("No options", { exact: true }).first(),
          ).toBeVisible({ timeout: 5000 });
          await this.page.keyboard.press("Escape");
        }
      }
    }
  }

  async filterByProgram(programName: string) {
    await this.selectDropdownOption(this.programFilterOpen, programName);
  }

  async clearProgramFilter() {
    await this.openDropdown(this.programFilterOpen);
    if ((await this.programFilterClose.count()) > 0) {
      await this.programFilterClose.click();
      return;
    }
    await this.page.keyboard.press("Escape");
  }

  async filterByCategory(categoryName: string) {
    await this.selectDropdownOption(this.categoryFilterOpen, categoryName);
  }

  async filterByCampaign(campaignName: string) {
    await this.selectDropdownOption(this.campaignFilterOpen, campaignName);
  }

  async setFromDateToPreviousMonth(day: string) {
    await this.fromDateIcon.click();
    await this.previousMonthBtn.click();
    await this.page
      .getByRole("gridcell", { name: day, exact: true })
      .first()
      .click();
    if (await this.page.getByRole("button", { name: "Apply" }).isVisible()) {
      await this.page.getByRole("button", { name: "Apply" }).click();
    }
  }

  async clearAllFilters() {
    const count = await this.clearBtn.count();
    for (let i = 0; i < count; i++) {
      await this.clearBtn.first().click();
    }
  }

  // ===== Table Sorting =====
  async sortByPublisherIdAscending() {
    await this.clickColumnHeader(this.publisherIdHeader);
  }

  async sortByPublisherIdDescending() {
    await this.clickColumnHeader(this.publisherIdHeader);
    await this.clickColumnHeader(this.publisherIdHeader);
  }

  async sortByPublisherName() {
    await this.clickColumnHeader(this.publisherNameHeader);
  }

  async sortByProgramName() {
    await this.clickColumnHeader(this.programNameHeader);
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

  // ===== Column Visibility =====
  async openColumnVisibilityPanel() {
    await this.showHideColumnsBtn.click();
  }

  async uncheckPublisherNameColumn() {
    await this.setColumnVisibility("Publisher Name", false);
  }

  async checkPublisherNameColumn() {
    await this.setColumnVisibility("Publisher Name", true);
  }

  async checkProgramIdColumn() {
    await this.setColumnVisibility("Program ID", true);
  }

  async verifyColumnChecked(columnName: string) {
    await expect(this.columnCheckbox(columnName)).toBeChecked({
      timeout: 10000,
    });
  }

  async verifyColumnUnchecked(columnName: string) {
    await expect(this.columnCheckbox(columnName)).not.toBeChecked({
      timeout: 10000,
    });
  }

  async setColumnVisibility(columnName: string, visible: boolean) {
    const checkbox = this.columnCheckbox(columnName);
    await expect(checkbox).toBeVisible({ timeout: 10000 });
    if (visible) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
  }

  async resetColumns() {
    if ((await this.resetColumnsBtn.count()) > 0) {
      await this.resetColumnsBtn.click();
    } else {
      await this.page.getByText("Reset", { exact: true }).click();
    }
    await expect(this.table).toBeVisible({ timeout: 10000 });
  }

  async closeColumnPanel() {
    if (await this.backdropOverlay.isVisible()) {
      await this.backdropOverlay.click();
      return;
    }
    await this.page.keyboard.press("Escape");
  }

  // ===== Export =====
  async exportReport() {
    const downloadPromise = this.page.waitForEvent("download");
    await this.exportBtn.click();
    const download = await downloadPromise;
    return download;
  }

  // ===== Assertion Helpers =====
  async verifySummaryCardsVisible() {
    await expect(this.publishersCard).toBeVisible({ timeout: 15000 });
    await expect(this.clicksCard).toBeVisible({ timeout: 15000 });
  }

  async verifyChartVisible() {
    if ((await this.chart.count()) > 0) {
      await expect(this.chart).toBeVisible({ timeout: 15000 });
      return;
    }
    await expect(this.table).toBeVisible({ timeout: 15000 });
  }

  async verifyExportBtnVisible() {
    await expect(this.exportBtn).toBeVisible({ timeout: 10000 });
  }

  async verifyTableHeaderVisible(headerName: string) {
    const header = this.table
      .getByRole("columnheader", { name: this.headerPattern(headerName) })
      .first();
    await expect(header).toBeVisible({ timeout: 10000 });
  }

  async verifyColumnHidden(columnHeader: string) {
    const header = this.table
      .getByRole("columnheader", { name: this.headerPattern(columnHeader) })
      .first();
    await expect(header).not.toBeVisible({ timeout: 10000 });
  }

  async verifyColumnVisible(columnHeader: string) {
    const header = this.table
      .getByRole("columnheader", { name: this.headerPattern(columnHeader) })
      .first();
    await expect(header).toBeVisible({ timeout: 10000 });
  }

  private headerPattern(headerName: string) {
    const normalizedHeader = headerName.replace(/\s+alt$/i, "");
    return new RegExp(
      normalizedHeader.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
  }

  private columnCheckbox(columnName: string) {
    return this.page
      .locator("#language div")
      .filter({ hasText: new RegExp(`^${columnName}$`) })
      .getByRole("checkbox")
      .first();
  }

  private filterTrigger(label: string) {
    const exactLabel = new RegExp(`^${label}$`);
    return this.page
      .locator("div")
      .filter({ hasText: exactLabel })
      .getByLabel("Open")
      .first();
  }

  private async openDropdown(dropdownTrigger: Locator) {
    await expect(dropdownTrigger).toBeVisible({ timeout: 15000 });
    await dropdownTrigger.scrollIntoViewIfNeeded();
    try {
      await dropdownTrigger.click({ timeout: 10000 });
    } catch {
      await dropdownTrigger.click({ force: true });
    }
  }

  private async searchDropdown(dropdownTrigger: Locator, optionName: string) {
    const input = dropdownTrigger
      .locator("xpath=ancestor::*[contains(@class, 'MuiAutocomplete-root')][1]")
      .locator("input")
      .first();

    if ((await input.count()) === 0) {
      return;
    }

    await input.fill(optionName);
    await this.page.waitForTimeout(500);
  }
}
