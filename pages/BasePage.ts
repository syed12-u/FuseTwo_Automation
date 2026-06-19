import { Page } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';
// Load environment variables from .env file
dotenvConfig();

export default class BasePage {
  constructor(protected page: Page) {}

  async navigateTo(url: string) {
    await this.page.goto(url);
  }
}
