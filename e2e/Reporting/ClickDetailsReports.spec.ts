import { test, expect } from '@playwright/test';
import ClicksDetailsPage from '../../pages/ClickDetailsPage';
import { navigateToHome } from '../../utility/navigationUtils';

// ── Test data ─────────────────────────────────────────────────────────────────
const ALT_FILTER_VALUE = 'test';

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Reporting - Clicks Detailed', () => {
    test.use({ storageState: 'playwright/.auth/authentication.json' });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1 — Page loads with table and export button
    // ─────────────────────────────────────────────────────────────────────────
    test('Verify Clicks Detailed page loads with table and export button visible', async ({ page }) => {
        await navigateToHome(page);
        const clicksDetailsPage = new ClicksDetailsPage(page);

        // Step 1: Navigate to Clicks Detailed
        await clicksDetailsPage.navigateToClicksDetailed();

        // ===== Assertions =====
        await clicksDetailsPage.verifyTableVisible();
        await clicksDetailsPage.verifyExportBtnVisible();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2 — Date range filter updates the report
    // ─────────────────────────────────────────────────────────────────────────
    test('Verify user can select a custom date range on Clicks Detailed', async ({ page }) => {
        await navigateToHome(page);
        const clicksDetailsPage = new ClicksDetailsPage(page);

        // Step 1: Navigate to Clicks Detailed
        await clicksDetailsPage.navigateToClicksDetailed();

        // Step 2: Select date range
        await clicksDetailsPage.selectDateRange('1', '21');

        // ===== Assertions =====
        await clicksDetailsPage.verifyTableVisible();
        await clicksDetailsPage.verifyExportBtnVisible();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3 — Column sorting works
    // ─────────────────────────────────────────────────────────────────────────
    test('Verify user can sort Clicks Detailed report by Program Name, Click ID and Publisher ID', async ({ page }) => {
        await navigateToHome(page);
        const clicksDetailsPage = new ClicksDetailsPage(page);

        // Step 1: Navigate to Clicks Detailed
        await clicksDetailsPage.navigateToClicksDetailed();

        // Step 2: Sort by Program Name
        await clicksDetailsPage.sortByProgramName();

        // Step 3: Sort by Click ID
        await clicksDetailsPage.sortByClickId();

        // Step 4: Sort by Publisher ID
        await clicksDetailsPage.sortByPublisherId();

        // ===== Assertions =====
        await clicksDetailsPage.verifyTableVisible();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4 — Alt value filter can be applied
    // ─────────────────────────────────────────────────────────────────────────
    test('Verify user can apply alt value filter on Clicks Detailed', async ({ page }) => {
        await navigateToHome(page);
        const clicksDetailsPage = new ClicksDetailsPage(page);

        // Step 1: Navigate to Clicks Detailed
        await clicksDetailsPage.navigateToClicksDetailed();

        // Step 2: Apply alt value filter
        await clicksDetailsPage.applyAltValueFilter(ALT_FILTER_VALUE);

        // ===== Assertions =====
        await clicksDetailsPage.verifyTableVisible();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5 — Column visibility panel works
    // ─────────────────────────────────────────────────────────────────────────
    test('Verify user can add and remove columns via column visibility panel', async ({ page }) => {
        await navigateToHome(page);
        const clicksDetailsPage = new ClicksDetailsPage(page);

        // Step 1: Navigate to Clicks Detailed
        await clicksDetailsPage.navigateToClicksDetailed();

        // Step 2: Open column visibility panel
        await clicksDetailsPage.openColumnVisibilityPanel();

        // Step 3: Add Program ID column
        await clicksDetailsPage.checkProgramIdColumn();

        // Step 4: Close column panel
        await clicksDetailsPage.closeColumnPanel();

        // ===== Assertions =====
        await clicksDetailsPage.verifyTableVisible();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6 — Export downloads a file
    // ─────────────────────────────────────────────────────────────────────────
    test('Verify user can export Clicks Detailed report and file downloads', async ({ page }) => {
        await navigateToHome(page);
        const clicksDetailsPage = new ClicksDetailsPage(page);

        // Step 1: Navigate to Clicks Detailed
        await clicksDetailsPage.navigateToClicksDetailed();

        // Step 2: Select date range before export
        await clicksDetailsPage.selectDateRange('1', '21');

        // Step 3: Export report
        const download = await clicksDetailsPage.exportReport();

        // ===== Assertions =====
        await clicksDetailsPage.verifyExportBtnVisible();
        expect(download.suggestedFilename()).toBeTruthy();
        expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/i);
    });
});
