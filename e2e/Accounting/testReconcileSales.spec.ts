import { expect, Page, test } from "@playwright/test";
import ReconcileSalesPage from "../../pages/ReconcileSalesPage";
import { navigateToHome } from "../../utility/navigationUtils";

const PROGRAM_ID = 249231;
const PROGRAM_NAME = "Test4302026";
const PUBLISHER_NAME = "FlexOffers Test Account | Advertiser";
const now = new Date();
const CURRENT_MONTH = now.getMonth() + 1;
const CURRENT_YEAR = now.getFullYear();

interface ReconciledSaleDetail {
  id: number;
  orderNumber: string;
  isAllowAction?: boolean;
}

interface ReconciledPublisher {
  reconciledSalesDetails: ReconciledSaleDetail[];
}

async function openReconcileSales(page: Page) {
  await navigateToHome(page);

  const reconcileSalesPage = new ReconcileSalesPage(page);
  await reconcileSalesPage.navigateToReconcileSales();

  return reconcileSalesPage;
}

async function getCurrentSales(reconcileSalesPage: ReconcileSalesPage) {
  const sales = await reconcileSalesPage.getReconciledSales(
    CURRENT_MONTH,
    CURRENT_YEAR,
  );
  const publishers = sales.result
    .reconciledSalesPublisherWise as ReconciledPublisher[];

  return publishers.flatMap((publisher) => publisher.reconciledSalesDetails);
}

async function getActionableSale(reconcileSalesPage: ReconcileSalesPage) {
  const sales = await getCurrentSales(reconcileSalesPage);
  const sale = sales.find((item) => item.isAllowAction !== false) ?? sales[0];

  expect(sale, "Expected at least one reconciled sale for current month").toBeTruthy();
  return sale;
}

test.describe("Reconcile Sales", () => {
  test.use({ storageState: "playwright/.auth/authentication.json" });

  test("Verify Reconcile Sales page loads current month data", async ({
    page,
  }) => {
    const reconcileSalesPage = await openReconcileSales(page);

    await expect(reconcileSalesPage.addNewButton).toBeVisible();
    await expect(reconcileSalesPage.apiReconcileButton).toBeVisible();

    const sales = await getCurrentSales(reconcileSalesPage);
    expect(sales.length).toBeGreaterThan(0);
  });

  test("Verify user can upload a bonus sale from Add New drawer", async ({
    page,
  }) => {
    const reconcileSalesPage = await openReconcileSales(page);
    const stamp = Date.now().toString().slice(-6);

    await reconcileSalesPage.addBonus(
      PROGRAM_NAME,
      PUBLISHER_NAME,
      "3.21",
      `Automation bonus ${stamp}`,
    );
  });

  test("Verify API Reconcile drawer shows upload contract", async ({ page }) => {
    const reconcileSalesPage = await openReconcileSales(page);

    await reconcileSalesPage.openApiReconcileDrawer();

    const trackingResponse =
      await reconcileSalesPage.getAdvertiserTracking(PROGRAM_ID);
    expect(trackingResponse.result.trackingID).toBeTruthy();
  });

  test("Verify user can process an existing reconciliation item", async ({
    page,
  }) => {
    const reconcileSalesPage = await openReconcileSales(page);
    const sale = await getActionableSale(reconcileSalesPage);

    const reconcileResponse =
      await reconcileSalesPage.processReconciliationItems([
        {
          saleId: sale.id,
          status: "Pending",
          reason: "Automation reconcile verification",
        },
      ]);

    expect(reconcileResponse.status).toBe(200);
  });
});
