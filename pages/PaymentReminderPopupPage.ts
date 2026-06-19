import { Page, Locator } from '@playwright/test';
import BasePage from './BasePage';

export default class PaymentReminderPopup extends BasePage {
    readonly remindMeLaterButton: Locator;
   
    constructor(page: Page) {
        super(page);
        this.remindMeLaterButton = page.getByRole('button', { name: 'Remind me later' });
    }

    async closePaymentReminderPopup(){
        await this.remindMeLaterButton.click();
    }
}