import { Page, Locator, expect } from '@playwright/test';
import BasePage from './BasePage';

export default class ClicksDetailsPage extends BasePage {
    readonly reportingBtn: Locator;
    readonly clicksDetailedLink: Locator;

    readonly fromDateIcon: Locator;
    readonly toDateIcon: Locator;
    readonly applyBtn: Locator;

    readonly programNameHeader: Locator;
    readonly clickIdHeader: Locator;
    readonly publisherIdHeader: Locator;

    readonly altFilterButton: Locator;
    readonly valueInput: Locator;

    readonly showHideColumnsBtn: Locator;
    readonly programIdCheckbox: Locator;
    readonly backdropOverlay: Locator;

    readonly exportBtn: Locator;
    readonly table: Locator;

    constructor(page: Page) {
        super(page);

        this.reportingBtn = page.getByRole('button', { name: /Reporting/i }).first();
        this.clicksDetailedLink = page.getByRole('link', { name: 'Clicks Detailed' });

        this.fromDateIcon = page.locator('div').filter({ hasText: /^From$/ }).locator('path').first();
        this.toDateIcon = page.locator('div').filter({ hasText: /^To$/ }).locator('path').first();
        this.applyBtn = page.getByRole('button', { name: 'Apply' });

        this.programNameHeader = page.getByRole('columnheader', { name: /Program Name/i }).first();
        this.clickIdHeader = page.getByRole('columnheader', { name: 'Click ID' });
        this.publisherIdHeader = page.getByRole('columnheader', { name: 'Publisher ID' });

        this.altFilterButton = page.getByRole('button', { name: /alt/i }).first();
        this.valueInput = page.getByLabel('Value');

        this.showHideColumnsBtn = page.getByLabel('Show or hide table columns');
        this.programIdCheckbox = page.locator('div').filter({ hasText: /^Program ID$/ }).getByRole('checkbox');
        this.backdropOverlay = page.locator('.MuiBackdrop-root');

        this.exportBtn = page.getByRole('button', { name: 'Export' });
        this.table = page.locator('table');
    }

    async navigateToClicksDetailed() {
        await this.reportingBtn.click();
        await expect(this.clicksDetailedLink).toBeVisible({ timeout: 10000 });
        await this.clicksDetailedLink.click();
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
        const dayCell = this.page.getByRole('gridcell', { name: day, exact: true }).first();
        await expect(dayCell).toBeVisible({ timeout: 10000 });
        await dayCell.click();
    }

    async sortByProgramName() {
        await this.clickColumnHeader(this.programNameHeader);
    }

    async sortByClickId() {
        await this.clickColumnHeader(this.clickIdHeader);
    }

    async sortByPublisherId() {
        await this.clickColumnHeader(this.publisherIdHeader);
    }

    async clickColumnHeader(header: Locator) {
        await expect(header).toBeVisible({ timeout: 10000 });
        const button = header.getByRole('button').first();
        if ((await button.count()) > 0) {
            await button.click();
            return;
        }
        await header.click();
    }

    async applyAltValueFilter(value: string) {
        await this.altFilterButton.click();
        await this.valueInput.fill(value);
        await this.valueInput.press('Enter');
    }

    async openColumnVisibilityPanel() {
        await this.showHideColumnsBtn.click();
    }

    async checkProgramIdColumn() {
        await this.programIdCheckbox.check();
    }

    async closeColumnPanel() {
        await this.backdropOverlay.click();
    }

    async exportReport() {
        const downloadPromise = this.page.waitForEvent('download');
        await this.exportBtn.click();
        return await downloadPromise;
    }

    async verifyTableVisible() {
        await expect(this.table).toBeVisible({ timeout: 10000 });
    }

    async verifyExportBtnVisible() {
        await expect(this.exportBtn).toBeVisible({ timeout: 10000 });
    }
}
