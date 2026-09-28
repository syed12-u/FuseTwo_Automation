import { expect, Locator, Page } from "@playwright/test";
import BasePage from "./BasePage";
import { appUrl, PATHS } from "../config/environment";
import { dismissPaymentReminderIfPresent } from "../utility/appActions";

export type PublisherStatus =
  | "Approved"
  | "Pending"
  | "Deactivated"
  | "Declined"
  | "Pre-Approved";

export const PUBLISHER_TABS: PublisherStatus[] = [
  "Approved",
  "Pending",
  "Deactivated",
  "Declined",
  "Pre-Approved",
];

/** The request that carried a status change, for asserting what was submitted. */
export interface StatusChangeRequest {
  url: string;
  body: string;
}

/**
 * Publishers → Publisher List (/app/publishers/publisherlist).
 *
 * One tab per status; rows are publisher × program applications with a
 * checkbox. Selecting rows enables "Change Status (n)", which opens a dialog
 * with a status autocomplete, a Reason textarea and CLOSE / OK.
 *
 * There is no free-text search box. The table view only offers per-column
 * funnels on Program ID / Program Name / Traffic Source Type / Groups; the
 * publisher search lives in the *card view*, whose "Filters" panel has
 * Publisher ID / Publisher Name / Traffic Source / Program ID inputs plus
 * FILTER / RESET. It filters server-side (get-publishers-paged?PublisherID=…)
 * and the result set stays when switching back to the table view, but a
 * reload clears it. Cards carry the same checkbox as rows, so the Change
 * Status flow works from either view.
 *
 * Staging defect (2026-09-25): once the card view has been opened, the table
 * view comes back with every column except Promotional Methods and Groups
 * switched off (Show/Hide Columns confirms it) and stays that way across
 * reloads in the same browser context, so `rows()`/`identify()` read empty
 * cells. Keep a flow in the card view once it has been there, or start a
 * fresh context. Guarded by a @known-bug test.
 */
export default class PublisherListPage extends BasePage {
  readonly changeStatusButton: Locator;
  readonly dialog: Locator;
  readonly statusField: Locator;
  readonly reasonField: Locator;
  readonly okButton: Locator;
  readonly successAlert: Locator;
  readonly cardViewButton: Locator;
  readonly tableViewButton: Locator;
  readonly publisherIdFilter: Locator;
  readonly publisherNameFilter: Locator;
  readonly filterButton: Locator;
  readonly resetButton: Locator;
  readonly displayedRows: Locator;

  constructor(page: Page) {
    super(page);
    this.changeStatusButton = page.getByRole("button", {
      name: /Change Status/i,
    });
    this.dialog = page
      .locator(".MuiDialog-paper")
      .filter({ hasText: "Change Publisher Status" });
    // MUI Select: the clickable control is the div; the named input is hidden.
    this.statusField = this.dialog.locator("#mui-component-select-statusDialogSelected");
    this.reasonField = this.dialog.locator('textarea[name="statusDialogReason"]');
    this.okButton = this.dialog.getByRole("button", { name: /^OK$/i });
    this.successAlert = page.getByRole("alert");
    this.cardViewButton = page.getByRole("button", { name: /Card view/i });
    this.tableViewButton = page.getByRole("button", { name: /Table view/i });
    // Card-view "Filters" panel. The panel is rendered per breakpoint like
    // the table, so take the first (visible) copy.
    this.publisherIdFilter = page.getByLabel(/^Publisher ID$/i).first();
    this.publisherNameFilter = page.getByLabel(/^Publisher Name$/i).first();
    this.filterButton = page.getByRole("button", { name: /^Filter$/i });
    this.resetButton = page.getByRole("button", { name: /^Reset$/i });
    // MUI pagination caption, e.g. "1-10 of 215".
    this.displayedRows = page.locator(".MuiTablePagination-displayedRows:visible").first();
  }

