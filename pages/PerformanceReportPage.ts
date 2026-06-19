import { Page, Locator, expect } from "@playwright/test";
import BasePage from "./BasePage";

export default class PerformanceReportPage extends BasePage {
  // ===== Navigation Locators =====
  readonly reportingMenuBtn: Locator;
  readonly performanceLink: Locator;

  // ===== Time Frame / Filters =====
  readonly timeFrameDropdown: Locator;
  readonly performanceReportDropdown: Locator;
  readonly reportByDropdown: Locator;
  readonly startDateIcon: Locator;
  readonly endDateIcon: Locator;
  readonly runReportBtn: Locator;

  // ===== Report Config =====
  readonly compareToggle: Locator;
  readonly comparePeriodDropdown: Locator;
  readonly dataColumnsDropdown: Locator;

  // ===== Output =====
  readonly exportBtn: Locator;
  readonly chart: Locator;
  readonly table: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    super(page);

    // Navigation
    this.reportingMenuBtn = page
      .getByRole("button", { name: /Reporting/i })
      .first();
    this.performanceLink = page.getByRole("link", { name: "Performance" });

    // Filters
    this.timeFrameDropdown = page.locator("#mui-component-select-timeFrame");
    this.performanceReportDropdown = page.locator(
      "#mui-component-select-templateReports",
    );
    this.reportByDropdown = page.locator(
      "#mui-component-select-performanceReportBy",
    );
    this.startDateIcon = page
      .locator("div")
      .filter({ hasText: /^Start Date \*$/ })
      .getByTestId("DateRangeIcon");
    this.endDateIcon = page
      .locator("div")
      .filter({ hasText: /^End Date \*$/ })
      .getByTestId("DateRangeIcon");
    this.runReportBtn = page.getByRole("button", { name: "RUN REPORT" });

    // Comparison config
    this.compareToggle = page.getByLabel("Compare to another period");
    this.comparePeriodDropdown = page.locator(
      "#mui-component-select-comparePeriod",
    );
    this.dataColumnsDropdown = page.locator(
      "#mui-component-select-dataColumns",
    );

