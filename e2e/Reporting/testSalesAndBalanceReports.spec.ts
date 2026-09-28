import { expect, Page, test } from "@playwright/test";
import { AUTH_FILE, PATHS, appUrl } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Sales Summary, Sales Detailed, Non-Commissionable Sales and Account Balance:
 * each page loads its filters and table, a date-range Apply re-queries without
 * error, and the money columns hold currency values. Read-only.
 */
test.describe("Reporting - sales reports and balances (read-only)", () => {
  test.use({ storageState: AUTH_FILE });

  const money = /^-?\$[\d,]+(\.\d{2})?$/;

  async function open(page: Page, path: string) {
    await page.goto(appUrl(path), { waitUntil: "domcontentloaded" });
    await dismissPaymentReminderIfPresent(page);
    await expect(page.getByRole("table").first()).toBeVisible({
      timeout: 60_000,
    });
  }

  /** Widen the From date to the 1st of last month and Apply. */
  async function applyWiderRange(page: Page) {
    const from = page.getByLabel("From").first();
    const d = new Date();
    d.setMonth(d.getMonth() - 1, 1);
    const value = `${String(d.getMonth() + 1).padStart(2, "0")}-01-${d.getFullYear()}`;
    await from.click();
    await from.press("Control+A");
    await from.fill(value);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Apply$/i }).click();
    await page.waitForTimeout(3_000);
    await expect(page.locator("body")).not.toContainText(
      /Internal Server Error|Something went wrong|502 Bad Gateway/i,
    );
  }

  async function columnValues(page: Page, header: string): Promise<string[]> {
    const headers = await page.locator("thead th").allInnerTexts();
    const index = headers.findIndex((h) => h.trim().startsWith(header));
    expect(index, `column "${header}" not found in ${headers}`).toBeGreaterThan(-1);
    return page
      .locator(`tbody tr td:nth-child(${index + 1})`)
      .allInnerTexts()
      .then((v) => v.map((s) => s.trim()).filter(Boolean));
  }

  test("Sales Summary: date filter, table and commission totals @blocker", async ({
    page,
  }) => {
    await open(page, PATHS.reportSalesSummary);
    for (const h of ["Program Name", "Publisher Name", "Clicks", "Sales", "Sales Amount", "Commission"]) {
      await expect(page.getByRole("columnheader", { name: h }).first()).toBeVisible();
    }
    await applyWiderRange(page);
    for (const value of await columnValues(page, "Commission")) {
      expect(value, "Commission cell is not a currency value").toMatch(money);
    }
    await expect(page.getByRole("button", { name: /^Export$/i }).first()).toBeVisible();
  });

  test("Sales Detailed: filters apply and rows carry program, publisher and sale data @blocker", async ({
    page,
  }) => {
    await open(page, PATHS.reportSalesDetailed);
    for (const h of ["Program Name", "Sale ID", "Order Number", "Date Posted", "Sale Amount", "Commission", "Publisher Name"]) {
      await expect(page.getByRole("columnheader", { name: h }).first()).toBeVisible();
    }
    await applyWiderRange(page);
    const rows = page.locator("tbody tr");
    if ((await rows.count()) > 0) {
      const saleIds = await columnValues(page, "Sale ID");
      saleIds.forEach((id) => expect(id).toMatch(/^\d+$/));
      for (const value of await columnValues(page, "Sale Amount")) {
        expect(value).toMatch(money);
      }
    }
  });

  test("Non-Commissionable Sales loads with its columns @smoke", async ({
    page,
  }) => {
    await open(page, "/app/accounting/noncommissionable");
    for (const h of ["Click Date", "Sale Date", "Click ID", "Program Name", "Order Number", "Sale Amount", "Return Days"]) {
      await expect(page.getByRole("columnheader", { name: h }).first()).toBeVisible();
    }
    await applyWiderRange(page);
  });

  test("Account Balance shows balance figures and the invoice table @smoke", async ({
    page,
  }) => {
    await open(page, "/app/accounting/accountbalance");
    for (const h of ["Invoice ID", "Description", "Amount", "Status", "Created", "Paid"]) {
      await expect(page.getByRole("columnheader", { name: h }).first()).toBeVisible();
    }
    // The balance figures render as currency somewhere above the table.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.match(/\$[\d,]+\.\d{2}/g)?.length ?? 0).toBeGreaterThan(0);
    await expect(page.locator("body")).not.toContainText(
      /Internal Server Error|Something went wrong|502 Bad Gateway/i,
    );
  });
});
