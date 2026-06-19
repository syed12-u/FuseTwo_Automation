import { test, expect } from '@playwright/test';
import ProgramPage from '../../pages/ProgramPage';
import CreativesPage from '../../pages/CreativesPage';
import { navigateToHome } from '../../utility/navigationUtils';

test.describe('Creatives - Banner Flow', () => {
    test.use({ storageState: 'playwright/.auth/authentication.json' });

    test('Verify user can create a Banner Creative', async ({ page }) => {
        await navigateToHome(page);

        const programPage = new ProgramPage(page);
        const creativesPage = new CreativesPage(page);

        // Step 1: Create Program
        await programPage.navigateToPrograms();
        const programName = await programPage.createProgram();
        console.log(programName);

        await expect(programPage.successAlert).toBeVisible();
        await expect(programPage.successAlert).toContainText('Program Created');

        // Step 2: Navigate to Creatives
        await creativesPage.navigateToCreatives(programPage);

        // Step 3: Create Banner
        await creativesPage.createBanner(
            programName,
            'fixtures/attachmentFiles/testFile.png'
        );

        // Step 4: Assertions
        await expect(creativesPage.successAlert).toContainText(
            'Banner successfully created. Please note that data is pushed hourly, Monday through Sunday.'
        );
        await expect(creativesPage.successAlert).toBeVisible();

        await expect(creativesPage.getBannerListing(programName)).toBeVisible();
    });
});
