import { expect, Locator, Page } from "@playwright/test";
import BasePage from "./BasePage";
import { appUrl, PATHS } from "../config/environment";

export type ReconcileStatus =
  | "Approved"
  | "Denied"
  | "Hold"
  | "DeniedTest"
  | "Pending";

export interface ReconcileItem {
  saleId: number;
  status: ReconcileStatus;
  reason?: string;
}

export interface SaleAdjustment {
  saleId: number;
  saleAdjustmentAmount: number;
  saleAdjustmentReason: string;
  oldSaleAdjustmentAmount: number;
}

export interface CommissionAdjustment {
  saleId: number;
  commissionAdjustmentAmount: number;
  commissionAdjustmentReason: string;
}

export interface UploadedTransaction {
  status: number;
  body: unknown;
}

export interface ApiReconcileItem {
  AdvertiserTrackingId: string;
  OrderNumber: string;
  StatusToUpdate?: ReconcileStatus;
  StatusToUpdateReason?: string;
  SaleAdjustmentModel?: {
    SaleAdjustmentAmount: number;
    SaleAdjustmentReason: string;
    OldSaleAdjustmentAmount: number;
  };
  CommissionAdjustmentModel?: {
    CommissionAdjustmentAmount: number;
    CommissionAdjustmentReason: string;
  };
}

