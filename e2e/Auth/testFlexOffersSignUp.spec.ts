import { test, expect } from '@playwright/test';
import SignUpPage from '../../pages/FlexOffersSignUpPage';
import { SIGNUP_URL } from '../../fixtures/testConstants';

test.describe('Sign Up Flow', () => {
    test('Verify that user can Sign Up', async ({ page }) => {

        const signUp = new SignUpPage(page);

        await page.goto(SIGNUP_URL);

        await signUp.fillUserDetails();
        await signUp.fillCompanyDetails();
        await signUp.submitForm();

        // Assertion
        await expect(signUp.successMessage).toContainText(
            'Thank you'
        );
    });
});