  async goto() {
    await this.page.goto(appUrl(PATHS.publisherList), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(this.page);
    await expect(this.tab("Approved")).toBeVisible({ timeout: 30_000 });
  }

  tab(status: PublisherStatus): Locator {
    return this.page.getByRole("tab", { name: new RegExp(`^${status}`, "i") });
  }

  async openTab(status: PublisherStatus) {
    await this.tab(status).click();
    await expect(this.tab(status)).toHaveAttribute("aria-selected", "true");
    await this.page.waitForTimeout(1_500);
  }

  /**
   * Count shown in a tab label, e.g. "PENDING (3)" → 3. The labels render
   * "(0)" until the counts load, so wait for them to settle: the Approved tab
   * is never empty on the test account, so a zero there means "still loading".
   */
  async tabCount(status: PublisherStatus): Promise<number> {
    const parse = (text: string) => Number(text.match(/\((\d+)\)/)?.[1] ?? NaN);
    await expect
      .poll(async () => parse(await this.tab("Approved").innerText()), {
        timeout: 30_000,
        message: "publisher tab counts never loaded",
      })
      .toBeGreaterThan(0);
    return parse(await this.tab(status).innerText());
  }

  /**
   * Visible data rows. The listing renders several copies of the table for
   * different breakpoints (the headers repeat too), so a plain "tbody tr"
   * also matches hidden duplicates whose checkboxes can never be clicked.
   */
  rows(): Locator {
    return this.page.locator("tbody tr:visible");
  }

  /** A row identified by publisher id and program id (both cells are plain text). */
  applicationRow(publisherId: string, programId: string): Locator {
    return this.rows()
      .filter({ hasText: publisherId })
      .filter({ hasText: programId });
  }

  /** Read publisher id and program id from a row (cells 2 and 6). */
  async identify(row: Locator): Promise<{ publisherId: string; programId: string; publisher: string }> {
    const cells = await row.locator("td").allInnerTexts();
    return {
      publisherId: cells[1].trim(),
      publisher: cells[2].trim(),
      programId: cells[5].trim(),
    };
  }

  // --- Card view / publisher search -----------------------------------------

  async openCardView() {
    await this.cardViewButton.click();
    await expect(this.publisherIdFilter).toBeVisible({ timeout: 15_000 });
  }

  async openTableView() {
    await this.tableViewButton.click();
    await expect(this.page.locator("table:visible").first()).toBeVisible({ timeout: 15_000 });
    await expect(this.publisherIdFilter).toBeHidden();
  }

  /** Header labels of the columns currently shown in the table view. */
  async visibleColumns(): Promise<string[]> {
    const headers = await this.page.locator("thead th:visible").allInnerTexts();
    return headers.map((h) => h.trim()).filter(Boolean);
  }

  /**
   * Search the current tab by publisher id and/or name through the card-view
   * filters, and wait for the filtered page to load. The API echoes each
   * filter as a query parameter, which is what the wait keys on.
   */
  async search(filter: { publisherId?: string; publisherName?: string }) {
    await this.openCardView();
    if (filter.publisherId !== undefined) {
      await this.publisherIdFilter.fill(filter.publisherId);
    }
    if (filter.publisherName !== undefined) {
      await this.publisherNameFilter.fill(filter.publisherName);
    }
    const params = [
      filter.publisherId !== undefined ? `PublisherID=${filter.publisherId}` : "",
      filter.publisherName !== undefined ? "PublisherName=" : "",
    ].filter(Boolean);
    const loaded = this.page.waitForResponse(
      (response) =>
        response.url().includes("get-publishers-paged") &&
        params.every((p) => response.url().includes(p)),
      { timeout: 30_000 },
    );
    await this.filterButton.click();
    await loaded;
    await this.page.waitForTimeout(1_000);
  }

  /** Clear the card-view filters and reload the unfiltered tab. */
  async resetSearch() {
    const loaded = this.page.waitForResponse(
      (response) =>
        response.url().includes("get-publishers-paged") &&
        !/Publisher(ID|Name)=/.test(response.url()),
      { timeout: 30_000 },
    );
    await this.resetButton.click();
    await loaded;
    await this.page.waitForTimeout(1_000);
  }

  /** Total rows in the current result set, from the pagination caption. */
  async resultCount(): Promise<number> {
    await expect(this.displayedRows).toHaveText(/of \d+/, { timeout: 30_000 });
    return Number((await this.displayedRows.innerText()).match(/of (\d+)/)?.[1]);
  }

  /**
   * Publisher-id headings of the cards on screen (one per application). The
   * "Filters" title shares the heading style, so keep the numeric ones only.
   */
  cardIds(): Locator {
    return this.page
      .locator("h6.MuiTypography-subtitle2:visible")
      .filter({ hasText: /^\d+$/ });
  }

  /** The card for one application: its publisher id heading, up to the card paper. */
  card(publisherId: string, programId: string): Locator {
    return this.page
      .locator("h6.MuiTypography-subtitle2:visible")
      .filter({ hasText: new RegExp(`^${publisherId}$`) })
      .locator('xpath=ancestor::div[contains(@class,"MuiPaper-root")][1]')
      .filter({ hasText: programId });
  }

  // --- Change status ----------------------------------------------------------

  /** Tick a row (table view) or a card (card view). */
  async select(row: Locator) {
    await row.getByRole("checkbox").first().check();
    await expect(this.changeStatusButton).toContainText(/\(\d+\)/);
  }

  /**
   * Change the status of the selected rows and wait for the confirmation.
   * Returns the request that carried the reason, when one was seen, so a
   * test can prove the reason left the browser — the listing itself never
   * shows it back (no column, tooltip or detail view carries it).
   */
  async changeStatus(status: PublisherStatus, reason: string): Promise<StatusChangeRequest | undefined> {
    await this.changeStatusButton.click();
    await expect(this.dialog).toBeVisible({ timeout: 15_000 });
    await this.statusField.click();
    await this.page.getByRole("option", { name: status, exact: true }).click();
    await expect(this.statusField).toHaveText(status);
    await this.reasonField.fill(reason);
    const submitted = this.page
      .waitForRequest(
        (request) =>
          request.method() !== "GET" &&
          ((request.postData() ?? "").includes(reason) ||
            decodeURIComponent(request.url()).includes(reason)),
        { timeout: 30_000 },
      )
      .catch(() => undefined);
    await this.okButton.click();
    await expect(this.successAlert).toContainText(/updated successfully/i, {
      timeout: 30_000,
    });
    await expect(this.dialog).toBeHidden({ timeout: 15_000 });
    const request = await submitted;
    return request ? { url: request.url(), body: request.postData() ?? "" } : undefined;
  }
}
