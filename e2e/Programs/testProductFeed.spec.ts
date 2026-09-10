import { test } from "@playwright/test";
import ProductFeedPage from "../../pages/ProductFeedPage";
import { AUTH_FILE } from "../../config/environment";

const programName = "testautomationprogram";
const productFeedName = `Test_QA_Product_Feed_${Math.random()
  .toString(36)
  .substring(2, 8)}`;
const filePath = "fixtures/Product_Feed_csv/Oweli_Product_Feed.csv";

test.describe("Product Feed Tests", () => {
  test.use({ storageState: AUTH_FILE });
  test("Create, Import, and Deactivate Product Feed", async ({ page }) => {
    const productFeedPage = new ProductFeedPage(page);

    // Navigate straight to Products (the sidebar-menu traversal relied on a
    // stale button label and hung).
    await productFeedPage.navigateToProducts();

    // Create Product Feed
    await productFeedPage.createProductFeed(programName, productFeedName);

    // Import Product Feed
    await productFeedPage.importProductFeed(
      programName,
      productFeedName,
      filePath,
    );

    // Verify Product Feed Import Success
    await productFeedPage.verifyProductFeedImportSuccess();

    // Refresh Page
    await productFeedPage.refreshPage();

    // View and Verify Products
    await productFeedPage.viewAndVerifyProducts(productFeedName);

    // View Historical Updates
    await productFeedPage.viewHistoricalUpdates(productFeedName);

    // Request Product Feed
    await productFeedPage.requestProductFeed(productFeedName);

    // Deactivate Product Feed
    await productFeedPage.deactivateProductFeed(productFeedName);
  });
});
