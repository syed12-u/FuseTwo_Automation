import { expect, test } from "@playwright/test";
import ReconcileSalesPage, { ReconcileStatus } from "../../pages/ReconcileSalesPage";
import { AUTH_FILE } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * The reconciliation API, driven the way an integrator does it from Postman:
 * read the endpoint, Bearer token and Advertiser Tracking ID from the "API
 * Reconcile" drawer, POST a status change plus a sale adjustment from outside
 * the browser session, check the response contract, then confirm status,
 * amount and recalculated money columns in Reconcile Sales and revert both.
 * @write on the adjustment test only.
 */
const toNumber = (s: string) => Number(s.replace(/[$,]/g, ""));
const round2 = (n: number) => Math.round(n * 100) / 100;

// Status values as the drawer documents them. Hold is the only documented
// status that leaves the sale editable, so it can be put back to Pending.
const HOLD_STATUS: ReconcileStatus = "Hold";
const PENDING_STATUS: ReconcileStatus = "Pending";
const DOCUMENTED_STATUSES: ReconcileStatus[] = ["Approved", "Denied", "Hold", "DeniedTest", "Pending"];

/**
 * The Sales Details money columns hang together (observed on staging: sale
 * $5.00, commission $1.00, adjustments $2.00, total commissions $3.00, network
 * fee $0.30, total $3.30):
 *   Total Commissions = Commission + Adjustments
 *   Network Fee       = fee rate × Total Commissions (rate taken from `before`)
 *   Total             = Total Commissions + Network Fee
 * Commission is either flat or a percentage of the sale; after the amount
 * changes it must be one of those two values, never something unrelated.
 */
function expectMoneyRecalculated(
  before: Record<string, string>,
  after: Record<string, string>,
  newAmount: number,
) {
  const money = /^-?\$[\d,]+(\.\d{2})?$/;
  for (const col of ["Commission", "Adjustments", "Total Commissions", "Network Fee", "Total"]) {
    expect(after[col], col).toMatch(money);
  }
  const commission = toNumber(after["Commission"]);
  const adjustments = toNumber(after["Adjustments"]);
  const totalCommissions = toNumber(after["Total Commissions"]);
  const networkFee = toNumber(after["Network Fee"]);
  const total = toNumber(after["Total"]);

  const commissionRate = toNumber(before["Commission"]) / toNumber(before["Sale Amount"]);
  const feeRate = toNumber(before["Total Commissions"])
    ? toNumber(before["Network Fee"]) / toNumber(before["Total Commissions"])
    : 0;
  console.log(`money after: commission ${commission} adjustments ${adjustments} totalCommissions ${totalCommissions} fee ${networkFee} total ${total}`);

  expect([toNumber(before["Commission"]), round2(newAmount * commissionRate)], "Commission").toContain(commission);
  expect(totalCommissions, "Total Commissions = Commission + Adjustments").toBeCloseTo(commission + adjustments, 2);
  expect(networkFee, "Network Fee = fee rate × Total Commissions").toBeCloseTo(round2(totalCommissions * feeRate), 2);
  expect(total, "Total = Total Commissions + Network Fee").toBeCloseTo(totalCommissions + networkFee, 2);
}

