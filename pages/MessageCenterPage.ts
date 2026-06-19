import { expect, Page, Locator } from '@playwright/test';
import BasePage from './BasePage';

export default class MessageCenterPage extends BasePage {

    // ===== Navigation Locators =====
    readonly publishersMenuBtn: Locator;
    readonly messageCenterLink: Locator;

    // ===== Address Book Locators =====
    readonly addressBookBtn: Locator;
    readonly programDropdownBtn: Locator;
    readonly programDropdownInput: Locator;
    readonly publisherTable: Locator;
    readonly publisherRows: Locator;
    readonly createMessageBtn: Locator;

    // ===== Compose Locators =====
    readonly subjectInput: Locator;
    readonly richTextEditor: Locator;
    readonly sourceBtn: Locator;
    readonly saveSourceBtn: Locator;
    readonly saveDraftBtn: Locator;
    readonly sendMessageBtn: Locator;

    // ===== Message List Locators =====
    readonly draftsTab: Locator;
    readonly sentTab: Locator;
    readonly newMessageCloseBtn: Locator;
    readonly showDetailLink: Locator;

    // ===== Confirmation Modal Locators =====
    readonly discardBtn: Locator;
    readonly saveAsDraftBtn: Locator;

    constructor(page: Page) {
        super(page);

        // Navigation
        this.publishersMenuBtn = page.getByRole('button', { name: ' Publishers' });
        this.messageCenterLink = page.getByRole('link', { name: 'Message Center' });

        // Address Book
        this.addressBookBtn = page.getByRole('button', { name: ' Address Book' });
        this.programDropdownBtn = page.getByRole('button', { name: 'Open' });
        this.programDropdownInput = page.getByRole('combobox');
        this.publisherTable = page.getByRole('table');
        this.publisherRows = this.publisherTable.locator('tbody tr');
        this.createMessageBtn = page.getByRole('button', { name: 'Create Message' });

        // Compose
        this.subjectInput = page.getByRole('textbox', { name: 'Subject *' });
        this.richTextEditor = page.getByRole('textbox', { name: 'Rich Text Editor. Editing' });
        this.sourceBtn = page.getByRole('button', { name: 'Source' });
        this.saveSourceBtn = page.getByRole('button', { name: 'Save', exact: true });
        this.saveDraftBtn = page.getByRole('button', { name: 'Save Draft' });
        this.sendMessageBtn = page.getByRole('button', { name: 'Send Message' });

        // Message List
        this.draftsTab = page.locator('span').filter({ hasText: 'Drafts' }).first();
        this.sentTab = page.getByText('Sent');
        this.newMessageCloseBtn = page.getByRole('heading', { name: 'New Message' }).getByRole('button');
        this.showDetailLink = page.getByText('Show Detail');

        // Confirmation Modal
        this.discardBtn = page.getByRole('button', { name: 'Discard' });
        this.saveAsDraftBtn = page.getByRole('button', { name: 'Save As Draft' });
    }

