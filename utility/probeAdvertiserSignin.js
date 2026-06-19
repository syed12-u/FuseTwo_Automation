require('dotenv').config();

const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  const urls = [process.env.URL, new URL('/signin', process.env.URL).toString()];

  for (const url of urls) {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((error) => ({
      error: error.message,
    }));

    console.log('URL', url);
    console.log('status', typeof response.status === 'function' ? response.status() : response.error);
    console.log('landed', page.url());
    console.log('hasEmail', await page.locator('input[name=email]').count());
    console.log('title', await page.title().catch(() => ''));
  }

  await page.goto(new URL('/signin', process.env.URL).toString(), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('input[name=email]').fill(process.env.FO_USERNAME);
  await page.getByRole('textbox', { name: 'Password *' }).fill(process.env.FO_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(10000);
  console.log('afterLoginURL', page.url());
  console.log('afterLoginTitle', await page.title().catch(() => ''));
  console.log('dashboardText', (await page.locator('body').innerText()).slice(0, 300).replace(/\s+/g, ' '));

  await browser.close();
})();
