import { test, expect } from '@playwright/test';
import MessageCenterPage from '../../pages/MessageCenterPage';
import ControlLoginPage from '../../pages/ControlLoginPage';
import PendingEmailsPage from '../../pages/PendingEmailsPage';
import { navigateToHome } from '../../utility/navigationUtils';
import { CONTROL_SITE_URL, CONTROL_ADVERTISER_NAME } from '../../fixtures/testConstants';

test.describe('Message Center Flow', () => {
    test.use({ storageState: 'playwright/.auth/authentication.json' });

    test('Verify user can create, send, and approve a message', async ({ page }) => {

        const messageCenterPage = new MessageCenterPage(page);
        const messageSubject = messageCenterPage.generateMessageSubject();

        await test.step('Part 1: Send message to publisher', async () => {
            await navigateToHome(page);

            // Navigate to Message Center
            await messageCenterPage.navigateToMessageCenter();

            // Dynamically select a program with publishers
            const publisherCount = await messageCenterPage.selectPublishersFromAddressBook();

            // Compose message and save as draft
            await messageCenterPage.composeMessage(messageSubject);
            await messageCenterPage.saveDraft();

            // Verify message appears in Drafts
            await messageCenterPage.goToDrafts();
            await expect(messageCenterPage.getMessageBySubject(messageSubject)).toBeVisible();

            // Open draft and send
            await messageCenterPage.openMessage(messageSubject);
            await messageCenterPage.sendMessage();

            // Verify message appears in Sent
            await messageCenterPage.goToSent();
            await expect(messageCenterPage.getMessageBySubject(messageSubject)).toBeVisible();

            // Verify sent message details
            await messageCenterPage.openMessage(messageSubject);
            await messageCenterPage.viewPublisherDetails(publisherCount);
            await expect(messageCenterPage.getMessageBySubject(messageSubject).nth(1)).toBeVisible();
        });

        await test.step('Part 2: Approve message on Control site', async () => {
            // Navigate to control site and login
            await page.goto(CONTROL_SITE_URL);
            const controlLoginPage = new ControlLoginPage(page);
            await controlLoginPage.login();

            // Navigate to Pending Emails and approve the sent message
            const pendingEmailsPage = new PendingEmailsPage(page);
            await pendingEmailsPage.navigateToPendingEmails();
            await pendingEmailsPage.selectPendingEmailsByAdvertiser(CONTROL_ADVERTISER_NAME);
            await pendingEmailsPage.approveSelected();
        });
    });
});
