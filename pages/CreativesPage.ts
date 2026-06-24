import { Page, Locator, expect } from '@playwright/test';
import BasePage from './BasePage';

export default class CreativesPage extends BasePage {

    // ===== Locators =====
    readonly creativesLink: Locator;
    readonly addTextLinkBtn: Locator;

    readonly programDropdown: Locator;
    readonly programOption: (programName: string) => Locator;

    readonly campaignDropdown: Locator;
    readonly campaignOption: (programName: string) => Locator;

    readonly textInput: Locator;
    readonly nextBtn: Locator;
    readonly saveBtn: Locator;

    readonly createdTextLabel: Locator;

    readonly addBannerBtn: Locator;

    readonly imageTitleInput: Locator;
    readonly imageAltInput: Locator;
    readonly chooseFileInput: Locator;

    readonly invisibleToPublishersText: Locator;
    readonly successAlert: Locator;
    readonly bannerListingPanel: Locator;


    constructor(page: Page) {
        super(page);

        this.creativesLink = page.getByRole('link', { name: 'Creatives' });
        this.addTextLinkBtn = page.getByRole('button', { name: 'Add Text Link' });

        this.programDropdown = page.getByRole('combobox', { name: 'Program *' });
        this.programOption = (programName: string) =>
            page.getByRole('option', { name: programName });

        this.campaignDropdown = page.getByRole('combobox', { name: 'Campaign *' });
        this.campaignOption = (programName: string) =>
            page.getByRole('option', { name: programName });

        this.textInput = page.getByRole('textbox').first();
        this.nextBtn = page.getByRole('button', { name: 'Next' });
        this.saveBtn = page.getByRole('button', { name: 'Save' });

        this.createdTextLabel = page.locator('body'); // can refine later

        this.addBannerBtn = page.getByRole('button', { name: 'Add Banner' });

        this.textInput = page.getByRole('textbox').first();

        this.imageTitleInput = page.getByRole('textbox', { name: 'Image Title *' });
        this.imageAltInput = page.getByRole('textbox', { name: 'Image Alt *' });
        this.chooseFileInput = page.locator('input[type="file"]');

        this.invisibleToPublishersText = page.getByText('Invisible to publishers');
        this.successAlert = page.getByRole('alert');
        this.bannerListingPanel = page.locator('#scrollable-prevent-tabpanel-0');
    }

    // ===== Navigation =====
    async navigateToCreatives(programPage: any) {
        // await programPage.programsMenuBtn.click(); // reuse ProgramPage locator
        await this.creativesLink.click();
    }

    // ===== Actions =====
    // Selecting the program triggers an async load of its campaign list, and
    // the campaign dropdown can be briefly covered by the closing program
    // overlay. Open the dropdown only when no listbox is showing (so we never
    // toggle it shut) and retry until the campaign option appears, instead of
    // clicking blindly and timing out. This was the source of testAddTextLink
    // flaking on the slower CI agent.
    private async selectProgramAndCampaign(programName: string) {
        await this.programDropdown.click();
        await this.programOption(programName).click();

        const option = this.campaignOption(programName);
        const listbox = this.page.getByRole('listbox').first();
        await expect(async () => {
            if (!(await listbox.isVisible().catch(() => false))) {
                await this.campaignDropdown.click();
            }
            await expect(option).toBeVisible({ timeout: 3000 });
        }).toPass({ timeout: 60000 });
        await option.click();
    }

    async createTextLink(programName: string, text: string) {
        await this.addTextLinkBtn.click();

        await this.selectProgramAndCampaign(programName);

        await this.textInput.fill(text);

        await this.nextBtn.click();
        await this.saveBtn.click();
    }

    // ===== Assertion Helper =====
    getCreatedText(text: string): Locator {
        return this.page.getByText(text);
    }

    async createBanner(programName: string, filePath: string) {
        const imageTitle = `Image Title ${programName}`;
        const imageAlt = `Image Alt ${programName}`;

        await this.addBannerBtn.click();

        await this.selectProgramAndCampaign(programName);

        await this.imageTitleInput.fill(imageTitle);
        await this.imageAltInput.fill(imageAlt);

        await this.chooseFileInput.setInputFiles(filePath);

        await this.nextBtn.click();

        await this.invisibleToPublishersText.click();
        await this.saveBtn.click();
    }

    // ===== Assertion Helper =====
    getBannerListing(programName: string): Locator {
        return this.bannerListingPanel.getByText(`${programName} | ${programName}`).first();
    }
}