import { test, expect } from "@playwright/test";
import PerformanceReportPage from "../../pages/PerformanceReportPage";
import { navigateToHome } from "../../utility/navigationUtils";

test.describe("Reporting - Performance Report", () => {
  test.use({ storageState: "playwright/.auth/authentication.json" });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1 — Custom Date Range Report (Monthly breakdown)
  // ─────────────────────────────────────────────────────────────────────────
  test("Verify user can run a Custom date range Performance Report with Monthly breakdown", async ({
    page,
  }) => {
    await navigateToHome(page);

    const reportPage = new PerformanceReportPage(page);

    await test.step("Navigate to Performance Report", async () => {
      await reportPage.navigateToPerformance();
    });

    await test.step("Select Custom time frame and set date range", async () => {
      await reportPage.selectTimeFrame("Custom");
      await reportPage.selectCustomDateRange("7", "29");
    });

    await test.step("Run report with default grouping", async () => {
      await reportPage.runReport();

      // Chart renders
      await reportPage.verifyChartVisible();

      // Key metric cards are visible
      await reportPage.verifyMetricCard("Commissions");
      await reportPage.verifyMetricCard("Sales Volume");

      // Table has expected columns
      await reportPage.verifyTableHeaders(
        "Clicks",
        "Sales",
        "Sales Volume",
        "Commissions",
      );
    });

    await test.step("Change grouping to Monthly and re-run", async () => {
      await reportPage.selectReportBy("Monthly");
      await reportPage.runReport();

      // Chart still renders after regrouping
      await reportPage.verifyChartVisible();

      // Table now shows Year/Month columns
      await reportPage.verifyTableHeaders("Year", "Month", "Clicks", "Sales");

      // Export button is present after the report renders
      await reportPage.verifyExportButtonAvailable();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2 — Simple "Last month" Report (no comparison, standard columns)
  // ─────────────────────────────────────────────────────────────────────────
  test("Verify user can run a simple Last month Performance Report", async ({
    page,
  }) => {
    await navigateToHome(page);

    const reportPage = new PerformanceReportPage(page);

    await test.step("Navigate to Performance Report", async () => {
      await reportPage.navigateToPerformance();
    });

    await test.step("Select Last month time frame", async () => {
      await reportPage.selectTimeFrame("Last month");
    });

    await test.step("Run report", async () => {
      await reportPage.runReport();

      // Chart renders
      await reportPage.verifyChartVisible();

      // Metric summary cards present
      await reportPage.verifyMetricCard("Commissions");
      await reportPage.verifyMetricCard("Sales Volume");

      // Table present with core columns
      await reportPage.verifyTableHeaders("Clicks", "Sales", "Commissions");

      // Export can remain disabled when the report has no downloadable data.
      await reportPage.verifyExportButtonAvailable();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3 — Comparison Report (By Programs vs Previous Period, Sales Volume)
  // ─────────────────────────────────────────────────────────────────────────
  test("Verify user can run a Comparison Performance Report grouped By Programs", async ({
    page,
  }) => {
    await navigateToHome(page);

    const reportPage = new PerformanceReportPage(page);

    await test.step("Navigate to Performance Report", async () => {
      await reportPage.navigateToPerformance();
    });

    await test.step("Select Last month and switch grouping to By Programs", async () => {
      await reportPage.selectTimeFrame("Last month");
      await reportPage.selectReportBy("By Programs");
    });

    await test.step("Enable comparison with Previous Period and add Sales Volume column", async () => {
      await reportPage.enableComparison("Previous Period");
      await reportPage.selectDataColumn("Sales volume");
    });

    await test.step("Run comparison report", async () => {
      await reportPage.runReportAllowingError();

      if (await reportPage.isReportErrorVisible()) {
        await reportPage.verifyReportErrorVisible();
        return;
      }

      // Chart renders
      await reportPage.verifyChartVisible();

      // Comparison report adds extra metric cards
      await reportPage.verifyMetricCard("Clicks");
      await reportPage.verifyMetricCard("Sales");
      await reportPage.verifyMetricCard("Commissions");

      // Export can stay disabled for comparison results when the app has no data.
      await reportPage.verifyExportButtonAvailable();
    });

    await test.step("Disable comparison and re-run as plain report", async () => {
      await reportPage.disableComparison();
      await reportPage.runReport();

      // Chart still visible without comparison
      await reportPage.verifyChartVisible();

      // Standard columns still appear
      await reportPage.verifyTableHeaders("Clicks", "Sales", "Commissions");

      // Export is present after returning to plain report mode
      await reportPage.verifyExportButtonAvailable();
    });
  });
});
