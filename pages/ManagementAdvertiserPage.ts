import { expect, Locator, Page } from "@playwright/test";
import BasePage from "./BasePage";
import { managementUrl } from "../config/environment";
import type { AdvertiserStatus } from "../fixtures/onboardingData";

/**
 * Management portal - advertiser overview, detail and status changes.
 *
 * Authentication is Windows SSO at the transport layer (see
 * ManagementLoginPage), so there is nothing to log in to here.
 */
export default class ManagementAdvertiserPage extends BasePage {
  readonly searchBox: Locator;
  readonly actionsButton: Locator;
  readonly changeStatusMenuItem: Locator;
  readonly statusDialog: Locator;
  readonly statusSelect: Locator;
  readonly statusDialogNotes: Locator;
  readonly statusDialogSubmit: Locator;
  readonly statusDialogClose: Locator;

  // Submitting a status change opens a second dialog offering to e-mail the
  // advertiser a template. Sending is optional - the status is already saved by
  // the time this appears.
  readonly emailDialog: Locator;
  readonly emailTemplateSelect: Locator;
  readonly emailToField: Locator;
  readonly emailSendButton: Locator;
  readonly emailCancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.searchBox = page.getByPlaceholder(/Search by Advertiser ID/i);
    this.actionsButton = page.getByRole("button", { name: /^Actions$/i });
    this.changeStatusMenuItem = page.getByText("Change Status", {
      exact: true,
    });
    this.statusDialog = page.getByText("Change Advertiser Status", {
      exact: true,
    });
    this.statusSelect = page.locator('select[name="status"]');
    this.statusDialogNotes = page.locator("textarea").first();
    this.statusDialogSubmit = page.getByRole("button", {
      name: /^Change Status$/i,
    });
    this.statusDialogClose = page.getByRole("button", { name: /^Close$/i });

