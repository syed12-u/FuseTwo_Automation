import { Locator, Page, Response } from '@playwright/test';
import BasePage from './BasePage';
import { appUrl, PATHS } from '../config/environment';

/** Endpoint the sign-in form posts to. */
export const LOGIN_API_PATH = '/account/login';

export default class LoginPage extends BasePage {
  readonly loginEmailField: Locator;
  readonly loginPasswordField: Locator;
  readonly loginButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signUpLink: Locator;
  readonly rememberMeCheckbox: Locator;
  /** Banner shown above the form when the credentials are rejected. */
  readonly errorBanner: Locator;
  /** Inline "This field is required." messages rendered under each empty field. */
  readonly requiredFieldMessages: Locator;

  constructor(page: Page) {
    super(page);
    this.loginEmailField = page.locator('input[name="email"][type="text"]');
    this.loginPasswordField = page.locator('input[type="password"]');
    this.loginButton = page.getByRole('button', { name: 'Sign In' });
    this.forgotPasswordLink = page.getByRole('link', { name: /forgot your password/i });
    this.signUpLink = page.getByRole('link', { name: /^sign up$/i });
    this.rememberMeCheckbox = page.getByRole('checkbox', { name: /remember me/i });
    this.errorBanner = page.getByText(/invalid login attempt/i);
    this.requiredFieldMessages = page.getByText(/this field is required/i);
  }

  async goto() {
    await this.navigateTo(appUrl(PATHS.signin));
  }

  async login(username: string, password: string) {
    await this.loginEmailField.click({ force: true });
    await this.loginEmailField.clear();
    await this.loginEmailField.fill(username);
    await this.loginPasswordField.fill(password);
    await this.loginButton.click();
  }

  /**
   * Submit credentials and return the sign-in API response, so a test can
   * assert on the response body as well as on the UI.
   */
  async loginCapturingApiResponse(username: string, password: string): Promise<Response> {
    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes(LOGIN_API_PATH) && response.request().method() === 'POST',
    );

    await this.login(username, password);
    return responsePromise;
  }

  /** Submit the form with both fields left empty. */
  async submitEmpty() {
    await this.loginButton.click();
  }
}
