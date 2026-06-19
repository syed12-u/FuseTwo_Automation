import { Locator, Page } from '@playwright/test';
import BasePage from './BasePage';

export default class PendingEmailsPage extends BasePage {
    readonly advertisersMenu: Locator;
    readonly overviewLink: Locator;
    readonly pendingEmailsLink: Locator;
    readonly approveBtn: Locator;

    constructor(page: Page) {
        super(page);
        this.advertisersMenu = page.getByRole('link', { name: ' Advertisers' });
        this.overviewLink = page.getByRole('link', { name: ' Overview' });
        this.pendingEmailsLink = page.getByRole('link', { name: 'Pending Emails' });
        this.approveBtn = page.getByRole('button', { name: 'Approve' });
    }

    async navigateToPendingEmails() {
        await this.advertisersMenu.click();
        await this.overviewLink.click();
        await this.page.waitForLoadState('domcontentloaded');
        await this.pendingEmailsLink.waitFor({ state: 'visible' });
        await this.pendingEmailsLink.click();
    }

    async selectPendingEmailsByAdvertiser(advertiserName: string): Promise<number> {
        // Find rows where the advertiser column contains the advertiser name
        const matchingRows = this.page.locator('tr', {
            has: this.page.locator('td strong', { hasText: advertiserName })
        });

        await matchingRows.first().waitFor({ state: 'visible' });
        const rowCount = await matchingRows.count();

        if (rowCount === 0) {
            throw new Error(`No pending emails found for advertiser: "${advertiserName}"`);
        }

        // Click the checkbox span wrapper (ASP.NET renders checkbox inside span.chk)
        for (let i = 0; i < rowCount; i++) {
            await matchingRows.nth(i).locator('span.chk input[type="checkbox"]').click({ force: true });
        }

        return rowCount;
    }

    async approveSelected() {
        await this.approveBtn.click();
    }
}
