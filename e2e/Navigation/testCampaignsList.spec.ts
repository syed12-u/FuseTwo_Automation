import { expect, test } from "@playwright/test";
import { AUTH_FILE, appUrl, PATHS } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Campaigns listing — read and navigation only (safe on every environment).
 */
test.describe("Campaigns - listing (read-only)", () => {
  test.use({ storageState: AUTH_FILE });

  const COLUMNS = [
    "Campaign",
    "Program",
    "Active Date",
    "Expire Date",
    "Edit",
    "Actions",
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto(appUrl(PATHS.campaigns), { waitUntil: "domcontentloaded" });
    await dismissPaymentReminderIfPresent(page);
  });

  test("the listing loads with tabs and Add Campaign @blocker @smoke", async ({
    page,
  }) => {
    await expect(page).toHaveURL(new RegExp(`${PATHS.campaigns}/?$`));
    await expect(
      page.getByRole("tab", { name: /Active Campaigns/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Inactive Campaigns/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Add Campaign/i }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /502 Bad Gateway|Internal Server Error|Application error/i,
    );
  });

  test("the table exposes the expected columns @blocker", async ({ page }) => {
    for (const column of COLUMNS) {
      await expect(
        page.getByRole("columnheader", { name: new RegExp(column) }).first(),
        `column "${column}" is missing from the campaigns listing`,
      ).toBeVisible();
    }
  });

  test("the active tab is selected by default and renders campaigns @blocker", async ({
    page,
  }) => {
    await expect(
      page.getByRole("tab", { name: /Active Campaigns/ }),
    ).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
    await expect
      .poll(() => page.locator("tbody tr").count(), { timeout: 30_000 })
      .toBeGreaterThan(0);
  });

  test("switching to the Inactive tab selects it @crud", async ({ page }) => {
    const inactiveTab = page.getByRole("tab", { name: /Inactive Campaigns/ });
    await inactiveTab.click();
    await expect(inactiveTab).toHaveAttribute("aria-selected", "true", {
      timeout: 30_000,
    });
  });
});
