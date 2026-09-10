import { expect, Locator, Page } from '@playwright/test';
import BasePage from './BasePage';
import { PATHS } from '../config/environment';

/**
 * The persistent application shell: top navigation, the account chip and the
 * account menu behind it. The account chip is labelled with the advertiser id
 * followed by the first name (e.g. "1062551Playwright"), so it is matched by
 * shape rather than by a fixed string.
 */
export default class AppShellPage extends BasePage {
  readonly accountChip: Locator;
  readonly accountMenuProfile: Locator;
  readonly accountMenuLogout: Locator;
  readonly notificationsButton: Locator;

  /** Top-level navigation buttons, in the order the app renders them. */
  static readonly PRIMARY_NAV = [
    'Dashboard',
    'Programs',
    'Publishers',
    'Accounting',
    'Reporting',
    'Settings',
    'Support',
  ] as const;

  /** Sidebar links that must point at a specific route. */
  static readonly NAV_DESTINATIONS = [
    { name: 'Programs', path: PATHS.programs },
    { name: 'Campaigns', path: PATHS.campaigns },
    { name: 'Creatives', path: PATHS.creatives },
    { name: 'Coupons & Offers', path: PATHS.couponsAndOffers },
    { name: 'Products', path: PATHS.products },
    { name: 'Publisher List', path: PATHS.publisherList },
  ] as const;

  constructor(page: Page) {
    super(page);
    this.accountChip = page.locator('button').filter({ hasText: /^\d{5,}\S*/ }).first();
    this.accountMenuProfile = page.getByText(/^Profile$/i).first();
    this.accountMenuLogout = page.getByText(/^Log ?out$/i).first();
    this.notificationsButton = page.getByRole('button', { name: /Notifications/i });
  }

  async openAccountMenu() {
    await expect(this.accountChip).toBeVisible();
    // The account chip keeps re-rendering while account data loads, so a normal
    // click can wait forever for it to be "stable". Bound each click and force
    // it on retries (skipping the stability wait), until the menu opens.
    for (let attempt = 0; attempt < 4; attempt++) {
      await this.accountChip
        .click({ timeout: 5000, force: attempt > 0 })
        .catch(() => {});
      if (
        await this.accountMenuLogout.isVisible().catch(() => false)
      ) {
        return;
      }
      await this.page.waitForTimeout(800);
    }
    await expect(this.accountMenuLogout).toBeVisible();
  }

  /** Open the account menu and sign out. Resolves once the app is back on sign-in. */
  async logout() {
    await this.openAccountMenu();
    await this.accountMenuLogout.click();
    await this.page.waitForURL(new RegExp(`${PATHS.signin}/?$`, 'i'));
  }

  navLink(name: string): Locator {
    return this.page.getByRole('link', { name, exact: true });
  }

  navButton(name: string): Locator {
    return this.page.getByRole('button', { name, exact: true });
  }
}
