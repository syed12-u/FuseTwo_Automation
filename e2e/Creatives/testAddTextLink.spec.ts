import { test, expect } from '@playwright/test';
import ProgramPage from '../../pages/ProgramPage';
import CreativesPage from '../../pages/CreativesPage';
import { navigateToHome } from '../../utility/navigationUtils';
import { CREATIVE_TEXT } from '../../fixtures/testConstants';

test.describe('Creatives - Text Link Flow', () => {
    test.use({ storageState: 'playwright/.auth/authentication.json' });

    test('Verify user can create a Text Link Creative', async ({ page }) => {

        await navigateToHome(page);

        const programPage = new ProgramPage(page);
        const creativesPage = new CreativesPage(page);

        // Step 1: Create Program (reuse existing flow)
        await programPage.navigateToPrograms();  // Nevigate to Programs
        const programName = await programPage.createProgram(); console.log(programName);

        await expect(programPage.successAlert).toBeVisible();  // Validation for program creation

        // Step 2: Navigate to Creatives
        await creativesPage.navigateToCreatives(programPage);   // Navigate to Creatives

        const creativeText = CREATIVE_TEXT(programName); console.log(creativeText);

        // Step 3: Create Text Link
        await creativesPage.createTextLink(programName, creativeText);      // Create Text Link

        // Step 4: Assertion
        await expect(creativesPage.getCreatedText(creativeText)).toBeVisible(); // Validation for newly created text link
    });
});
