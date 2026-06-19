import { Locator, Page } from '@playwright/test';
import BasePage from './BasePage';
import {
  COUPON_DESTINATION_URL,
} from '../fixtures/testConstants';

export default class CouponsOffersPage extends BasePage {
  readonly programsMenuButton: Locator;
  readonly couponsOffersLink: Locator;
  readonly programsFilterDropdown: Locator;
  readonly addCouponButton: Locator;

  readonly programDropdown: Locator;
  readonly destinationUrlInput: Locator;
  readonly textLinkContentInput: Locator;
  readonly descriptionInput: Locator;
  readonly promotionTypeDropdown: Locator;
  readonly couponCodeInput: Locator;

  readonly activeDateInput: Locator;
  readonly activeTimeInput: Locator;
  readonly expireDateInput: Locator;
  readonly expireTimeInput: Locator;
  readonly activeDateNextMonthButton: Locator;
  readonly expireDateNextMonthButton: Locator;
  readonly activeDateDialog: Locator;
  readonly expireDateDialog: Locator;

  readonly nextButton: Locator;
  readonly saveButton: Locator;
  readonly updateButton: Locator;
  readonly disableButton: Locator;
  readonly enableButton: Locator;

  readonly visibleToSelectedPublishersToggle: Locator;
  readonly addPublisherButton: Locator;
  readonly removePublisherButton: Locator;

  readonly alertMessage: Locator;
  readonly activeTab: Locator;
  readonly disabledTab: Locator;
  readonly publisherRequiredMessage: Locator;

  constructor(page: Page) {
    super(page);

    this.programsMenuButton = page.getByRole('button', { name: ' Programs' });
    this.couponsOffersLink = page.getByRole('link', { name: 'Coupons & Offers' });
    this.programsFilterDropdown = page.getByRole('combobox', { name: 'Programs' });
    this.addCouponButton = page.getByRole('button', { name: 'Add Coupon or Offer' });

    this.programDropdown = page.getByRole('combobox', { name: 'Program *' });
    this.destinationUrlInput = page.getByRole('textbox', { name: 'Destination URL *' });
    this.textLinkContentInput = page.locator('textarea[name="text"]');
    this.descriptionInput = page.locator('textarea[name="couponDescription"]');
    this.promotionTypeDropdown = page.getByRole('combobox', { name: 'Promotion Type *' });
    this.couponCodeInput = page.getByRole('textbox', { name: 'Coupon Code *' });

    this.activeDateInput = page.getByRole('textbox', { name: 'Active Date *' });
    this.activeTimeInput = page.locator('input[name="activeTime"]');
    this.expireDateInput = page.getByRole('textbox', { name: 'Expire Date *' });
    this.expireTimeInput = page.locator('input[name="expiryTime"]');
    this.activeDateDialog = page.getByRole('dialog', { name: 'Active Date *' });
    this.expireDateDialog = page.getByRole('dialog', { name: 'Expire Date *' });
    this.activeDateNextMonthButton = this.activeDateDialog.getByLabel('Next month');
    this.expireDateNextMonthButton = this.expireDateDialog.getByLabel('Next month');

    this.nextButton = page. getByRole('button', { name: 'Next', exact: true });
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.updateButton = page.getByRole('button', { name: 'Update' });
    this.disableButton = page.getByRole('button', { name: 'Disable' });
    this.enableButton = page.getByRole('button', { name: 'Enable' });

    this.visibleToSelectedPublishersToggle = page.getByText('Visible to selected publishers');
    this.addPublisherButton = page.getByRole('button', { name: 'Add Publisher' });
    this.removePublisherButton = page.getByRole('button', { name: 'delete' });

    this.alertMessage = page.getByRole('alert');
    this.activeTab = page.getByRole('tab', { name: 'Active' });
    this.disabledTab = page.getByRole('tab', { name: 'Disabled' });
    this.publisherRequiredMessage = page.getByText('Please select publisher.');
  }

  async openCouponsAndOffers() {
    await this.programsMenuButton.click();
    await this.couponsOffersLink.click();
  }

  async filterByProgram(programName: string) {
    await this.programsFilterDropdown.first().click();
    await this.page.getByRole('option', { name: programName }).click();
  }

  async startAddCoupon() {
    await this.addCouponButton.click();
  }

