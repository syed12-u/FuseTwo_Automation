// navigationUtils.ts
import { Locator, Page } from '@playwright/test';
let shortDelay = 2000;

export async function navigateToHome(page: Page) {
  const baseURL = process.env.HOME_URL;
  const path = process.env.URL;
  if (typeof baseURL === 'string' && typeof path === 'string') {
    const completeURL = new URL(baseURL, path).toString();
    await page.goto(completeURL);
  }
}

export async function clickWithRetry(
  page: Page,
  locator: Locator,
  maxRetries = 2,
  delayBetweenRetries: number = shortDelay,
) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      await locator.click();
      // await checkServerError(page, locator)
      return; // Click succeeded, exit the loop
    } catch (error) {
      await page.waitForTimeout(delayBetweenRetries);
      // await checkServerError(page, locator)
      console.log(`Click attempt ${retries + 1} failed: ${error.message}`);
      retries++;
      console.log('clicked attempt ' + retries);
    }
  }
  console.log(`Failed to click after ${maxRetries} attempts`);
}
