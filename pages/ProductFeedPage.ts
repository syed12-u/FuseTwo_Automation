import { Page, Locator, expect } from "@playwright/test";
import BasePage from "./BasePage";
import { PRODUCTS_MANAGE_URL } from "../fixtures/URLconstants";

export default class ProductFeedPage extends BasePage {
  readonly menuButton: Locator;
  readonly programsButton: Locator;
  readonly productsLink: Locator;
  readonly programDropdown: Locator;
  readonly productFeedNameField: Locator;
  readonly fileNameField: Locator;
  readonly publisherGroupsDropdown: Locator;
  readonly selectAllButton: Locator;
  readonly saveChangesButton: Locator;
  readonly alertMessage: Locator;
  readonly importTab: Locator;
  readonly setupTab: Locator;
  readonly manualUploadTab: Locator;
  readonly productFeedDropdown: Locator;
  readonly chooseFileButton: Locator;
  readonly importButton: Locator;
  readonly viewProductsButton: Locator;
  readonly closeButton: Locator;
  readonly viewHistoricalUpdatesButton: Locator;
  readonly progressBar: Locator;
  readonly requestProductFeedButton: Locator;
  readonly manageTab: Locator;
  readonly inactiveTab: Locator;
  readonly table: Locator;

  constructor(page: Page) {
    super(page);

    // Locators
    this.menuButton = page.getByRole("button", { name: "Menu" });
    this.programsButton = page.getByRole("button", { name: " Programs" });
    this.productsLink = page.getByRole("link", {
      name: "Products",
      exact: true,
    });

    this.programDropdown = page.getByRole("combobox", {
      name: "Program *",
    });

    this.productFeedNameField = page.getByRole("textbox", {
      name: "Product Feed Name *",
    });

    this.fileNameField = page.getByRole("textbox", {
      name: "File Name *",
    });

    this.publisherGroupsDropdown = page.locator("#publisherGroups");
    this.selectAllButton = page.getByText("Select All");

    this.saveChangesButton = page.getByRole("button", {
      name: "Save Changes",
    });

    this.alertMessage = page.getByRole("alert").last();

    this.importTab = page.getByRole("tab", {
      name: "IMPORT",
    });
    this.setupTab = page.getByRole("tab", {
      name: "SETUP",
    });

    this.manualUploadTab = page.getByRole("tab", {
      name: "MANUAL UPLOAD",
    });

    this.productFeedDropdown = page.getByRole("combobox", {
      name: "Product Feed *",
    });

    this.chooseFileButton = page.locator('input[type="file"][name="filePath"]');

    this.importButton = page.getByRole("button", {
      name: "Import",
    });

    this.viewProductsButton = page.getByRole("button", {
      name: "View products",
    });

    this.closeButton = page.getByRole("button", {
      name: "Close",
    });

    this.viewHistoricalUpdatesButton = page.getByRole("button", {
      name: "View historical updates",
    });

    this.progressBar = page.getByRole("progressbar");

    this.requestProductFeedButton = page.getByRole("button", {
      name: "request product feed",
    });

    this.manageTab = page.getByRole("tab", {
      name: "MANAGE",
    });

    this.inactiveTab = page.getByRole("tab", {
      name: "Inactive",
    });

    this.table = page.getByRole("table");
  }

  async navigateToProducts() {
    await this.productsLink.click();
  }

  async createProductFeed(programName: string, productFeedName: string) {
    await this.setupTab.click();
    await expect(this.programDropdown).toBeVisible({ timeout: 15000 });

    await this.programDropdown.click();
    await this.page.getByRole("option", { name: programName }).first().click();

    await this.productFeedNameField.fill(productFeedName);
    await this.fileNameField.fill(`${productFeedName}.csv`);

    await this.publisherGroupsDropdown.click();
    await this.selectAllButton.click();

    await this.saveChangesButton.click();
    await this.page.waitForTimeout(2000);

    await expect(this.alertMessage).toContainText("Product feed created");
  }

  async importProductFeed(
    programName: string,
    productFeedName: string,
    filePath: string,
  ) {
    await this.importTab.click();
    await this.manualUploadTab.click();

    await this.programDropdown.click();
    await this.page.getByRole("option", { name: programName }).first().click();

    await this.productFeedDropdown.click();
    await this.page.getByRole("option", { name: productFeedName }).click();

    await this.chooseFileButton.setInputFiles(filePath);
    await this.importButton.click();

    await this.page.waitForTimeout(2000);

    await expect(this.alertMessage).toContainText("Product feed imported");
  }