    // ===== Random Data =====
    private generateRandomAlphaString(length: number): string {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    generateMessageSubject(): string {
        return `Test Automation Message ${this.generateRandomAlphaString(6)}`;
    }

    // ===== Navigation =====
    async navigateToMessageCenter() {
        await this.publishersMenuBtn.click();
        await this.messageCenterLink.click();
    }

    // ===== Address Book =====
    async selectPublishersFromAddressBook(): Promise<number> {
        await this.addressBookBtn.click();

        // Open the program dropdown and wait for options to load
        await this.programDropdownBtn.click();
        const listbox = this.page.getByRole('listbox');
        await listbox.waitFor({ state: 'visible', timeout: 10000 });

        const options = listbox.getByRole('option');
        await options.first().waitFor({ state: 'visible', timeout: 10000 });

        const optionCount = await options.count();
        const programNames: string[] = [];
        for (let i = 0; i < optionCount; i++) {
            const text = await options.nth(i).textContent();
            if (text) programNames.push(text.trim());
        }
        // Close dropdown by pressing Escape
        await this.page.keyboard.press('Escape');

        // console.log(`[DEBUG] Found ${programNames.length} programs:`, programNames);

        let selectedCount = 0;

        for (const programName of programNames) {
            // Open dropdown and select program by name
            await this.programDropdownBtn.click();
            await listbox.waitFor({ state: 'visible', timeout: 5000 });
            await this.page.getByRole('option', { name: programName }).click();

            // Target only data row checkboxes (MuiTableRow-hover is on data rows, not header)
            const publisherCheckboxes = this.page.locator('tr.MuiTableRow-hover').getByRole('checkbox');
            try {
                await publisherCheckboxes.first().waitFor({ state: 'visible', timeout: 5000 });
            } catch {
                // console.log(`[DEBUG] Program "${programName}" - No publisher rows`);
                continue;
            }

            const cbCount = await publisherCheckboxes.count();
            // console.log(`[DEBUG] Program "${programName}" - Publisher checkboxes: ${cbCount}`);

            if (cbCount > 0) {
                for (let r = 0; r < cbCount; r++) {
                    const checkbox = publisherCheckboxes.nth(r);
                    await checkbox.check({ force: true });
                    await expect(checkbox).toBeChecked();
                }
                selectedCount = cbCount;
                break;
            }
        }

        if (selectedCount === 0) {
            throw new Error('No program found with available publishers');
        }

        await this.createMessageBtn.click();
        return selectedCount;
    }

    // ===== HTML Template =====
    private readonly messageHtmlTemplate = `<h2 style="color:#333333; text-align:center;">Boost Your Business Today</h2>
<p style="color:#555555; font-size:14px; text-align:center;">Discover how our solutions can help you grow faster, save time, and increase revenue.</p>
<img src="https://via.placeholder.com/500x200" alt="Promo Image" style="display:block; margin:0 auto; max-width:500px; height:auto;">`;

    // ===== Compose =====
    async composeMessage(subject: string) {
        await this.subjectInput.click();
        await this.subjectInput.fill(subject);

        // Focus the rich text editor before switching to source mode
        await this.richTextEditor.getByRole('paragraph').click();
        await this.sourceBtn.click();

        // Select all existing source content and replace with HTML template
        await this.page.keyboard.press('ControlOrMeta+a');
        await this.page.keyboard.type(this.messageHtmlTemplate, { delay: 0 });
        await this.saveSourceBtn.click();
    }

    async saveDraft() {
        const saveResponse = this.page.waitForResponse(
            (response) =>
                /messagecenter/i.test(response.url()) &&
                response.request().method() !== 'GET',
            { timeout: 30000 },
        ).catch(() => null);

        await this.saveDraftBtn.click();
        await saveResponse;

        try {
            await this.subjectInput.waitFor({ state: 'hidden', timeout: 10000 });
            return;
        } catch {
            await this.newMessageCloseBtn.click();
            if (await this.discardBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                const draftResponse = this.page.waitForResponse(
                    (response) =>
                        /messagecenter/i.test(response.url()) &&
                        response.request().method() !== 'GET',
                    { timeout: 30000 },
                ).catch(() => null);
                await this.saveAsDraftBtn.click();
                await draftResponse;
                await this.subjectInput.waitFor({ state: 'hidden', timeout: 10000 });
                if (await this.discardBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await this.discardBtn.click();
                }
            }
        }
    }

    async sendMessage() {
        const sendResponse = this.page.waitForResponse(
            (response) =>
                /messagecenter/i.test(response.url()) &&
                response.request().method() !== 'GET',
            { timeout: 30000 },
        ).catch(() => null);
        await this.sendMessageBtn.click();
        await sendResponse;
    }

    // ===== Draft / Sent Navigation =====
    async goToDrafts() {
        const mailResponse = this.waitForMailboxLoad();
        await this.draftsTab.click();
        await mailResponse;
    }

    async goToSent() {
        const mailResponse = this.waitForMailboxLoad();
        await this.sentTab.click();
        await mailResponse;
    }

    async closeNewMessagePanel() {
        await this.newMessageCloseBtn.click();
    }

    async dismissConfirmationModal() {
        await this.discardBtn.click();
    }

    async openMessage(subject: string) {
        await this.page.getByText(subject).click();
    }

    async viewPublisherDetails(publisherCount: number) {
        await this.page.getByText(`To ${publisherCount} publisher(s)`).click();
        await this.showDetailLink.click();
    }

    // ===== Dynamic Locators =====
    getMessageBySubject(subject: string): Locator {
        return this.page.getByText(subject);
    }

    private async waitForMailboxLoad() {
        return this.page.waitForResponse(
            (response) =>
                /messagecenter\/getmail/i.test(response.url()) &&
                response.request().method() === 'POST',
            { timeout: 30000 },
        ).catch(() => null);
    }
}
