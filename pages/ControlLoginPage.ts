import { Locator, Page } from '@playwright/test';
import BasePage from './BasePage';

export default class ControlLoginPage extends BasePage {
    readonly usernameField: Locator;
    readonly passwordField: Locator;
    readonly loginButton: Locator;

    constructor(page: Page) {
        super(page);
        this.usernameField = page.getByRole('textbox', { name: 'Username' });
        this.passwordField = page.getByRole('textbox', { name: 'Password' });
        this.loginButton = page.getByRole('button', { name: 'Log In' });
    }

    async login() {
        const username = process.env.CONTROL_USERNAME;
        const password = process.env.CONTROL_PASSWORD;

        if (!username || !password) {
            throw new Error('CONTROL_USERNAME or CONTROL_PASSWORD env vars not set');
        }

        await this.usernameField.fill(username);
        await this.passwordField.fill(password);
        await this.loginButton.click();
    }
}
