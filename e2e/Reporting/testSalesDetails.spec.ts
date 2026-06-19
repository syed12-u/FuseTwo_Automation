import { test, expect } from "@playwright/test";
import SalesDetailsPage from "../../pages/SalesDetails";
import { navigateToHome } from "../../utility/navigationUtils";

const ALT_FILTER_VALUE = "test";

test.describe("Reporting - Sales Detailed", () => {
  test.use({ storageState: "playwright/.auth/authentication.json" });

  async function openSalesDetails(page) {
    await navigateToHome(page);
    const salesDetailsPage = new SalesDetailsPage(page);
    await salesDetailsPage.navigateToSalesDetails();
    return salesDetailsPage;
  }

  test("Verify Sales Detailed page loads with table and export button", async ({
    page,
  }) => {
    const salesDetailsPage = await openSalesDetails(page);

    await salesDetailsPage.verifyTableVisible();
    await expect(salesDetailsPage.exportBtn).toBeVisible();
  });

  test("Verify user can select a date range on Sales Detailed", async ({
    page,
  }) => {
    const salesDetailsPage = await openSalesDetails(page);

    await salesDetailsPage.selectDateRange("1", "19");
    await salesDetailsPage.verifyTableVisible();
  });

  test("Verify user can sort Sales Detailed columns", async ({ page }) => {
    const salesDetailsPage = await openSalesDetails(page);

    await salesDetailsPage.sortByProgramName();
    await salesDetailsPage.sortBySaleId();
    await salesDetailsPage.sortByOrderNumber();
    await salesDetailsPage.verifyTableVisible();
  });

  test("Verify user can apply alternate value filter on Sales Detailed", async ({
    page,
  }) => {
    const salesDetailsPage = await openSalesDetails(page);

    await salesDetailsPage.applyAltValueFilter(ALT_FILTER_VALUE);
    await salesDetailsPage.verifyTableVisible();
  });

  test("Verify user can show Date Entered column from column visibility panel", async ({
    page,
  }) => {
    const salesDetailsPage = await openSalesDetails(page);

    await salesDetailsPage.openColumnVisibilityPanel();
    await salesDetailsPage.checkDateEnteredColumn();
    await salesDetailsPage.closeColumnPanel();
    await salesDetailsPage.verifyDateEnteredVisible();
  });

  test("Verify user can export Sales Detailed report", async ({ page }) => {
    const salesDetailsPage = await openSalesDetails(page);

    await salesDetailsPage.selectDateRange("1", "19");
    const download = await salesDetailsPage.exportReport();
    expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/i);
  });
});