  async selectProgram(programName: string) {
    await this.programDropdown.click();
    await this.page.getByRole('option', { name: programName }).click();
  }

  async fillCouponDetails(options: {
    destinationUrl: string;
    title: string;
    description: string;
    couponCode: string;
  }) {
    await this.destinationUrlInput.fill(options.destinationUrl);
    await this.textLinkContentInput.fill(options.title);
    await this.descriptionInput.fill(options.description);
    await this.promotionTypeDropdown.click();
    await this.page.getByRole('option', { name: 'Coupon' }).click();
    await this.couponCodeInput.fill(options.couponCode);
    await this.destinationUrlInput.fill(options.destinationUrl);
  }

  async clickAndRefillDestinationURL(destinationUrl: string) {
    await this.destinationUrlInput.click();
    await this.destinationUrlInput.fill(destinationUrl);
  }

  async setCouponCode(couponCode: string) {
    await this.couponCodeInput.fill(couponCode);
  }

  async selectActiveDate(dayOfMonth: string) {
    await this.fillDateInput(this.activeDateInput, this.getNextMonthDate(dayOfMonth));
    await this.fillTimeInput(this.activeTimeInput, '12:00 AM');
  }

  async selectExpireDate(dayOfMonth: string) {
    await this.fillDateInput(this.expireDateInput, this.getNextMonthDate(dayOfMonth));
    await this.fillTimeInput(this.expireTimeInput, '11:59 PM');
  }

  private async fillDateInput(input: Locator, value: string) {
    await input.click();
    await input.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await input.fill(value);
    await input.press('Tab');
  }

  private async fillTimeInput(input: Locator, value: string) {
    await input.click();
    await this.page.getByRole('button', { name: 'OK' }).click();
  }

  private async pickDateForNextMonth(
    input: Locator,
    dialog: Locator,
    nextMonthButton: Locator,
    dayOfMonth: string,
  ) {
    await input.click();
    await dialog.waitFor({ state: 'visible' });

    const targetMonthLabel = this.getNextMonthLabel();
    const monthLabel = dialog.locator('.MuiPickersCalendarHeader-label').first();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const labelText = (await monthLabel.textContent())?.trim() ?? '';
      if (labelText === targetMonthLabel) {
        break;
      }
      await nextMonthButton.click();
      await this.page.waitForTimeout(150);
    }

    const escapedDay = dayOfMonth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dayRegex = new RegExp(`^${escapedDay}$`);
    const dayButton = dialog.locator('button[role="gridcell"]:not([disabled])', {
      hasText: dayRegex,
    });

    await dayButton.first().waitFor({ state: 'visible' });
    await dayButton.first().click();
  }

  private getNextMonthDate(dayOfMonth: string): string {
    const today = new Date();
    const year = today.getFullYear();
    const monthIndex = today.getMonth() + 1;
    const day = Number(dayOfMonth);
    const target = new Date(year, monthIndex, day);
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const dayString = String(target.getDate()).padStart(2, '0');
    return `${month}/${dayString}/${target.getFullYear()}`;
  }

  private getNextMonthLabel(): string {
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(target);
  }

  async goNext() {
    await this.nextButton.click();
  }

  async saveCoupon() {
    await this.saveButton.click();
  }

  async updateCoupon() {
    await this.updateButton.click();
  }

  async markVisibleToSelectedPublishers() {
    await this.visibleToSelectedPublishersToggle.click();
  }

  async addPublisher() {
    await this.addPublisherButton.click();
  }

  async removePublisher() {
    await this.removePublisherButton.click();
  }

  async disableCoupon() {
    await this.disableButton.click();
  }

  async enableCoupon() {
    await this.enableButton.click();
  }

  async openActiveTab() {
    await this.activeTab.first().click();
  }

  async openDisabledTab() {
    await this.disabledTab.click();
  }

  getCouponCard(title: string): Locator {
    return this.page
      .locator('div.col-12.col-sm-6.col-lg-4')
      .filter({ has: this.page.locator(`div[aria-label="${title}"]`) });
  }

  getCouponTitle(title: string): Locator {
    return this.page.locator(`div[aria-label="${title}"]`);
  }

  async openEditForCoupon(title: string) {
    await this.getCouponCard(title).getByRole('button', { name: 'Edit' }).click();
    await this.clickAndRefillDestinationURL(COUPON_DESTINATION_URL);
  }
}
