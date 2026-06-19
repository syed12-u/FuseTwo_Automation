import { Locator, Page } from '@playwright/test';
import BasePage from './BasePage';

export default class LoginPage extends BasePage {
  readonly loginEmailField: Locator;
  readonly loginPasswordField: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    super(page);
    this.loginEmailField = page.locator('input[name="email"][type="text"]');
    this.loginPasswordField = page.getByRole('textbox', { name: 'Password *' });
    this.loginButton = page.getByRole('button', { name: 'Sign In' });
  }

  async login(username: string, password: string) {
    await this.loginEmailField.click({force: true}); 
    await this.loginEmailField.clear(); 
    await this.loginEmailField.fill(username);
    await this.loginPasswordField.fill(password);
    await this.loginButton.click();
  }
}
