import { test, expect } from '@playwright/test';
import ProgramPage from '../../pages/ProgramPage';
import { navigateToHome } from '../../utility/navigationUtils';

test.describe('Program Creation Flow', () => {
    test.use({ storageState: 'playwright/.auth/authentication.json' });
    test('Verify user can create a program', async ({ page }) => {

        await navigateToHome(page);
        const programPage = new ProgramPage(page);

        // Navigate & create program
        await programPage.navigateToPrograms();
        // await page.pause();
        const programName = await programPage.createProgram();
        // await page.pause();

        // Assertion
        await expect(programPage.successAlert).toContainText('Program Created');
        await expect(programPage.successAlert).toBeVisible();

        // Verify in listing
        await programPage.goToProgramsList();
        await expect(programPage.getProgramRow(programName)).toBeVisible();
        await expect(programPage.programTable).toContainText(`${programName}All requirements met`);
    });
});