    // Output
    this.exportBtn = page.getByRole("button", { name: "Export" });
    this.chart = page.locator("canvas").first();
    this.table = page.locator("table");
    this.errorAlert = page.getByText("Oops! Something went wrong.").first();
  }

  // ===== Navigation =====
  async navigateToPerformance() {
    await this.reportingMenuBtn.click();
    await this.performanceLink.click();
  }

  // ===== Time Frame Helpers =====
  async selectTimeFrame(option: string) {
    await this.timeFrameDropdown.click();
    await this.page.getByRole("option", { name: option, exact: true }).click();
  }

  async selectCustomDateRange(startDay: string, endDay: string) {
    await this.startDateIcon.click();
    await this.clickEnabledCalendarDay(startDay);
    await this.endDateIcon.click();
    await this.clickEnabledCalendarDay(endDay);
  }

  async selectReportBy(option: string) {
    await this.reportByDropdown.click();
    await this.page.getByRole("option", { name: option, exact: true }).click();
  }

  async runReport() {
    await expect(this.runReportBtn).toBeEnabled({ timeout: 30000 });
    await this.runReportBtn.click();
    await this.waitForReportToFinish();
  }

  async runReportAllowingError() {
    await expect(this.runReportBtn).toBeEnabled({ timeout: 30000 });
    await this.runReportBtn.click();
    await this.waitForReportOutputOrError();
  }

  // ===== Comparison Helpers =====
  async enableComparison(comparePeriod: string) {
    await this.compareToggle.check();
    await this.comparePeriodDropdown.click();
    await this.page
      .getByRole("option", { name: comparePeriod, exact: true })
      .click();
  }

  async disableComparison() {
    await this.compareToggle.uncheck();
  }

  async selectDataColumn(column: string) {
    await this.dataColumnsDropdown.click();
    await this.page.getByRole("option", { name: column, exact: true }).click();
  }

  async selectReportTemplate(templateOption: string) {
    await this.openPerformanceReportDropdown();
    await this.page
      .getByRole("option", { name: templateOption, exact: true })
      .click();
  }

  async selectReportGroupBy(option: string) {
    // The "Monthly / By Programs" secondary dropdown
    await this.reportByDropdown.click();
    await this.page.getByRole("option", { name: option, exact: true }).click();
  }

  // ===== Export =====
  async exportReport() {
    await this.waitForExportReady();
    const downloadPromise = this.page.waitForEvent("download", {
      timeout: 30000,
    });
    await this.exportBtn.click();
    const download = await downloadPromise;
    return download;
  }

  // ===== Assertion Helpers =====
  async verifyChartVisible() {
    if ((await this.chart.count()) > 0) {
      await expect(this.chart).toBeVisible({ timeout: 30000 });
      return;
    }
    await expect(this.table).toBeVisible({ timeout: 30000 });
  }

  async verifyTableContains(text: string) {
    await expect(this.table).toContainText(text);
  }

  async verifyExportBtnVisible() {
    await this.waitForExportReady();
  }

  async verifyExportButtonAvailable() {
    await expect(this.exportBtn).toBeVisible({ timeout: 30000 });
  }

  async isExportEnabled() {
    await expect(this.exportBtn).toBeVisible({ timeout: 30000 });
    return await this.exportBtn.isEnabled();
  }

  async verifyMetricCard(label: string) {
    await expect(this.page.getByText(label).first()).toBeVisible();
  }

  async verifyTableHeaders(...headers: string[]) {
    for (const header of headers) {
      await expect(this.page.getByText(header).first()).toBeVisible();
    }
  }

  async waitForReportToFinish() {
    await this.waitForReportOutputOrError();
    await this.verifyNoReportError();
  }

  async waitForReportOutputOrError() {
    const loader = this.page
      .getByRole("progressbar")
      .or(this.page.locator(".MuiCircularProgress-root"))
      .first();

    if ((await loader.count()) > 0) {
      await expect(loader).toBeHidden({ timeout: 60000 });
    }

    await expect(this.runReportBtn).toBeEnabled({ timeout: 60000 });
    await expect(
      this.table.or(this.chart).or(this.errorAlert).first(),
    ).toBeVisible({
      timeout: 60000,
    });
  }

  async waitForExportReady() {
    await expect(this.exportBtn).toBeVisible({ timeout: 30000 });
    await this.verifyNoReportError();
    await expect(this.exportBtn).toBeEnabled({ timeout: 60000 });
  }

  async verifyNoReportError() {
    await expect(this.errorAlert).not.toBeVisible({ timeout: 5000 });
  }

  async isReportErrorVisible() {
    return await this.errorAlert.isVisible();
  }

  async verifyReportErrorVisible() {
    await expect(this.errorAlert).toBeVisible({ timeout: 10000 });
  }

  async selectFirstPerformanceReport() {
    if ((await this.performanceReportDropdown.count()) === 0) {
      return;
    }

    await this.openPerformanceReportDropdown();

    const menu = this.page.locator("#menu-templateReports");
    const option = menu
      .locator('[role="option"], li, .MuiMenuItem-root, div')
      .filter({ hasText: /\S/ })
      .first();

    if ((await option.count()) > 0) {
      await expect(option).toBeVisible({ timeout: 10000 });
      await option.click();
      return;
    }

    await this.page.keyboard.press("ArrowDown");
    await this.page.keyboard.press("Enter");
  }

  async openPerformanceReportDropdown() {
    await expect(this.performanceReportDropdown).toBeVisible({
      timeout: 10000,
    });
    await this.performanceReportDropdown.click();
    await expect(this.page.locator("#menu-templateReports")).toBeVisible({
      timeout: 10000,
    });
  }

  async clickEnabledCalendarDay(day: string) {
    const dayButton = this.page
      .locator('button[role="gridcell"]:not([disabled])')
      .filter({ hasText: new RegExp(`^${day}$`) })
      .first();

    await expect(dayButton).toBeVisible({ timeout: 10000 });
    await dayButton.click();
  }
}