  async verifyProductFeedImportSuccess() {
    await expect(this.alertMessage).toContainText("Product feed imported");
    await expect(this.alertMessage).toBeVisible();
  }

  async viewAndVerifyProducts(productFeedName: string) {
    const importedProductTitle = "Oweli 10 Shrooms";

    for (let attempt = 1; attempt <= 2; attempt++) {
      // Wait for the table to be visible
      await expect(this.table).toBeVisible({ timeout: 15000 });

      // Find the row that contains the specific product feed name
      const productRow = this.page
        .getByRole("row")
        .filter({
          hasText: productFeedName,
        })
        .first();

      // Verify the row is visible
      await expect(productRow).toBeVisible({ timeout: 15000 });

      // Click the "View products" button in the matched row
      await this.clickRowAction(productRow, [
        "View products",
        "View Products",
        "Products",
      ]);

      await this.waitForProductsPopupToLoad();

      // Verify imported product is displayed. Product processing may lag behind the import toast.
      const importedProduct = this.page.getByText(importedProductTitle).first();
      try {
        await expect(importedProduct).toBeVisible({ timeout: 60000 });
        await this.closeProductsPopup();
        return;
      } catch {
        await this.closeProductsPopup();
        await this.page.waitForTimeout(5000);
        await this.refreshPage();
      }
    }

    await expect(this.page.getByText(importedProductTitle).first()).toBeVisible(
      { timeout: 60000 },
    );
  }

  async clickRowAction(row: Locator, actionNames: string[]) {
    for (const actionName of actionNames) {
      const action = row
        .getByRole("button", { name: actionName, exact: true })
        .first();

      if ((await action.count()) > 0) {
        await expect(action).toBeVisible({ timeout: 5000 });
        await action.click();
        return;
      }
    }

    const fallbackAction = row
      .getByRole("button", {
        name: new RegExp(actionNames.join("|"), "i"),
      })
      .first();

    await expect(fallbackAction).toBeVisible({ timeout: 5000 });
    await fallbackAction.click();
  }

  async closeProductsPopup() {
    if (await this.closeButton.isVisible()) {
      await this.closeButton.click();
      return;
    }

    const closeIcon = this.page.getByTestId("CloseIcon").first();
    if (await closeIcon.isVisible()) {
      await closeIcon.click();
      return;
    }

    await this.page.keyboard.press("Escape");
  }

  async waitForProductsPopupToLoad() {
    const dialog = this.page.getByRole("dialog").last();
    if ((await dialog.count()) > 0) {
      await expect(dialog).toBeVisible({ timeout: 15000 });
    }

    const loader = this.page
      .getByRole("progressbar")
      .or(this.page.locator(".MuiCircularProgress-root"))
      .first();

    if ((await loader.count()) > 0) {
      await expect(loader).toBeHidden({ timeout: 60000 });
    }
  }

  async viewHistoricalUpdates(productFeedName: string) {
    const productRow = this.page
      .getByRole("row")
      .filter({
        hasText: productFeedName,
      })
      .first();

    await expect(productRow).toBeVisible({ timeout: 15000 });
    await productRow
      .getByLabel("View historical updates", { exact: true })
      .click();

    await expect(this.progressBar).toBeVisible({ timeout: 15000 });

    await this.page.keyboard.press("Escape");
  }

  async requestProductFeed(productFeedName: string) {
    await this.manageTab.click();

    const productRow = this.page
      .getByRole("row")
      .filter({
        hasText: productFeedName,
      })
      .first();

    await expect(productRow).toBeVisible({ timeout: 15000 });
    await productRow
      .getByLabel(/request product feed|request product feed deactivation/i)
      .click();

    await this.manageTab.click();
    await this.refreshPage();

    await this.inactiveTab.click();
    await expect(this.table).toContainText(productFeedName, { timeout: 30000 });
  }

  async refreshPage() {
    await this.page.goto(PRODUCTS_MANAGE_URL);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async deactivateProductFeed(productFeedName: string) {
    await this.manageTab.click();
    await this.inactiveTab.click();

    await expect(this.table).toContainText(productFeedName);
  }
}
