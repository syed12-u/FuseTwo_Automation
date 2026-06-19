import { test, expect } from '@playwright/test';
import ReportingPage from '../../pages/ReportingPage';
import { navigateToHome } from '../../utility/navigationUtils';

test.describe('Reporting - Clicks Detailed Flow', () => {
    test.use({ storageState: 'playwright/.auth/authentication.json' });

    test('Verify user can view clicks detailed report and export data', async ({ page }) => {
        await navigateToHome(page);

        const reportingPage = new ReportingPage(page);

        // Step 1: Navigate to Clicks Detailed
        await reportingPage.navigateToClicksDetailed();

        // Step 2: Apply Date Filter
        await reportingPage.applyDateFilter();

        // Step 3: Open Click Details
        await reportingPage.openClickDetails();

        // Step 4: Open Associated Sales Tab
        await reportingPage.openAssociatedSales();

        // Step 5: Manage Columns
        await reportingPage.manageColumns();

        // Step 6: Export Data
        const download = await reportingPage.exportData();

        // ===== Assertions =====
        await expect(reportingPage.reportingBtn).toBeVisible();
        await expect(reportingPage.clicksDetailedLink).toBeVisible();

        // Optional: validate download
        expect(download.suggestedFilename()).toBeTruthy();
    });
});
