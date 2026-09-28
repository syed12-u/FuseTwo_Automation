import { expect, test } from "@playwright/test";
import ReconcileSalesPage from "../../pages/ReconcileSalesPage";
import { AUTH_FILE } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Accounting → Reconcile Sales through the UI: summary tiles, the Sales
 * Details dialog for a publisher, every per-sale field, and a sale-amount
 * adjustment that is saved, reflected in the row, then reverted. @write on
 * the adjustment test only; the amount is restored in the same test.
 */
const money = /^-?\$[\d,]+(\.\d{2})?$/;
const date = /^\d{2}-\d{2}-\d{4}$/;
const toNumber = (s: string) => Number(s.replace(/[$,]/g, ""));

test.describe("Reconcile Sales - details and adjustments", () => {
  test.use({ storageState: AUTH_FILE });
  test.setTimeout(4 * 60 * 1000);

  test("summary tiles and the publisher table render @blocker", async ({ page }) => {
    const reconcile = new ReconcileSalesPage(page);
    await reconcile.navigateToReconcileSales();
    await dismissPaymentReminderIfPresent(page);

    const tiles = await reconcile.summaryTiles();
    for (const label of ["PUBLISHERS", "SALES", "SALES VOLUME", "COMMISSION", "NETWORK FEE", "TOTAL"]) {
      expect(tiles[label], `tile "${label}" missing`).toMatch(/^[$]?[\d,]+(\.\d{2})?$/);
    }
    for (const header of ["Program Name", "Publisher ID", "Publisher Name", "Sales Volume", "Total Commission", "Network Fee", "Total"]) {
      await expect(page.getByRole("columnheader", { name: header }).first()).toBeVisible();
    }
    expect(await reconcile.publisherRows().count()).toBeGreaterThan(0);
  });

  test("Sales Details shows publisher, program, dates, click id and money fields @blocker", async ({
    page,
  }) => {
    const reconcile = new ReconcileSalesPage(page);
    await reconcile.navigateToReconcileSales();
    await dismissPaymentReminderIfPresent(page);

    const { dialog, record } = await reconcile.findPendingSale();
    await expect(dialog).toContainText(/Publisher ID\s*\d+/);
    await expect(dialog).toContainText(/Publisher Name/);
    for (const header of ReconcileSalesPage.SALE_COLUMNS) {
      await expect(dialog.locator("th", { hasText: header }).first(), `column "${header}"`).toBeVisible();
    }
    console.log("sale:", JSON.stringify(record));
    expect(record["Sales ID"]).toMatch(/^\d+$/);
    expect(record["Order Number"]).not.toBe("");
    expect(record["Program"]).not.toBe("");
    expect(record["Event date"]).toMatch(date);
    expect(record["Post Date"]).toMatch(date);
    expect(record["Locking Date"]).toMatch(date);
    expect(record["Click ID"]).toMatch(/^\d+$/);
    for (const col of ["Sale Amount", "Commission", "Total Commissions", "Network Fee", "Total"]) {
      expect(record[col], col).toMatch(money);
    }
    expect(record["Status"]).toBe("Pending");
  });

  test("a sale-amount adjustment saves, updates the row and can be reverted @write @crud", async ({
    page,
  }) => {
    const reconcile = new ReconcileSalesPage(page);
    await reconcile.navigateToReconcileSales();
    await dismissPaymentReminderIfPresent(page);

    let { dialog, sale, record: before } = await reconcile.findPendingSale();
    const saleId = before["Sales ID"];
    const original = toNumber(before["Sale Amount"]);
    const adjusted = Math.round((original + 1) * 100) / 100;
    console.log(`sale ${saleId} (${before["Program"]}): ${original} -> ${adjusted}`);

    const reopen = async () => {
      await reconcile.navigateToReconcileSales();
      await dismissPaymentReminderIfPresent(page);
      const row = reconcile.publisherRows().filter({ hasText: before["Program"] }).first();
      dialog = await reconcile.openSalesDetails(row);
      sale = reconcile.saleRowById(dialog, saleId).first();
      await expect(sale).toBeVisible({ timeout: 30_000 });
    };

    try {
      await reconcile.adjustSaleAmount(sale, adjusted, "Incorrect amount");
      await reopen();
      const after = await reconcile.readSale(dialog, sale);
      expect(toNumber(after["Sale Amount"])).toBe(adjusted);
      for (const col of ["Total Commissions", "Network Fee", "Total"]) {
        expect(after[col], col).toMatch(money);
      }
    } finally {
      // Restore the original amount so the account's figures are unchanged.
      await reopen();
      await reconcile.adjustSaleAmount(sale, original, "Revert QA adjustment");
      await reopen();
      const restored = await reconcile.readSale(dialog, sale);
      expect(toNumber(restored["Sale Amount"])).toBe(original);
    }
  });
});
