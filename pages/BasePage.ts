import { Page } from '@playwright/test';
// Importing the environment module resolves TEST_ENV and loads the matching
// .env files, so any page object is usable on its own (e.g. from a script).
import '../config/environment';

export default class BasePage {
  constructor(protected page: Page) {}

  async navigateTo(url: string) {
    await this.page.goto(url);
  }
}
