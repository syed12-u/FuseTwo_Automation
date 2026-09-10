import { expect, type Locator, type Page } from '@playwright/test';
import BasePage from './BasePage';
import { env } from '../config/environment';

/**
 * Access to the management portal.
 *
 * The portal is IIS with Windows Integrated Authentication: it answers the very
 * first request with 401 and "WWW-Authenticate: Negotiate, NTLM", before any
 * application code runs. There is no e-mail/password form to fill — Chromium
 * single-signs-on with the current Windows domain session, enabled by
 * --auth-server-allowlist in playwright.config.ts.
 *
 * This class therefore verifies that SSO succeeded rather than performing a
 * form login. The old behaviour (look for a password box, fill it) could never
 * work and failed later with a confusing "element not found".
 */
export default class ManagementLoginPage extends BasePage {
  readonly unauthorizedBanner: Locator;
  readonly userChip: Locator;

  constructor(page: Page) {
    super(page);
    this.unauthorizedBanner = page.getByText(/401\s*-\s*Unauthorized/i);
    this.userChip = page.getByText(/^[A-Z]{2}[A-Z][a-z]+/).first();
  }

  /**
   * Confirm the browser got past the Windows authentication challenge.
   * Throws with the actual cause when it did not, instead of letting a later
   * locator time out.
   */
  async assertAuthenticated() {
    if (await this.unauthorizedBanner.isVisible({ timeout: 5_000 }).catch(() => false)) {
      throw new Error(
        `Management portal returned "401 - Unauthorized" at ${env.managementBaseUrl}.\n` +
          `The portal uses Windows Integrated Authentication (Negotiate/NTLM), so the ` +
          `browser must single-sign-on with a domain account that has access.\n` +
          `Checks:\n` +
          `  1. playwright.config.ts must launch Chromium with ` +
          `--auth-server-allowlist=${env.authServerAllowlist}\n` +
          `  2. The OS user running the tests must be a domain account permitted on the portal. ` +
          `On the CI agent that is the build service account, not your own login.`,
      );
    }

    await expect(
      this.page.locator('body'),
      'management portal did not render after Windows authentication',
    ).not.toHaveText('');
  }

  /**
   * Kept for backwards compatibility with existing specs; Windows SSO happens
   * at the transport layer, so this only validates the outcome.
   */
  async loginIfRequired() {
    await this.assertAuthenticated();
  }
}
