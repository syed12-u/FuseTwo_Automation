import { defineConfig, devices } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();
export default defineConfig({
  timeout: 2 * 60 * 1000,
  expect: { timeout: 30 * 1000 },
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  projects: [{ name: 'chromium-verify', use: { ...devices['Desktop Chrome'] } }],
});