export default class ReconcileSalesPage extends BasePage {
  readonly addNewButton: Locator;
  readonly apiReconcileButton: Locator;
  readonly exportButton: Locator;
  readonly table: Locator;
  readonly saleTypeDropdown: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    super(page);
    this.addNewButton = page.getByRole("button", { name: "ADD NEW" });
    this.apiReconcileButton = page.getByRole("button", {
      name: "API RECONCILE",
    });
    this.exportButton = page.getByRole("button", { name: "EXPORT" });
    this.table = page.locator("table");
    this.saleTypeDropdown = page.locator("#mui-component-select-saleType");
    this.saveButton = page.getByRole("button", { name: /save/i }).last();
  }

  async navigateToReconcileSales() {
    await this.page.goto(appUrl(PATHS.reconcileSales), {
      waitUntil: "networkidle",
    });
    await expect(this.addNewButton).toBeVisible({ timeout: 30000 });
    await expect(this.table).toBeVisible({ timeout: 30000 });
  }

  async getReconciledSales(month = 5, year = 2026) {
    return await this.authenticatedFetch(
      `/api/${await this.getAdvertiserId()}/accounting/GetreconciledSales?month=${month}&year=${year}&programId=undefined&publisherId=undefined`,
    );
  }

  async getClickDetails(clickId: string) {
    return await this.authenticatedFetch(
      `/api/${await this.getAdvertiserId()}/Accounting/GetClickDetails?clickId=${clickId}`,
    );
  }

  async getAdvertiserTracking(programId: number) {
    return await this.authenticatedFetch(
      `/api/${await this.getAdvertiserId()}/trackingpixel/GetAdvertiserTracking?programId=${programId}`,
    );
  }

  async addBonus(
    programName: string,
    publisherName: string,
    amount: string,
    comment: string,
  ) {
    await this.openAddNewDrawer();
    await this.selectAutocompleteField(
      this.page.locator('input[name="programName"]'),
      programName,
    );
    await this.selectAutocompleteField(
      this.page.locator('input[name="publisherName"]'),
      publisherName,
    );
    await this.page.locator('input[name="bonusAmount"]').fill(amount);
    await this.page.locator('textarea[name="comment"]').first().fill(comment);
    await expect(this.saveButton).toBeEnabled({ timeout: 10000 });

    const saveResponse = this.page.waitForResponse(
      (response) =>
        /\/api\/\d+\/accounting\/SaveNewTransaction/i.test(response.url()) &&
        response.request().method() === "POST",
      { timeout: 30000 },
    );
    await this.saveButton.click();
    await expect.poll(async () => (await saveResponse).status()).toBe(200);
  }

  async addTransaction(
    programName: string,
    publisherName: string,
    clickId: string,
    saleAmount: string,
    orderId: string,
    comment: string,
  ) {
    await this.openAddNewDrawer();
    await this.selectAutocompleteField(
      this.page.locator('input[name="programName"]'),
      programName,
    );
    await this.selectAutocompleteField(
      this.page.locator('input[name="publisherName"]'),
      publisherName,
    );
    await this.saleTypeDropdown.click();
    await this.page.getByRole("option", { name: "Transactions" }).click();
    await expect(this.saleTypeDropdown).toHaveText(/Transactions/);

    const clickDetailsResponse = this.page.waitForResponse(
      (response) =>
        response.url().includes("/api/1107069/Accounting/GetClickDetails") &&
        response.status() === 200,
      { timeout: 30000 },
    );
    await this.page.locator('input[name="clickID"]').fill(clickId);
    await this.page.locator('input[name="clickID"]').press("Tab");
    await clickDetailsResponse;

    await this.page.locator('input[name="bonusAmount"]').fill(saleAmount);
    await this.page.locator('input[name="orderID"]').fill(orderId);
    await this.page.locator('input[name="orderID"]').press("Tab");
    await this.page.locator('textarea[name="comment"]').first().fill(comment);
    await expect(this.saveButton).toBeEnabled({ timeout: 15000 });

    const saveResponse = this.page.waitForResponse(
      (response) =>
        /\/api\/\d+\/accounting\/SaveNewTransaction/i.test(response.url()) &&
        response.request().method() === "POST",
      { timeout: 30000 },
    );
    await this.saveButton.click();
    await expect.poll(async () => (await saveResponse).status()).toBe(200);
  }

  async addTransactionViaApi(
    clickId: string,
    saleAmount: string,
    orderId: string,
    comment: string,
  ) {
    const clickDetails = await this.getClickDetails(clickId);
    const { domainId, programId } = clickDetails.result;

    return await this.page.evaluate(
      async ({ requestBody }) => {
        const token = window.localStorage.getItem("user_id");
        const formData = new FormData();

        Object.entries(requestBody).forEach(([key, value]) => {
          formData.append(key, String(value));
        });

        const response = await fetch(
          `/api/${localStorage.getItem("advertiserId")}/accounting/SaveNewTransaction`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );
        const text = await response.text();

        return {
          status: response.status,
          body: text ? JSON.parse(text) : null,
        };
      },
      {
        requestBody: {
          userId: 0,
          domainId,
          clickId,
          programId,
          orderId,
          payIn: saleAmount,
          payOut: saleAmount,
          merchantValue: saleAmount,
          comment,
          salesTypeId: 0,
        },
      },
    );
  }

  async updateSaleAmount(adjustment: SaleAdjustment) {
    return await this.authenticatedPost(
      `/api/${await this.getAdvertiserId()}/Accounting/UpdateSaleAdjustmentAmount`,
      adjustment,
    );
  }

  async updateCommissionAmount(adjustment: CommissionAdjustment) {
    return await this.authenticatedPost(
      `/api/${await this.getAdvertiserId()}/Accounting/UpdateCommisionAdjustmentAmount`,
      adjustment,
    );
  }

  async processReconciliationItems(items: ReconcileItem[]) {
    return await this.authenticatedPost(
      `/api/${await this.getAdvertiserId()}/accounting/ProcessReconciliationItems`,
      {
        ReconciliationItems: items,
      },
    );
  }

  async bulkSubmitReconciliation(month = 5, year = 2026) {
    return await this.authenticatedPost(
      `/api/${await this.getAdvertiserId()}/Accounting/ProcessReconciliationItemsOnSubmit?month=${month}&year=${year}`,
      {},
    );
  }

  async uploadReconciledSalesViaApi(items: ApiReconcileItem[]) {
    return await this.page.evaluate(async (requestBody) => {
      const token = window.localStorage.getItem("apiToken");
      const response = await fetch(
        "/api/SaleReconciliation/UploadReconciledSales",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );
      const text = await response.text();
      return {
        status: response.status,
        body: text ? JSON.parse(text) : null,
      };
    }, items);
  }

  // --- Reconcile Sales UI: summary tiles, Sales Details dialog, adjustments ---

  /** The six KPI tiles above the table, e.g. { "SALES VOLUME": "$1,300.06" }. */
  async summaryTiles(): Promise<Record<string, string>> {
    const text = await this.page.locator("body").innerText();
    const tiles: Record<string, string> = {};
    for (const label of ["PUBLISHERS", "SALES", "SALES VOLUME", "COMMISSION", "NETWORK FEE", "TOTAL"]) {
      const match = text.match(new RegExp(`(?:^|\\n)${label}\\s*\\n\\s*([$\\d,.]+)`));
      if (match) tiles[label] = match[1];
    }
    return tiles;
  }

  /** Publisher rows of the main table (one per publisher × program). */
  publisherRows(): Locator {
    return this.page.locator("tbody tr");
  }

  /** Open the Sales Details dialog for a main-table row (the "view more" icon). */
  async openSalesDetails(row: Locator): Promise<Locator> {
    await row.locator('svg[aria-label="view more"]').click({ force: true });
    const dialog = this.page
      .locator(".MuiDialog-paper")
      .filter({ hasText: "Sales Details" })
      .last();
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog.locator("tbody tr").first()).toBeVisible({ timeout: 30_000 });
    return dialog;
  }

  static readonly SALE_COLUMNS = [
    "Sales ID", "Order Number", "Program", "Event date", "Post Date", "Locking Date",
    "Click ID", "Sale Amount", "Commission", "Adjustments", "Total Commissions",
    "Network Fee", "Total", "Status",
  ] as const;

  /** Read one sale row of the Sales Details dialog into a header-keyed record. */
  async readSale(dialog: Locator, row: Locator): Promise<Record<string, string>> {
    const headers = (await dialog.locator("th").allInnerTexts()).map((h) => h.trim());
    const cells = (await row.locator("td").allInnerTexts()).map((c) => c.trim());
    const record: Record<string, string> = {};
    headers.forEach((h, i) => { if (h) record[h] = cells[i] ?? ""; });
    return record;
  }

  /** Sale rows in the dialog whose Status cell reads Pending. */
  pendingSaleRows(dialog: Locator): Locator {
    return dialog.locator("tbody tr").filter({ hasText: /Pending/ });
  }

  /** The sale row with this Sales ID (second cell) inside an open Sales Details dialog. */
  saleRowById(dialog: Locator, saleId: string): Locator {
    return dialog.locator("tbody tr").filter({
      has: this.page.locator("td:nth-child(2)", { hasText: new RegExp(`^\\s*${saleId}\\s*$`) }),
    });
  }

  /** Close the Sales Details dialog (its "X"; Escape does not always close it). */
  async closeSalesDetails(dialog: Locator) {
    const close = dialog
      .locator("button")
      .filter({ has: this.page.locator('svg[data-testid="CloseIcon"]') })
      .first();
    if (await close.isVisible().catch(() => false)) await close.click();
    else await this.page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  }

  /**
   * Find a Pending sale with a non-zero amount across the publisher rows.
   * Returns the open dialog, the sale row and the parsed record.
   */
  async findPendingSale(): Promise<{ dialog: Locator; sale: Locator; record: Record<string, string> }> {
    const rows = this.publisherRows().filter({ hasText: /\$[1-9][\d,]*\.\d{2}/ });
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const dialog = await this.openSalesDetails(rows.nth(i));
      const pending = this.pendingSaleRows(dialog);
      const n = await pending.count();
      for (let j = 0; j < n; j++) {
        const record = await this.readSale(dialog, pending.nth(j));
        if (Number(record["Sale Amount"].replace(/[$,]/g, "")) > 0) {
          return { dialog, sale: pending.nth(j), record };
        }
      }
      await this.closeSalesDetails(dialog);
    }
    throw new Error("no Pending sale with a non-zero amount this month");
  }

  /**
   * Change a sale's amount through the "Sale Adjustments" dialog (the pencil
   * on the sale row; the "more" pencil is the status menu). Waits for the
   * confirmation toast.
   */
  async adjustSaleAmount(saleRow: Locator, newAmount: number, reason: string) {
    await saleRow
      .locator('button:not([aria-label="more"])')
      .filter({ has: this.page.locator('svg[data-testid="EditIcon"]') })
      .first()
      .click();
    const dialog = this.page
      .locator(".MuiDialog-paper")
      .filter({ hasText: "Sale Adjustments" })
      .last();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Reason is a free-text autocomplete (options: "Incorrect sale amount",
    // "Missing sale amount", "Other"); a typed value is accepted as-is.
    const reasonField = dialog.locator('input[name="reason"]');
    await reasonField.click();
    await reasonField.fill(reason);
    const option = this.page
      .getByRole("option")
      .filter({ hasText: new RegExp(`^${this.escapeRegExp(reason)}$`, "i") })
      .first();
    if (await option.isVisible().catch(() => false)) await option.click();
    await dialog.locator('input[name="saleAmount"]').fill(String(newAmount));

    // Anchor on the save request itself; the toast ("Sale amount updated
    // successfully") is short-lived and easy to miss.
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) => /UpdateSaleAdjustmentAmount/i.test(r.url()) && r.request().method() === "POST",
        { timeout: 30_000 },
      ),
      dialog.getByRole("button", { name: /^Submit$/i }).click(),
    ]);
    expect(response.status(), "UpdateSaleAdjustmentAmount failed").toBe(200);
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  }

  // --- API Reconcile drawer: token, tracking-id lookup, real POST ------------

  private apiDrawer(): Locator {
    return this.page
      .locator(".MuiDialog-paper, .MuiDrawer-paper")
      .filter({ hasText: "API Reconciliation" })
      .last();
  }

  /** The Bearer token the drawer displays under Authentication. */
  async readApiToken(): Promise<string> {
    const text = await this.apiDrawer().innerText();
    const match = text.match(/Bearer\s+(eyJ[\w-]+\.[\w-]+\.[\w-]+)/);
    if (!match) throw new Error("API Reconciliation drawer shows no Bearer token");
    return match[1];
  }

  /**
   * The StatusToUpdate values the drawer documents, read from its own text
   * ("Approved, Denied, Hold, DeniedTest, or Pending") so the API test sends
   * exactly what the documentation offers an integrator.
   */
  async documentedStatuses(): Promise<string[]> {
    const text = await this.apiDrawer().innerText();
    const fromField = text.slice(Math.max(0, text.indexOf("StatusToUpdate")));
    const match = fromField.match(/((?:[A-Z][A-Za-z]*,\s*)+or\s+[A-Z][A-Za-z]*)/);
    if (!match) throw new Error("API Reconciliation drawer lists no StatusToUpdate values");
    return match[1].split(/,\s*(?:or\s+)?/).map((s) => s.trim()).filter(Boolean);
  }

  /** Use the drawer's program lookup to read a program's Advertiser Tracking ID. */
  async lookupTrackingId(programName: string): Promise<string> {
    const drawer = this.apiDrawer();
    const field = drawer.locator('input[name="programName"]');
    // The lookup is an autocomplete whose result loads asynchronously; retry
    // the selection once if the id has not rendered.
    for (let attempt = 0; attempt < 2; attempt++) {
      await field.click();
      await field.fill(programName);
      await this.page.getByRole("option", { name: programName, exact: true }).first().click();
      await expect(field).toHaveValue(programName);
      const shown = await expect(drawer)
        .toContainText(/Advertiser Tracking ID\s*[0-9A-Fa-f-]{36}/, { timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      if (shown) break;
    }
    const text = await drawer.innerText();
    const match = text.match(/Advertiser Tracking ID\s*([0-9A-Fa-f-]{36})/);
    if (!match) throw new Error(`no Advertiser Tracking ID shown for "${programName}"`);
    return match[1];
  }

  /**
   * POST to the public reconciliation endpoint exactly as an integrator
   * (Postman) would: outside the browser session, Bearer token only.
   */
  async uploadReconciledSales(items: ApiReconcileItem[], token: string | null) {
    const response = await this.page.request.post(
      appUrl("/api/SaleReconciliation/UploadReconciledSales"),
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        data: items,
        failOnStatusCode: false,
      },
    );
    const text = await response.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { status: response.status(), body };
  }

  async openApiReconcileDrawer() {
    await this.apiReconcileButton.click();
    await expect(this.page.getByText("API Reconciliation")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      this.page.getByText("/api/SaleReconciliation/UploadReconciledSales"),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(
      this.page.getByRole("cell", {
        name: "AdvertiserTrackingId",
        exact: true,
      }),
    ).toBeVisible({ timeout: 10000 });
  }

  private async openAddNewDrawer() {
    await this.addNewButton.click();
    await expect(
      this.page.getByRole("heading", { name: /Add New/i }),
    ).toBeVisible({ timeout: 10000 });
  }

  private async selectAutocompleteField(input: Locator, optionName: string) {
    await input.click();
    await input.fill(optionName);

    const option = this.page
      .getByRole("option", {
        name: new RegExp(this.escapeRegExp(optionName), "i"),
      })
      .first();
    await expect(option).toBeVisible({ timeout: 10000 });
    await option.click();
    await expect(input).toHaveValue(
      new RegExp(this.escapeRegExp(optionName), "i"),
      { timeout: 5000 },
    );
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private async getAdvertiserId() {
    const advertiserId = await this.page.evaluate(() =>
      window.localStorage.getItem("advertiserId"),
    );
    expect(advertiserId).toBeTruthy();
    return advertiserId;
  }

  private async authenticatedFetch(path: string) {
    return await this.page.evaluate(async (requestPath) => {
      const token = window.localStorage.getItem("user_id");
      const response = await fetch(requestPath, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }, path);
  }

  private async authenticatedPost(path: string, body: unknown) {
    return await this.page.evaluate(
      async ({ requestPath, requestBody }) => {
        const token = window.localStorage.getItem("user_id");
        const response = await fetch(requestPath, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });
        const text = await response.text();
        return {
          status: response.status,
          body: text ? JSON.parse(text) : null,
        };
      },
      { requestPath: path, requestBody: body },
    );
  }
}
