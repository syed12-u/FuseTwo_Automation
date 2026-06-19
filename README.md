# Advertiser Max Automation // Replace with your project name

## Tech
- Playwright using typescript

## Installation

Clone the code from the repo and open in VS code. Get all the dependencies using command

```sh
npm install
```

## Login Mechanism
- The login mechanism resides in Advertiser Max_Automation\tests\auth.setup.ts file
- If you created a test class and want to execute it using login with any role, make sure to uncomment the lines from Advertiser Max_Automation\playwright.config.ts mentioned below:

```sh
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
```

```sh
    dependencies: ['setup'],
```
- The test will start with login to OPS using the Admin role and it will save cookies in seperate json file (authentication.json).
- Once login is successful, no need to execute the login again so you can comment the above mentioned lines from Advertiser Max_Automation\playwright.config.ts and run your tests only (only their respective tokens expire).

## Test Script creation mechanism
- Create your test file of the feature you are working on. If for example, you are creating a file which needs to use employee user cookie, make sure to add test.use mechanism inside the describe block as mentioned below:

```sh
  test.use({ storageState: 'playwright/.auth/authentication.json' });
```
- Inside the test method, always make sure to start the test steps by navigating to home page using method mentioned below:

```sh
  await navigateToHome(page); // Test will start by navigating to home screen
```
## Sample Test Class
```sh
  import { test } from '@playwright/test';
  import { navigateToHome } from '../utility/navigationUtils';

test.describe('Sample Test Suite', () => {
  test.use({ storageState: 'playwright/.auth/authentication.json' });

  test('Sample Test Case', async ({ page }) => {
    await navigateToHome(page); // Test will start by navigating to home screen

    // your test steps starts here
    // your test steps starts here
    // Test case should always ends with an expect statement to verify the testcase
  });
});
```

## How to execute?
- In order to execute all the tests, run the command:
```sh
  npm test
```
- In order to execute a specific file, run the command:
```sh
  npm test <<file name with location>>
```
