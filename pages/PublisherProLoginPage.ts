import { Page, Locator } from '@playwright/test';
import BasePage from './BasePage';

export default class PublisherProLoginPage extends BasePage {
  readonly emailField: Locator;
  readonly passwordField: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    super(page);

    this.emailField = page.locator('input[name="txtEmail"]');
    this.passwordField = page.locator('input[name="txtPassword"]');
    this.loginButton = page.getByRole('button', { name: 'Log In' });
  }

  async login(email: string, password: string) {
    await this.emailField.fill(email);
    await this.passwordField.fill(password);
    await this.loginButton.click();
  }
}