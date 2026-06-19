import { test, expect } from "@playwright/test";
import ClicksSummaryPage from "../../pages/ClickSummaryPage";
import { navigateToHome } from "../../utility/navigationUtils";

// ── Test data ─────────────────────────────────────────────────────────────────
const TEST_PROGRAM = "testautomationprogrammqufp"; // update to a stable program in your env
const TEST_CATEGORY = "Car Buying and Selling";

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Reporting - Clicks Summary", () => {
  test.use({ storageState: "playwright/.auth/authentication.json" });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1 — Default page state
  // ─────────────────────────────────────────────────────────────────────────
  test("Verify Clicks Summary page loads with summary cards, chart and table", async ({
    page,
  }) => {
    await navigateToHome(page);
    const clicksPage = new ClicksSummaryPage(page);

    await test.step("Navigate to Clicks Summary", async () => {
      await clicksPage.navigateToClicksSummary();
    });

    await test.step("Verify default page state", async () => {
      await expect(clicksPage.reportingBtn).toBeVisible();
      await expect(clicksPage.clicksSummaryLink).toBeVisible();
      await clicksPage.verifySummaryCardsVisible();
      await clicksPage.verifyChartVisible();
      await clicksPage.verifyExportBtnVisible();
      await clicksPage.verifyTableHeaderVisible("Publisher ID alt");
      await clicksPage.verifyTableHeaderVisible("Publisher Name");
      await clicksPage.verifyTableHeaderVisible("Program Name");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2 — Filter by Program
  // ─────────────────────────────────────────────────────────────────────────
  test("Verify user can filter Clicks Summary by Program", async ({ page }) => {
    await navigateToHome(page);
    const clicksPage = new ClicksSummaryPage(page);

    await test.step("Navigate to Clicks Summary", async () => {
      await clicksPage.navigateToClicksSummary();
    });

    await test.step("Apply Program filter and verify report updates", async () => {
      await clicksPage.filterByProgram(TEST_PROGRAM);
      await clicksPage.verifySummaryCardsVisible();
      await clicksPage.verifyChartVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3 — Filter by Category
  // ─────────────────────────────────────────────────────────────────────────
  test("Verify user can filter Clicks Summary by Category", async ({
    page,
  }) => {
    await navigateToHome(page);
    const clicksPage = new ClicksSummaryPage(page);

    await test.step("Navigate to Clicks Summary", async () => {
      await clicksPage.navigateToClicksSummary();
    });

    await test.step("Apply Category filter and verify report updates", async () => {
      await clicksPage.filterByCategory(TEST_CATEGORY);
      await clicksPage.verifySummaryCardsVisible();
      await clicksPage.verifyChartVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4 — Filter by Campaign
  // ─────────────────────────────────────────────────────────────────────────
  test("Verify user can filter Clicks Summary by Campaign", async ({
    page,
  }) => {
    await navigateToHome(page);
    const clicksPage = new ClicksSummaryPage(page);

    await test.step("Navigate to Clicks Summary", async () => {
      await clicksPage.navigateToClicksSummary();
    });

    await test.step("Apply Campaign filter and verify report updates", async () => {
      await clicksPage.filterByCampaign(TEST_PROGRAM);
      await clicksPage.verifySummaryCardsVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5 — Filter by Date (From date previous month)
  // ─────────────────────────────────────────────────────────────────────────
  test("Verify user can set From date to previous month on Clicks Summary", async ({
    page,
  }) => {
    await navigateToHome(page);
    const clicksPage = new ClicksSummaryPage(page);

    await test.step("Navigate to Clicks Summary", async () => {
      await clicksPage.navigateToClicksSummary();
    });

    await test.step("Set From date to previous month and verify chart updates", async () => {
      await clicksPage.setFromDateToPreviousMonth("3");
      await clicksPage.verifyChartVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 6 — Clear all filters
  // ─────────────────────────────────────────────────────────────────────────
  test("Verify user can clear all filters and report returns to full data", async ({
    page,
  }) => {
    await navigateToHome(page);
    const clicksPage = new ClicksSummaryPage(page);

    await test.step("Navigate to Clicks Summary", async () => {
      await clicksPage.navigateToClicksSummary();
    });

    await test.step("Apply a filter then clear all filters", async () => {
      await clicksPage.filterByProgram(TEST_PROGRAM);
      await clicksPage.clearAllFilters();
    });

    await test.step("Verify report returns to full data state", async () => {
      await clicksPage.verifySummaryCardsVisible();
      await clicksPage.verifyChartVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 7 — Table column sorting
  // ─────────────────────────────────────────────────────────────────────────
  test("Verify table sorting works for Publisher ID, Publisher Name and Program Name", async ({
    page,
  }) => {
    await navigateToHome(page);
    const clicksPage = new ClicksSummaryPage(page);

    await test.step("Navigate to Clicks Summary", async () => {
      await clicksPage.navigateToClicksSummary();
    });

    await test.step("Sort table columns", async () => {
      await clicksPage.sortByPublisherIdAscending();
      await clicksPage.sortByPublisherIdDescending();
      await clicksPage.sortByPublisherName();
      await clicksPage.sortByProgramName();
    });

    await test.step("Verify sorting preserved report state", async () => {
      await clicksPage.verifyTableHeaderVisible("Publisher ID alt");
      await clicksPage.verifyTableHeaderVisible("Publisher Name");
      await clicksPage.verifyTableHeaderVisible("Program Name");
      await clicksPage.verifyChartVisible();
      await clicksPage.verifyExportBtnVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 8 — Hide and add columns via column visibility panel
  // ─────────────────────────────────────────────────────────────────────────
  test("Verify user can hide and add table columns via column visibility panel", async ({
    page,
  }) => {
    await navigateToHome(page);
    const clicksPage = new ClicksSummaryPage(page);

    await test.step("Navigate to Clicks Summary", async () => {
      await clicksPage.navigateToClicksSummary();
    });

    await test.step("Change column visibility settings", async () => {
      await clicksPage.openColumnVisibilityPanel();
      await clicksPage.uncheckPublisherNameColumn();
      await clicksPage.checkProgramIdColumn();
    });

    await test.step("Verify columns are hidden and shown correctly", async () => {
      await clicksPage.verifyColumnUnchecked("Publisher Name");
      await clicksPage.verifyColumnChecked("Program ID");
    });

    await test.step("Restore default visible columns", async () => {
      await clicksPage.checkPublisherNameColumn();
      await clicksPage.closeColumnPanel();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 9 — Reset columns restores defaults
  // ─────────────────────────────────────────────────────────────────────────
  test("Verify Reset restores all default table columns", async ({ page }) => {
    await navigateToHome(page);
    const clicksPage = new ClicksSummaryPage(page);

    await test.step("Navigate to Clicks Summary", async () => {
      await clicksPage.navigateToClicksSummary();
    });

    await test.step("Hide a column then reset to defaults", async () => {
      await clicksPage.openColumnVisibilityPanel();
      await clicksPage.uncheckPublisherNameColumn();
      await clicksPage.resetColumns();
      await clicksPage.checkPublisherNameColumn();
      await clicksPage.closeColumnPanel();
    });

    await test.step("Verify default columns are restored after reset", async () => {
      await clicksPage.verifyTableHeaderVisible("Publisher ID alt");
      await clicksPage.verifyTableHeaderVisible("Publisher Name");
      await clicksPage.verifyTableHeaderVisible("Program Name");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 10 — Export report
  // ─────────────────────────────────────────────────────────────────────────
  test("Verify user can export the Clicks Summary report and a file downloads", async ({
    page,
  }) => {
    await navigateToHome(page);
    const clicksPage = new ClicksSummaryPage(page);

    await test.step("Navigate to Clicks Summary", async () => {
      await clicksPage.navigateToClicksSummary();
    });

    await test.step("Export the report", async () => {
      await clicksPage.verifyChartVisible();
      const download = await clicksPage.exportReport();
      await expect(clicksPage.reportingBtn).toBeVisible();
      await expect(clicksPage.clicksSummaryLink).toBeVisible();
      expect(download.suggestedFilename()).toBeTruthy();
      expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/i);
    });
  });
});