    this.emailDialog = page.getByText("Advertiser Email Notification", {
      exact: true,
    });
    this.emailTemplateSelect = page.locator('select[name="template"]');
    this.emailToField = page.locator(
      'input[name="to"], input[name="To"], input[type="email"]',
    );
    this.emailSendButton = page.getByRole("button", { name: /^Send$/i });
    this.emailCancelButton = page.getByRole("button", { name: /^Cancel$/i });
  }

  /**
   * Navigate, retrying on net::ERR_UNEXPECTED.
   *
   * The portal intermittently fails the first navigation of a fresh browser
   * context while the Negotiate/NTLM handshake is in flight. A retry clears it;
   * without this, management specs fail roughly one run in four for a reason
   * that has nothing to do with the application.
   */
  private async gotoWithRetry(url: string, attempts = 3) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await this.page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const transient =
          message.includes("net::ERR_UNEXPECTED") ||
          message.includes("net::ERR_ABORTED");
        if (!transient || attempt === attempts) throw error;
        await this.page.waitForTimeout(3_000);
      }
    }
  }

  async openOverview() {
    await this.gotoWithRetry(managementUrl("/advertiser/overview"));
    await expect(this.searchBox).toBeVisible({ timeout: 60_000 });
  }

  async openAdvertiserById(advertiserId: string | number) {
    // The advertiser detail route is /advertiser/{id}. (The former
    // /advertiser/detail/{id} now silently bounces to /advertiser/overview.)
    await this.gotoWithRetry(managementUrl(`/advertiser/${advertiserId}`));
    await expect(this.actionsButton).toBeVisible({ timeout: 60_000 });
    // Let the detail content and any loading overlay settle before the caller
    // interacts, otherwise a click can be intercepted and hang.
    await this.page.waitForTimeout(3_000);
  }

  /**
   * Find an advertiser from the overview by id or company name and open it.
   * Returns the advertiser id taken from the resulting detail URL.
   */
  async searchAndOpen(term: string): Promise<string> {
    await this.openOverview();
    await this.searchBox.fill(term);
    await this.page.keyboard.press("Enter");

    // Results render as table rows; the id in the first cell links to the
    // advertiser detail route (/advertiser/{id}). Read the id from that link
    // and open the detail directly.
    const detailLink = this.page
      .locator("tbody tr")
      .filter({ hasText: term })
      .locator('a[href^="/advertiser/"]')
      .filter({ hasText: /^\d+$/ })
      .first();

    await expect(
      detailLink,
      `no advertiser matched "${term}" in management search`,
    ).toHaveCount(1, { timeout: 60_000 });

    const href = await detailLink.getAttribute("href");
    const id = href?.match(/\/advertiser\/(\d+)/)?.[1];
    if (!id) {
      throw new Error(
        `Could not read an advertiser id from the search result href: ${href}`,
      );
    }

    await this.openAdvertiserById(id);
    return id;
  }

  currentAdvertiserId(): string {
    const match = this.page.url().match(/\/advertiser\/(\d+)/);
    if (!match) {
      throw new Error(`Not on an advertiser detail page: ${this.page.url()}`);
    }
    return match[1];
  }

  /**
   * Search for an advertiser and open it, retrying while it is still being
   * indexed. A freshly registered advertiser is not searchable in management
   * for a minute or two after signup, so a single search can miss it.
   */
  async searchAndOpenWithRetry(
    term: string,
    timeoutMs = 180_000,
  ): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    while (Date.now() < deadline) {
      try {
        return await this.searchAndOpen(term);
      } catch (error) {
        lastError = error;
        await this.page.waitForTimeout(15_000); // let indexing catch up
      }
    }
    throw new Error(
      `Advertiser "${term}" never became searchable in management within ` +
        `${timeoutMs / 1000}s (indexing lag). Last error: ${String(
          lastError,
        ).slice(0, 120)}`,
    );
  }

  // --- CRUD on the detail page ---------------------------------------------
  // The detail page's Details tab has two edit dialogs: "Edit Advertiser
  // Information" (Update button) and "Edit Contact Information" (Save button),
  // plus an "Add Note" action.

  private editButton(index: number): Locator {
    return this.page.getByRole("button", { name: /^Edit$/i }).nth(index);
  }

  /** Click a Details-tab Edit button, waiting for it rather than hanging. */
  private async openEditDialog(index: number, title: string) {
    const button = this.editButton(index);
    await expect(
      button,
      `the "${title}" Edit button did not appear`,
    ).toBeVisible({
      timeout: 60_000,
    });
    await button.click({ timeout: 30_000 });
    await expect(this.page.getByText(title, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    // Saved values hydrate into the dialog a moment after it opens.
    await this.page.waitForTimeout(1_500);
  }

  /** Edit company name and/or website, then Update. Returns after the save. */
  async editAdvertiserInfo(fields: { company?: string; website?: string }) {
    await this.openEditDialog(0, "Edit Advertiser Information");
    await expect(
      this.page.getByText("Edit Advertiser Information", { exact: true }),
    ).toBeVisible({ timeout: 30_000 });

    if (fields.company !== undefined) {
      await this.page
        .getByPlaceholder("Enter company name")
        .fill(fields.company);
    }
    if (fields.website !== undefined) {
      await this.page
        .getByPlaceholder("Enter website URL")
        .fill(fields.website);
    }

    await this.page
      .getByRole("button", { name: /^Update$/i })
      .click({ timeout: 30_000 });
    await expect(
      this.page.getByText("Edit Advertiser Information", { exact: true }),
    ).toBeHidden({ timeout: 30_000 });
    await this.page.waitForTimeout(2_000); // let the write settle server-side
  }

  /** Read the website currently saved on the advertiser (via the edit dialog). */
  async readAdvertiserWebsite(): Promise<string> {
    await this.openEditDialog(0, "Edit Advertiser Information");
    const field = this.page.getByPlaceholder("Enter website URL");
    await expect(field).not.toHaveValue("", { timeout: 15_000 });
    const value = await field.inputValue();
    // The Advertiser Information dialog closes with an "✕" icon (no Close /
    // Cancel button), so dismiss it with Escape, which works for either dialog.
    await this.page.keyboard.press("Escape");
    await expect(
      this.page.getByText("Edit Advertiser Information", { exact: true }),
    ).toBeHidden({ timeout: 15_000 });
    return value;
  }

  /** Edit contact fields (city / zip / address), then Save. */
  async editContactInfo(fields: {
    city?: string;
    zip?: string;
    address?: string;
  }) {
    await this.openEditDialog(1, "Edit Contact Information");

    // The contact fields carry no name/id/placeholder (their labels live in a
    // sibling element), but their order is stable. The global search box is
    // always the first visible input, so the dialog fields follow it:
    //   [0] global search  [1] Address  [2] Address 2  [3] City  [4] Zip Code
    const input = (index: number) => this.page.locator("input").nth(index);
    if (fields.address !== undefined) await input(1).fill(fields.address);
    if (fields.city !== undefined) await input(3).fill(fields.city);
    if (fields.zip !== undefined) await input(4).fill(fields.zip);

    await this.page
      .getByRole("button", { name: /^Save$/i })
      .click({ timeout: 30_000 });
    await expect(
      this.page.getByText("Edit Contact Information", { exact: true }),
    ).toBeHidden({ timeout: 30_000 });
    await this.page.waitForTimeout(2_000);
  }

  /** Add an internal note to the advertiser. Returns the note text. */
  async addNote(text: string): Promise<string> {
    await this.page
      .getByRole("button", { name: /Add Note/i })
      .first()
      .click();
    const notesArea = this.page.locator("textarea").first();
    await expect(notesArea).toBeVisible({ timeout: 15_000 });
    await notesArea.fill(text);
    await this.page
      .getByRole("button", { name: /^(Save|Add|Post|Submit)$/i })
      .last()
      .click({ timeout: 30_000 });
    await this.page.waitForTimeout(3_000);
    return text;
  }

  /**
   * The status shown in the "More Details" panel. Read by taking the text that
   * follows the "Status" label, which is how the portal renders it.
   */
  async readStatus(): Promise<string> {
    // The "More Details" panel is populated after the page shell renders, so a
    // straight read right after navigation intermittently returns nothing.
    for (let attempt = 0; attempt < 20; attempt++) {
      const body = await this.page.locator("body").innerText();
      const match = body.match(/\bStatus\b\s*\n\s*([^\n]+)/);
      const status = match ? match[1].trim() : "";
      if (status) return status;
      await this.page.waitForTimeout(1_000);
    }
    return "";
  }

  async openChangeStatusDialog() {
    await this.actionsButton.click();
    await this.changeStatusMenuItem.click();
    await expect(this.statusDialog).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Statuses the portal currently offers, which depend on the present state.
   *
   * The dialog uses a native <select>, so the choices are <option> elements —
   * they are never "visible" to a click and must be chosen with selectOption.
   */
  async availableStatuses(): Promise<string[]> {
    const options = await this.statusSelect.locator("option").allTextContents();
    return options
      .map((text) => text.trim())
      .filter((text) => text && !/^select/i.test(text));
  }

  /**
   * Move the advertiser to a new status and confirm the detail page reflects it.
   * Mutates a real record, so callers must be tagged @write.
   */
  async changeStatus(
    status: AdvertiserStatus,
    notes = "Automated onboarding test",
    email: { action: "send" | "cancel"; template?: string } = {
      action: "cancel",
    },
  ) {
    // The detail panel renders statuses without spaces ("CollectPayment")
    // while the dropdown labels them with spaces ("Collect Payment"), so any
    // comparison between the two has to be normalised.
    const current = await this.readStatus();
    if (ManagementAdvertiserPage.sameStatus(current, status)) {
      return { changed: false, from: current };
    }

    await this.openChangeStatusDialog();

    const offered = await this.availableStatuses();
    if (!offered.includes(status)) {
      throw new Error(
        `Management does not offer "${status}" from the current state. Offered: ${
          offered.join(", ") || "(none)"
        }`,
      );
    }

    await this.statusSelect.selectOption({ label: status });

    if (
      await this.statusDialogNotes
        .isVisible({ timeout: 3_000 })
        .catch(() => false)
    ) {
      await this.statusDialogNotes.fill(notes);
    }

    // Submit stays disabled until the form actually represents a change.
    await expect(
      this.statusDialogSubmit,
      `the Change Status button never enabled for "${status}" (current status "${current}")`,
    ).toBeEnabled({ timeout: 30_000 });

    await this.statusDialogSubmit.click();

    // The status is saved at this point. Submitting then opens the "Advertiser
    // Email Notification" dialog, which offers to e-mail the advertiser a
    // template. Handle it so it does not leak into the next action.
    // isVisible() is an immediate check, so wait for the dialog explicitly -
    // it renders a moment after submit.
    const emailDialogAppeared = await expect(this.emailDialog)
      .toBeVisible({ timeout: 20_000 })
      .then(() => true)
      .catch(() => false);

    let emailedTemplate: string | undefined;
    if (emailDialogAppeared) {
      if (email.action === "send") {
        emailedTemplate = await this.sendStatusEmail(email.template);
      } else {
        await this.emailCancelButton.click().catch(() => undefined);
        await expect(this.emailDialog)
          .toBeHidden({ timeout: 15_000 })
          .catch(() => undefined);
      }
    } else if (await this.statusDialog.isVisible().catch(() => false)) {
      // No e-mail dialog appeared; make sure the status dialog is dismissed.
      await this.statusDialogClose.click().catch(() => undefined);
    }

    return { changed: true, from: current, emailedTemplate };
  }

  /** Templates offered in the "Advertiser Email Notification" dialog. */
  async availableEmailTemplates(): Promise<string[]> {
    await expect(this.emailDialog).toBeVisible({ timeout: 15_000 });
    const options = await this.emailTemplateSelect
      .locator("option")
      .allTextContents();
    return options.map((t) => t.trim()).filter(Boolean);
  }

  /** The address the notification will be sent to (advertiser's e-mail). */
  async emailRecipient(): Promise<string> {
    const direct = await this.emailToField
      .first()
      .inputValue()
      .catch(() => "");
    if (direct) return direct;

    // Fallback: the dialog's only input carrying an e-mail address.
    return this.page.evaluate(() => {
      const input = [...document.querySelectorAll("input")].find((i) =>
        /@/.test((i as HTMLInputElement).value),
      );
      return input ? (input as HTMLInputElement).value : "";
    });
  }

  /**
   * Send the status-change notification e-mail. Picks the given template when
   * supplied (otherwise leaves the default) and returns the template used.
   * Mutates real state and sends real mail, so callers must be tagged @write.
   */
  async sendStatusEmail(template?: string): Promise<string> {
    await expect(this.emailDialog).toBeVisible({ timeout: 15_000 });

    if (template) {
      const offered = await this.availableEmailTemplates();
      if (!offered.includes(template)) {
        throw new Error(
          `Email template "${template}" is not offered. Offered: ${offered.join(
            ", ",
          )}`,
        );
      }
      await this.emailTemplateSelect.selectOption({ label: template });
    }

    const used =
      (
        await this.emailTemplateSelect
          .locator("option:checked")
          .textContent()
          .catch(() => "")
      )?.trim() ||
      template ||
      "";

    await this.emailSendButton.click();

    const closed = await expect(this.emailDialog)
      .toBeHidden({ timeout: 30_000 })
      .then(() => true)
      .catch(() => false);

    if (!closed) {
      // The dialog stayed open — surface any validation text instead of a bare
      // timeout, so a template that will not dispatch is diagnosable.
      const dialogText = await this.page
        .locator("body")
        .innerText()
        .catch(() => "");
      throw new Error(
        `The email dialog did not close after Send (template "${used}"). ` +
          `Visible text: ${dialogText.replace(/\s+/g, " ").slice(0, 300)}`,
      );
    }
    return used;
  }

  /** Compare statuses across the portal's two spellings. */
  static sameStatus(a: string, b: string): boolean {
    const normalise = (value: string) =>
      value.replace(/[\s_-]/g, "").toLowerCase();
    return normalise(a) === normalise(b);
  }
}
