import { test, expect } from "@playwright/test";
import SalesSummaryPage from "../../pages/SalesSummaryPage";
import { navigateToHome } from "../../utility/navigationUtils";

const ALTERNATE_FILTER_VALUE = "test";

test.describe("Reporting - Sales Summary", () => {
  test.use({ storageState: "playwright/.auth/authentication.json" });

  async function openSalesSummary(page) {
    await navigateToHome(page);
    const salesSummaryPage = new SalesSummaryPage(page);
    await salesSummaryPage.navigateToSalesSummary();
    return salesSummaryPage;
  }

  test("Verify Sales Summary page loads with chart, table and export button", async ({
    page,
  }) => {
    const salesSummaryPage = await openSalesSummary(page);

    await salesSummaryPage.verifyChartVisible();
    await salesSummaryPage.verifyTableVisible();
    await salesSummaryPage.verifyExportBtnVisible();
  });

  test("Verify user can select a date range on Sales Summary", async ({
    page,
  }) => {
    const salesSummaryPage = await openSalesSummary(page);

    await salesSummaryPage.selectDateRange("23", "12");
    await salesSummaryPage.verifyChartVisible();
    await salesSummaryPage.verifyTableVisible();
  });

  test("Verify user can sort Sales Summary report columns", async ({
    page,
  }) => {
    const salesSummaryPage = await openSalesSummary(page);

    await salesSummaryPage.sortByProgramName();
    await salesSummaryPage.sortByPublisherNameAlt();
    await salesSummaryPage.sortByClicks();
    await salesSummaryPage.verifyTableVisible();
  });

  test("Verify user can apply alternate value filter on Sales Summary", async ({
    page,
  }) => {
    const salesSummaryPage = await openSalesSummary(page);

    await salesSummaryPage.applyAltValueFilter(ALTERNATE_FILTER_VALUE);
    await salesSummaryPage.verifyTableVisible();
  });

  test("Verify user can show additional Sales Summary columns", async ({
    page,
  }) => {
    const salesSummaryPage = await openSalesSummary(page);

    await salesSummaryPage.openColumnVisibilityPanel();
    await salesSummaryPage.checkProgramIdColumn();
    await salesSummaryPage.checkImpressionsColumn();
    await salesSummaryPage.verifyColumnChecked("Program ID");
    await salesSummaryPage.verifyColumnChecked("Impressions");
    await salesSummaryPage.closeColumnPanel();
  });

  test("Verify user can export Sales Summary report", async ({ page }) => {
    const salesSummaryPage = await openSalesSummary(page);

    await salesSummaryPage.selectDateRange("23", "12");
    const download = await salesSummaryPage.exportReport();
    expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/i);
  });
});
