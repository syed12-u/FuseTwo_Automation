import { expect, Locator, Page } from '@playwright/test';
import BasePage from './BasePage';
import { appUrl, PATHS } from '../config/environment';
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
  /**
   * "Automatic Renewals → Set to Auto-Renew" is a custom pill (not a checkbox
   * or switch): a div reading "No" or "Yes" that flips when clicked.
   */
  readonly autoRenewToggle: Locator;

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

    this.programsMenuButton = page.getByRole('button', { name: ' Programs' });
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
    this.autoRenewToggle = page
      .getByText('Set to Auto-Renew')
      .locator('xpath=..')
      .getByText(/^(Yes|No)$/);

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
    // Navigate directly — the sidebar-menu traversal relied on a " Programs"
    // button label that intermittently fails to expand and hangs the click.
    await this.page.goto(appUrl(PATHS.couponsAndOffers), {
      waitUntil: 'domcontentloaded',
    });
  }

  /**
   * The listing shows one program at a time (it opens on whichever program is
   * first), so a coupon is only findable once its program is selected here.
   */
  async filterByProgram(programName: string) {
    await this.programsFilterDropdown.first().click();
    await this.page.getByRole('option', { name: programName }).click();
    await expect(this.programsFilterDropdown.first()).toHaveValue(programName);
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

  /**
   * Set Active Date to `dayOfMonth` of next month and Active Time to `time`
   * ("hh:mm AM"). Returns the mm/dd/yyyy date that was typed.
   */
  async selectActiveDate(dayOfMonth: string, time = '12:00 AM'): Promise<string> {
    const date = this.getNextMonthDate(dayOfMonth);
    await this.fillDateInput(this.activeDateInput, date);
    await this.fillTimeInput(this.activeTimeInput, time);
    return date;
  }

  /** As selectActiveDate, for Expire Date / Expire Time. */
  async selectExpireDate(dayOfMonth: string, time = '11:59 PM'): Promise<string> {
    const date = this.getNextMonthDate(dayOfMonth);
    await this.fillDateInput(this.expireDateInput, date);
    await this.fillTimeInput(this.expireTimeInput, time);
    return date;
  }

  /** "Yes" or "No", as the Set to Auto-Renew pill reads right now. */
  async autoRenewState(): Promise<string> {
    await expect(this.autoRenewToggle.first()).toBeVisible();
    return (await this.autoRenewToggle.first().innerText()).trim();
  }

  /** Flip Set to Auto-Renew to Yes/No (no-op when already there) and confirm it. */
  async setAutoRenew(enabled: boolean) {
    const wanted = enabled ? 'Yes' : 'No';
    if ((await this.autoRenewState()) !== wanted) {
      await this.autoRenewToggle.first().click();
    }
    await expect(
      this.autoRenewToggle.first(),
      `Set to Auto-Renew did not switch to ${wanted}`,
    ).toHaveText(wanted);
  }

  private async fillDateInput(input: Locator, value: string) {
    await input.click();
    await input.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await input.fill(value);
    await input.press('Tab');
  }

  /**
   * The time fields are read-only MUI TimePickers: clicking one opens a
   * "Select time" dialog with an analog clock that shows the hours view first
   * and switches to minutes once an hour is chosen, plus AM/PM toggles and OK.
   * The clock face is one hit-mask that maps the pointer angle to a value, so a
   * number is chosen by clicking the face at that number's angle. The field's
   * value is asserted afterwards, so a picker that did not take the time fails
   * here rather than at save.
   */
  private async fillTimeInput(input: Locator, value: string) {
    const { hour, minute, ampm, formatted } = parseTime(value);
    // Tabbing out of the date input can leave its calendar open over the field.
    await this.page.keyboard.press('Escape').catch(() => {});
    await input.scrollIntoViewIfNeeded();
    await input.click();

    const dialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /Select time/i })
      .last();
    await expect(dialog, 'time picker did not open').toBeVisible({ timeout: 10_000 });
    await clickClockFace(dialog, 'hours', (hour % 12) * 30);
    await clickClockFace(dialog, 'minutes', minute * 6);
    await dialog.getByRole('button', { name: ampm, exact: true }).click();
    await dialog.getByRole('button', { name: /^OK$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(input, `time field did not take ${formatted}`).toHaveValue(formatted);
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
    await this.addPublisherButton.first().click();
  }

  async removePublisher() {
    await this.removePublisherButton.first().click();
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

  /** Read the saved step-1 values of a coupon from its edit dialog. */
  async readSavedCoupon(title: string): Promise<{
    activeDate: string;
    activeTime: string;
    expireDate: string;
    expireTime: string;
    autoRenew: string;
  }> {
    await this.openEditForCoupon(title);
    await expect(this.textLinkContentInput).toHaveValue(title, { timeout: 30_000 });
    return {
      activeDate: await this.activeDateInput.inputValue(),
      activeTime: await this.activeTimeInput.inputValue(),
      expireDate: await this.expireDateInput.inputValue(),
      expireTime: await this.expireTimeInput.inputValue(),
      autoRenew: await this.autoRenewState(),
    };
  }

  /**
   * Disable a coupon from its edit dialog (Edit → Next → Disable). The only
   * removal the UI offers; a disabled coupon moves to the Disabled tab.
   */
  async disableCouponByTitle(title: string) {
    await this.openEditForCoupon(title);
    await this.goNext();
    await expect(this.disableButton).toBeVisible({ timeout: 30_000 });
    await this.disableCoupon();
    await expect(this.alertMessage).toContainText(/successfully disabled/i, {
      timeout: 30_000,
    });
  }
}

/** Split "h:mm AM" into parts and the zero-padded "hh:mm AM" the field shows. */
function parseTime(value: string): {
  hour: number;
  minute: number;
  ampm: 'AM' | 'PM';
  formatted: string;
} {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (!m) throw new Error(`time "${value}" must look like "hh:mm AM"`);
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 1 || hour > 12 || minute > 59) {
    throw new Error(`time "${value}" is not a valid 12-hour time`);
  }
  const ampm = m[3].toUpperCase() as 'AM' | 'PM';
  return {
    hour,
    minute,
    ampm,
    formatted: `${String(hour).padStart(2, '0')}:${m[2]} ${ampm}`,
  };
}

/**
 * Click the MUI clock face at `degrees` clockwise from 12 o'clock. The numbers
 * sit on a ring at ~42% of the face's width from its centre; the face itself
 * (`.MuiClock-squareMask`) is the only element that takes pointer events and
 * derives the value from the click angle. (Same picker as Add Campaign.)
 */
async function clickClockFace(dialog: Locator, view: 'hours' | 'minutes', degrees: number) {
  // The listbox is labelled "Select hours. …" / "Select minutes. …", which is
  // how the picker announces which view is showing. It has no box of its own
  // (its numbers are absolutely positioned), so check attachment plus a
  // visible number rather than the wrapper's visibility.
  const listbox = dialog.locator(`[role="listbox"][aria-label^="Select ${view}"]`);
  await expect(listbox, `time picker did not show the ${view} view`).toBeAttached({
    timeout: 10_000,
  });
  await expect(listbox.getByRole('option').first()).toBeVisible({ timeout: 10_000 });
  const face = dialog.locator('.MuiClock-squareMask');
  const box = await face.boundingBox();
  if (!box) throw new Error('time picker clock face is not rendered');
  const radius = box.width * 0.42;
  const rad = (degrees * Math.PI) / 180;
  await face.click({
    position: {
      x: box.width / 2 + radius * Math.sin(rad),
      y: box.height / 2 - radius * Math.cos(rad),
    },
  });
}
