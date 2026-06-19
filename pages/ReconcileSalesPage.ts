import { expect, Locator, Page } from "@playwright/test";
import BasePage from "./BasePage";

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
    await this.page.goto(
      "https://advertiser.dev.fusetwo.com/app/accounting/reconcile",
      {
        waitUntil: "networkidle",
      },
    );
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
