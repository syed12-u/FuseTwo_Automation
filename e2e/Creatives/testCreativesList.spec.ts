import { expect, test } from "@playwright/test";
import { AUTH_FILE, appUrl, PATHS } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Creatives listing — read and navigation only (safe on every environment).
 * The create flows (text link, banner) are covered by their own @write specs.
 */
test.describe("Creatives - listing (read-only)", () => {
  test.use({ storageState: AUTH_FILE });

  test.beforeEach(async ({ page }) => {
    await page.goto(appUrl(PATHS.creatives), { waitUntil: "domcontentloaded" });
    await dismissPaymentReminderIfPresent(page);
  });

  test("the listing loads with its status tabs @blocker @smoke", async ({
    page,
  }) => {
    await expect(page).toHaveURL(new RegExp(`${PATHS.creatives}/?$`));
    await expect(
      page.getByRole("tab", { name: /Active Creatives/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Inactive Creatives/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Disabled Creatives/ }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /502 Bad Gateway|Internal Server Error|Application error/i,
    );
  });

  test("the text-link and banner creation entry points are present @blocker", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: /Add Text Link/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Add Banner/i }),
    ).toBeVisible();
  });

  test("the active tab is selected by default @crud", async ({ page }) => {
    await expect(
      page.getByRole("tab", { name: /Active Creatives/ }),
    ).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
    // The count in the tab label confirms the active set is populated.
    await expect(
      page.getByRole("tab", { name: /Active Creatives \(\d+\)/ }),
    ).toBeVisible({
      timeout: 30_000,
    });
  });

  test("switching to the Inactive tab selects it @crud", async ({ page }) => {
    const inactiveTab = page.getByRole("tab", { name: /Inactive Creatives/ });
    await inactiveTab.click();
    await expect(inactiveTab).toHaveAttribute("aria-selected", "true", {
      timeout: 30_000,
    });
  });
});
