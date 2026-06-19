import { Page, Locator } from '@playwright/test';
import BasePage from './BasePage';

export default class ProgramPage extends BasePage {

    // ===== Locators =====
    readonly programsMenuBtn: Locator;
    readonly programsLink: Locator;
    readonly addProgramBtn: Locator;

    readonly programNameInput: Locator;
    readonly domainUrlInput: Locator;
    readonly closeAutomationAssistanceModal: Locator;
    readonly categoryDropdown: Locator;
    readonly categoryOption: Locator;
    readonly countryDropdown: Locator;
    readonly countryOption: Locator;
    readonly generalInformationHeading: Locator;
    readonly descriptionInput: Locator;

    readonly continueBtn: Locator;

    readonly commissionInput: Locator;
    readonly returnDaysInput: Locator;
    readonly payoutInput: Locator;
    readonly subCategoryDropdown: Locator;
    readonly subCategoryOption: Locator;

    readonly manualReviewCheckbox: Locator;

    readonly trackingInput: Locator;
    readonly addKerwordButton: Locator;

    readonly saveContinueBtn: Locator;

    readonly successAlert: Locator;
    readonly programTable: Locator;

    constructor(page: Page) {
        super(page);

        this.programsMenuBtn = page.getByRole('button', { name: ' Programs' });
        this.programsLink = page.getByRole('link', { name: 'Programs' });
        this.addProgramBtn = page.getByRole('button', { name: 'Add Program' });

        this.programNameInput = page.getByRole('textbox', { name: 'Program Name *' });
        this.domainUrlInput = page.getByRole('textbox', { name: 'Domain URL *' });

        this.generalInformationHeading = page.getByRole('heading', { name: 'General information about' });

        this.closeAutomationAssistanceModal = page.getByRole('button', { name: 'No' });

        this.categoryDropdown = page.getByRole('combobox', { name: 'Category *' });
        this.categoryOption = page.getByRole('option', { name: 'Automotive' });

        this.countryDropdown = page.getByRole('combobox', { name: 'Country *' });
        this.countryOption = page.getByRole('option', { name: 'United States', exact: true });

        this.descriptionInput = page.getByRole('textbox', { name: 'Description *' });

        this.continueBtn = page.getByRole('button', { name: 'Continue' });

        this.commissionInput = page.getByRole('spinbutton', { name: 'Commission Amount *' });
        this.returnDaysInput = page.getByRole('textbox', { name: 'Return Days *' });
        this.payoutInput = page.getByRole('textbox', { name: 'Example: The payout is $25' });

        this.subCategoryDropdown = page.getByRole('combobox', { name: 'Subcategory *' });
        this.subCategoryOption = page.getByRole('option', { name: 'Car Buying and Selling' });

        this.manualReviewCheckbox = page.getByRole('checkbox', { name: 'Manual Review' });

        this.trackingInput = page.locator('input[name="searchTag"]');
        this.addKerwordButton = page.getByRole('button', { name: 'Add Keywords' });

        this.saveContinueBtn = page.getByRole('button', { name: 'Save & Continue' });

        this.successAlert = page.getByRole('alert');
        this.programTable = page.getByRole('table');
    }

    // ===== Reusable Random Generator (same concept as signup) =====
    private generateRandomAlphaString(length: number): string {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        let result = '';

        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return result;
    }

    private generateProgramName(): string {
        return `testautomationprogram${this.generateRandomAlphaString(5)}`;
    }

    // ===== Navigation =====
    async navigateToPrograms() {
        await this.programsMenuBtn.click();
        await this.programsLink.click();
        await this.addProgramBtn.click();
    }

    async navigateToProgramsMenu() {
        await this.programsMenuBtn.click();
    }

    // ===== Main Flow =====
    async createProgram(): Promise<string> {
        const programName = this.generateProgramName();
        const domain = `https://${programName.toLowerCase()}.com`;

        // Step 1
        await this.programNameInput.fill(programName);
        await this.domainUrlInput.fill(domain);
        await this.generalInformationHeading.click();
        await this.closeAutomationAssistanceModal.click();

        await this.categoryDropdown.click();
        await this.categoryOption.click();

        await this.countryDropdown.click();
        await this.countryOption.click();

        await this.descriptionInput.fill(programName);

        await this.continueBtn.click();

        // Step 2
        await this.commissionInput.fill('10');
        await this.returnDaysInput.fill('7');
        await this.payoutInput.fill(programName);

        await this.subCategoryDropdown.click();
        await this.subCategoryOption.click();

        await this.continueBtn.click();

        // Step 3
        await this.manualReviewCheckbox.check();
        await this.continueBtn.click();
        
        // Step 4
        await this.trackingInput.fill(programName);
        await this.page.waitForTimeout(1000);

        await this.addKerwordButton.click();

        await this.saveContinueBtn.click();

        return programName;
    }
    
    async goToProgramsList() {
        await this.programsLink.click();
    }

    // ===== Dynamic Locator =====
    getProgramRow(programName: string): Locator {
        return this.page.getByRole('cell', { name: `${programName} All` });
    }
}