test.describe("Reconcile Sales - API reconciliation", () => {
  test.use({ storageState: AUTH_FILE });
  test.setTimeout(4 * 60 * 1000);

  test("API Reconcile drawer documents endpoint, Bearer auth, body and response codes @blocker", async ({
    page,
  }) => {
    const reconcile = new ReconcileSalesPage(page);
    await reconcile.navigateToReconcileSales();
    await dismissPaymentReminderIfPresent(page);
    await reconcile.openApiReconcileDrawer();

    const body = page.locator("body");
    await expect(body).toContainText("Endpoint (POST)");
    await expect(body).toContainText("Key: Authorization, Type: Bearer");
    expect(await reconcile.readApiToken()).toMatch(/^eyJ/);
    for (const field of ["AdvertiserTrackingId", "OrderNumber", "StatusToUpdate", "StatusToUpdateReason", "SaleAdjustmentModel", "CommissionAdjustmentModel"]) {
      await expect(page.getByRole("cell", { name: field, exact: true })).toBeVisible();
    }
    await expect(body).toContainText(/Approved, Denied, Hold, DeniedTest, or Pending/);
    // The status list the adjustment test sends from is exactly what is documented.
    expect(await reconcile.documentedStatuses()).toEqual(DOCUMENTED_STATUSES);
    for (const code of ["200", "204", "400", "401", "403", "404", "500"]) {
      await expect(page.getByRole("cell", { name: code, exact: true })).toBeVisible();
    }
    await expect(body).toContainText("SaleAdjustmentAmount");
    await expect(body).toContainText("OldSaleAdjustmentAmount");
  });

  // The drawer documents 401 for a missing key; the endpoint actually answers
  // 400 to an unauthenticated request with an unknown tracking id (validation
  // runs first). Either way it must not process anything.
  test("a request without a token is rejected", async ({ page }) => {
    const reconcile = new ReconcileSalesPage(page);
    await reconcile.navigateToReconcileSales();
    const { status, body } = await reconcile.uploadReconciledSales(
      [{ AdvertiserTrackingId: "00000000-0000-0000-0000-000000000000", OrderNumber: "QA-NOAUTH" }],
      null,
    );
    console.log(`no token: HTTP ${status} ${JSON.stringify(body).slice(0, 200)}`);
    expect([400, 401, 403]).toContain(status);
    expect(body?.result?.type).not.toBe("success");
  });

  // Found 2026-09-24 on staging: the Bearer token the API Reconcile drawer
  // displays is rejected by the endpoint it documents — 401 "IDX10214:
  // Audience validation failed" (the JWT carries iss/aud
  // https://www.flexoffers.com). An integrator following the drawer cannot
  // reconcile. Not yet reported.
  test("POST UploadReconciledSales sets status and sale amount, recalculated in the UI, then reverts @write @crud @known-bug", async ({
    page,
  }) => {
    const reconcile = new ReconcileSalesPage(page);
    await reconcile.navigateToReconcileSales();
    await dismissPaymentReminderIfPresent(page);

    // Pick a Pending sale and note its program, order number and amount.
    const found = await reconcile.findPendingSale();
    const sale = found.record;
    await reconcile.closeSalesDetails(found.dialog);
    const original = toNumber(sale["Sale Amount"]);
    const adjusted = Math.round((original + 2) * 100) / 100;
    console.log(`sale ${sale["Sales ID"]} (${sale["Order Number"]}): ${original} -> ${adjusted}`);

    // Token, documented status list and tracking id straight from the drawer,
    // as in Postman. The status sent is one the drawer itself lists.
    await reconcile.openApiReconcileDrawer();
    const token = await reconcile.readApiToken();
    const statuses = await reconcile.documentedStatuses();
    console.log(`documented StatusToUpdate values: ${statuses.join(", ")}`);
    expect(statuses).toEqual(expect.arrayContaining([HOLD_STATUS, PENDING_STATUS]));
    const trackingId = await reconcile.lookupTrackingId(sale["Program"]);
    await page.keyboard.press("Escape");

    const post = (
      change: { amount: number; oldAmount: number; reason: string; status: ReconcileStatus; statusReason: string },
      auth: string | null = token,
    ) =>
      reconcile.uploadReconciledSales(
        [{
          AdvertiserTrackingId: trackingId,
          OrderNumber: sale["Order Number"],
          StatusToUpdate: change.status,
          StatusToUpdateReason: change.statusReason,
          SaleAdjustmentModel: {
            SaleAdjustmentAmount: change.amount,
            SaleAdjustmentReason: change.reason,
            OldSaleAdjustmentAmount: change.oldAmount,
          },
        }],
        auth,
      );
    const holdAndAdjust = { amount: adjusted, oldAmount: original, reason: "Incorrect amount", status: HOLD_STATUS, statusReason: "QA hold via API" };
    const revertAll = { amount: original, oldAmount: adjusted, reason: "Revert QA adjustment", status: PENDING_STATUS, statusReason: "Revert QA hold" };

    const readSale = async () => {
      await reconcile.navigateToReconcileSales();
      await dismissPaymentReminderIfPresent(page);
      const row = reconcile.publisherRows().filter({ hasText: sale["Program"] }).first();
      const dialog = await reconcile.openSalesDetails(row);
      const saleRow = reconcile.saleRowById(dialog, sale["Sales ID"]).first();
      await expect(saleRow).toBeVisible({ timeout: 30_000 });
      const record = await reconcile.readSale(dialog, saleRow);
      await reconcile.closeSalesDetails(dialog);
      return { amount: toNumber(record["Sale Amount"]), status: record["Status"], record };
    };

    let applied = false;
    try {
      // Security: a valid payload without the Bearer token must not be processed.
      const unauthenticated = await post({ ...holdAndAdjust, reason: "QA unauthenticated attempt" }, null);
      console.log(`unauthenticated: HTTP ${unauthenticated.status}`);
      expect(unauthenticated.status, "an unauthenticated adjustment was accepted").not.toBe(200);
      const untouched = await readSale();
      expect(untouched.amount).toBe(original);
      expect(untouched.status).toBe(PENDING_STATUS);

      const response = await post(holdAndAdjust);
      console.log("API response:", JSON.stringify(response.body).slice(0, 400));
      applied = response.status === 200;
      expect(response.status, `UploadReconciledSales rejected the drawer's own token: ${JSON.stringify(response.body).slice(0, 200)}`).toBe(200);
      expect(response.body?.result?.type).toBe("success");
      const record = response.body?.result?.records?.[0];
      expect(record?.isProcessed).toBe(true);
      expect(record?.orderNumber).toBe(sale["Order Number"]);
      expect(record?.saleAdjustmentAmount).toBe(adjusted);
      expect(record?.message).toMatch(/updated successfully/i);

      // Back in FuseTwo the same sale shows the new status, the new amount and
      // money columns recalculated from it.
      const after = await readSale();
      expect(after.status, "StatusToUpdate was not applied").toBe(HOLD_STATUS);
      expect(after.amount).toBe(adjusted);
      expectMoneyRecalculated(sale, after.record, adjusted);
    } finally {
      // Nothing to put back when the endpoint never accepted the change.
      if (applied) {
        const revert = await post(revertAll);
        expect(revert.status).toBe(200);
        const restored = await readSale();
        expect(restored.amount).toBe(original);
        expect(restored.status).toBe(PENDING_STATUS);
      }
    }
  });
});
