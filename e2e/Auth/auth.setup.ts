import { test as setup, expect, Page } from '@playwright/test';
import LoginPage from '../../pages/LoginPage';

const authFile = 'playwright/.auth/authentication.json';

setup('Authenticate With Advertiser Max Login', async ({ page }) => {
  await loginUser(page, process.env.FO_USERNAME, process.env.FO_PASSWORD);

  await page.context().storageState({ path: authFile });
});


async function loginUser(page: Page, username: string | undefined, password: string | undefined) {
  const loginPage = new LoginPage(page);
  const baseURL = process.env.URL;
  const homepageUrl = process.env.HOME_URL;
  if (
    typeof baseURL === 'string' &&
    typeof homepageUrl === 'string' &&
    typeof username === 'string' &&
    typeof password === 'string'
  ) {
    await loginPage.navigateTo(baseURL);
    await loginPage.login(username, password);
    const completeURL = new URL(homepageUrl, baseURL).toString();
    await page.waitForURL(completeURL);
  }
}
