import { Page, Locator, expect } from '@playwright/test';
import BasePage from './BasePage';

export default class ReportingPage extends BasePage {

    // ===== Locators =====
    readonly reportingBtn: Locator;
    readonly clicksDetailedLink: Locator;

    readonly fromDateIcon: Locator;
    readonly previousMonthBtn: Locator;
    readonly fromDate: Locator;

    readonly toDateIcon: Locator;
    readonly toDate: Locator;

    readonly applyBtn: Locator;

    readonly clickIdHeader: Locator;
    readonly clickIdCell: Locator;

    readonly associatedSalesTab: Locator;

    readonly columnBtn: Locator;
    readonly showHideColumns: Locator;
    readonly programIdCheckbox: Locator;
    readonly campaignNameCheckbox: Locator;
    readonly backdrop: Locator;

    readonly exportBtn: Locator;

    constructor(page: Page) {
        super(page);

        // Navigation
        this.reportingBtn = page.getByRole('button', { name: 'Reporting' });
        this.clicksDetailedLink = page.getByRole('link', { name: 'Clicks Detailed' });

        // Date filters
        this.fromDateIcon = page.locator('div').filter({ hasText: /^From$/ }).locator('path');
        this.previousMonthBtn = page.getByLabel('Previous month');
       this.fromDate = page.getByRole('gridcell', { name: '4' }).first();

        this.toDateIcon = page.locator('div').filter({ hasText: /^To$/ }).getByTestId('DateRangeIcon');
this.toDate = page.getByRole('gridcell', { name: '3' }).first();
        this.applyBtn = page.getByRole('button', { name: 'Apply' });

        // Table
        this.clickIdHeader = page.getByText('Click ID', { exact: true });
        this.clickIdCell = page.getByRole('cell', { name: '3145275403' });

        // Tabs
        this.associatedSalesTab = page.getByRole('tab', { name: 'Associated Sales' });

        // Column settings
        this.columnBtn = page.getByRole('button').first(); // improve later if possible
        this.showHideColumns = page.getByLabel('Show or hide table columns');
        this.programIdCheckbox = page.locator('div').filter({ hasText: /^Program ID$/ }).getByRole('checkbox');
        this.campaignNameCheckbox = page.locator('#language div')
            .filter({ hasText: /^Campaign Name$/ })
            .getByRole('checkbox');

        this.backdrop = page.locator('.MuiBackdrop-root');

        // Export
        this.exportBtn = page.getByRole('button', { name: 'Export' });
    }

    // ===== Actions =====
    async navigateToClicksDetailed() {
        await this.reportingBtn.click();
        await expect(this.reportingBtn).toBeVisible();

        await this.clicksDetailedLink.click();
        await expect(this.clicksDetailedLink).toBeVisible();
    }

    async applyDateFilter() {
        await this.fromDateIcon.click();
        await this.previousMonthBtn.click();
        await this.fromDate.click();

        await this.toDateIcon.click();
        await this.toDate.click();

        await this.applyBtn.click();
    }

    async openClickDetails() {
        await this.clickIdHeader.click();
        await this.clickIdCell.click();
    }

    async openAssociatedSales() {
        await this.associatedSalesTab.click();
    }

    async manageColumns() {
        await this.columnBtn.click();
        await this.showHideColumns.click();

        await this.programIdCheckbox.check();
        await this.campaignNameCheckbox.uncheck();

        await this.backdrop.click();
    }

    async exportData() {
        const downloadPromise = this.page.waitForEvent('download');
        await this.exportBtn.click();
        return await downloadPromise;
    }

    // ===== Assertion Helper =====
    getClickIdCell(id: string): Locator {
        return this.page.getByRole('cell', { name: id });
    }
}