

import { test } from '@playwright/test';
import ControlLoginPage from '../../pages/ControlLoginPage';
import { CONTROL_SITE_URL } from '../../fixtures/testConstants';

test('discover Control ticket navigation', async ({ page }) => {
  await page.goto(CONTROL_SITE_URL);
  await new ControlLoginPage(page).login();
  await page.waitForLoadState('domcontentloaded');

  const links = await page.locator('a').evaluateAll((elements) =>
    elements
      .map((element) => ({
        text: (element.textContent ?? '').trim().replace(/\s+/g, ' '),
        href: (element as HTMLAnchorElement).href,
      }))
      .filter(({ text, href }) => text && href),
  );

  console.log(JSON.stringify({ url: page.url(), title: await page.title(), links }, null, 2));
});
