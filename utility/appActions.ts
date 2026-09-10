// Shared actions for the advertiser app.
//
// The payment-reminder modal is the big one here: it renders over the whole
// dashboard on an unpredictable subset of loads and swallows every click, which
// is why suites that do not dismiss it fail intermittently on locators that are
// genuinely present. Navigate through gotoApp() and it is handled once.

import { expect, Page } from '@playwright/test';
import { appUrl } from '../config/environment';

/** Button that closes the payment-reminder / "payment is due" modal. */
function paymentDismissButton(page: Page) {
  return page
    .getByRole('button', { name: /Remind me later|Not now|Maybe later/i })
    .first();
}

const AUTO_DISMISS_FLAG = Symbol.for('fusetwo.paymentReminderAutoDismiss');

/**
 * Register a background handler that auto-closes the payment-reminder modal
 * WHENEVER it appears during the test — not just once. The modal renders over
 * the dashboard on an unpredictable subset of loads (and can appear a beat after
 * navigation), so a one-shot check misses it and the next click hangs. Playwright
 * fires this handler the moment the modal blocks an action. Idempotent per page.
 */
export async function installPaymentReminderAutoDismiss(page: Page): Promise<void> {
  const flagged = page as unknown as Record<symbol, boolean>;
  if (flagged[AUTO_DISMISS_FLAG]) return;
  flagged[AUTO_DISMISS_FLAG] = true;

  const dismiss = paymentDismissButton(page);
  await page.addLocatorHandler(
    dismiss,
    async () => {
      await dismiss.click({ timeout: 5_000 }).catch(() => {});
    },
    { noWaitAfter: true },
  );
}

/**
 * Close the payment reminder when it is showing, and arm the auto-dismiss
 * handler for the rest of the test. Safe to call on any page — it resolves
 * immediately when the modal is absent.
 */
export async function dismissPaymentReminderIfPresent(page: Page): Promise<boolean> {
  // Arm the always-on handler so a later pop-up can never block the run.
  await installPaymentReminderAutoDismiss(page).catch(() => {});

  const dismiss = paymentDismissButton(page);
  if (!(await dismiss.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return false;
  }

  await dismiss.click().catch(() => {});
  await expect(dismiss).toBeHidden().catch(() => {});
  return true;
}

/**
 * Navigate to a path on the advertiser app and clear anything that would block
 * interaction with the page underneath.
 */
export async function gotoApp(
  page: Page,
  path: string,
  options: { dismissReminder?: boolean } = {},
) {
  const response = await page.goto(appUrl(path), { waitUntil: 'domcontentloaded' });

  if (options.dismissReminder !== false) {
    await dismissPaymentReminderIfPresent(page);
  }

  return response;
}

/**
 * Assert that a protected route sends an unauthenticated visitor to sign-in.
 *
 * The app guards routes client-side: it starts loading the document and then
 * redirects, which cancels the in-flight navigation and surfaces in Playwright
 * as net::ERR_ABORTED. That abort *is* the guard doing its job, so it is
 * tolerated here — the assertion is on where the browser actually ended up.
 * Any other navigation error is re-thrown.
 */
export async function expectRedirectToSignin(page: Page, path: string) {
  try {
    await page.goto(appUrl(path), { waitUntil: 'domcontentloaded' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('net::ERR_ABORTED')) throw error;
  }

  await expect(page).toHaveURL(/\/signin/i);
}

/**
 * Assert the current page is not an error page. The advertiser app renders 500s
 * inside a normal 200 document, so status alone does not catch them.
 */
export async function expectNoServerError(page: Page) {
  await expect(page.locator('body')).not.toContainText(
    /502 Bad Gateway|Internal Server Error|Application error|Something went wrong/i,
  );
}
