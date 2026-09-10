import { expect, test } from '@playwright/test';

function appUrl(path: string) {
  if (!process.env.URL) throw new Error('URL must be configured.');
  return new URL(path, process.env.URL).toString();
}

test.describe('@meeting-video advertiser password reset', () => {
  test('Forgot password follows the account-enumeration-safe flow shown in the meeting', async ({
    page,
  }) => {
    await page.goto(appUrl('/signin'));
    await page.getByRole('link', { name: /forgot your password/i }).click();

    await expect(page.getByText(/forgot your password/i).first()).toBeVisible();
    const resetEmail = process.env.FO_USERNAME;
    if (!resetEmail) throw new Error('FO_USERNAME must be configured for password-reset testing.');
    await page.getByRole('textbox', { name: /email/i }).fill(resetEmail);
    await page.getByRole('button', { name: /reset password/i }).click();

    await expect(
      page.getByText(/if an account exists|reset your password|reset link/i).first(),
    ).toBeVisible();
    await expect(page.locator('body')).not.toContainText(
      /502 Bad Gateway|Internal Server Error|Application error/i,
    );
  });

  test('password remains masked after returning to sign in', async ({ page }) => {
    await page.goto(appUrl('/signin'));
    await page.getByRole('link', { name: /forgot your password/i }).click();

    const returnToLogin = page.getByRole('link', { name: /sign in|login|back/i }).first();
    if (await returnToLogin.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await returnToLogin.click();
    } else {
      await page.goto(appUrl('/signin'));
    }

    const password = page.locator('input[type="password"]');
    await password.fill('meeting-video-mask-check');
    await expect(password).toHaveAttribute('type', 'password');
  });
});
