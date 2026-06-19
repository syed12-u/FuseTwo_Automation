import { Page, Locator } from '@playwright/test';
import BasePage from './BasePage';
import {
    PASSWORD,
    SECURITY_ANSWER,
    CAPTCHA,
    PHONE_NUMBER,
    ZIP_CODE
} from '../fixtures/testConstants';

export default class SignUpPage extends BasePage {

    // ===== Locators =====
    readonly firstName: Locator;
    readonly lastName: Locator;
    readonly email: Locator;
    readonly confirmEmail: Locator;
    readonly password: Locator;
    readonly confirmPassword: Locator;
    readonly securityQuestion: Locator;
    readonly securityQuestionOption: Locator;
    readonly securityAnswer: Locator;
    readonly captcha: Locator;
    readonly continueBtn: Locator;

    readonly companyName: Locator;
    readonly websiteUrl: Locator;
    readonly address: Locator;
    readonly country: Locator;
    readonly countryOption: Locator;
    readonly city: Locator;
    readonly state: Locator;
    readonly stateOption: Locator;
    readonly zip: Locator;
    readonly phone: Locator;
    readonly advertisingAgency: Locator;
    readonly agencyOption: Locator;
    readonly platform: Locator;
    readonly platformOption: Locator;

    readonly affiliate: Locator;
    readonly affiliateOption: Locator;
    readonly submitBtn: Locator;

    readonly successMessage: Locator;

    constructor(page: Page) {
        super(page);

        this.firstName = page.getByRole('textbox', { name: 'First Name *' });
        this.lastName = page.getByRole('textbox', { name: 'Last Name *' });
        this.email = page.getByRole('textbox', { name: 'Email Address *', exact: true });
        this.confirmEmail = page.getByRole('textbox', { name: 'Confirm Email Address *' });
        this.password = page.getByRole('textbox', { name: 'Password *', exact: true });
        this.confirmPassword = page.getByRole('textbox', { name: 'Confirm Password *' });

        this.securityQuestion = page.getByRole('combobox', { name: 'Security Question *' });
        this.securityQuestionOption = page.getByRole('option', { name: 'What Is your favorite book?' });
        this.securityAnswer = page.getByRole('textbox', { name: 'Security Answer *' });

        this.captcha = page.getByRole('textbox', { name: 'Captcha *' });
        this.continueBtn = page.getByRole('button', { name: 'Continue' });

        this.companyName = page.getByRole('textbox', { name: 'Company Name *' });
        this.websiteUrl = page.getByRole('textbox', { name: 'Website URL *' });
        this.address = page.getByRole('textbox', { name: 'Address *' });

        this.country = page.getByRole('combobox', { name: 'Country *' });
        this.countryOption = this.page.locator('li[role="option"][data-option-index="0"]');

        this.city = page.getByRole('textbox', { name: 'City *' });

        this.state = page.getByRole('combobox', { name: 'State *' });
        this.stateOption = page.getByRole('option', { name: 'Alaska' });

        this.zip = page.getByRole('textbox', { name: 'Zip / Postal *' });
        this.phone = page.locator('input[name="phone"]');

        this.advertisingAgency = page.getByRole('combobox', { name: 'Are you an advertising agency' });
        this.agencyOption = page.getByRole('option', { name: 'No', exact: true });

        this.platform = page.getByRole('combobox', { name: 'Website Platform *' });
        this.platformOption = page.getByRole('option', { name: 'WordPress.org' });

        this.affiliate = page.getByRole('combobox', { name: 'Listed in another affiliate' });
        this.affiliateOption = page.getByRole('option', { name: 'No' });

        this.submitBtn = page.getByRole('button', { name: 'Save & Submit' });

        this.successMessage = page.getByRole('heading');
    }

    // ===== Random Data Generator =====
    private generateRandomString(length: number): string {
        return Math.random().toString(36).substring(2, 2 + length);
    }

    private generateRandomEmail(): string {
        return `test_${this.generateRandomString(5)}@flexverify.com`;
    }

    private generateRandomAlphaString(length: number): string {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        let result = '';

        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return result;
    }

    // ===== Actions =====
    async fillUserDetails() {
        const randomEmail = this.generateRandomEmail();

        await this.firstName.fill(this.generateRandomAlphaString(6));
        await this.lastName.fill(this.generateRandomAlphaString(6));

        await this.email.fill(randomEmail);
        await this.confirmEmail.fill(randomEmail);

        await this.password.fill(PASSWORD);
        await this.confirmPassword.fill(PASSWORD);

        await this.securityQuestion.click();
        await this.securityQuestionOption.click();

        await this.securityAnswer.fill(SECURITY_ANSWER);

        await this.page.waitForTimeout(10000);

        await this.captcha.fill(CAPTCHA);

        await this.continueBtn.click();
    }

    async fillCompanyDetails() {
        await this.companyName.fill(`Test_Company_${this.generateRandomString(5)}`);
        await this.websiteUrl.fill(`https://www.test${this.generateRandomString(5)}.com`);

        await this.address.fill('Random US Address');

        await this.country.click();
        await this.countryOption.click();

        await this.city.fill('Lake');

        await this.state.click();
        await this.stateOption.click();

        await this.zip.fill(ZIP_CODE);
        await this.phone.fill(PHONE_NUMBER);

        await this.advertisingAgency.click();
        await this.agencyOption.click();

        await this.platform.click();
        await this.platformOption.click();

        await this.continueBtn.click();

        await this.affiliate.click();
        await this.affiliateOption.click();
    }

    async submitForm() {
        await this.submitBtn.click();
    }
}