import { expect, test } from "@playwright/test";
import { AUTH_FILE, PATHS } from "../../config/environment";
import { gotoApp } from "../../utility/appActions";

test.describe("Dashboard", () => {
  test.use({ storageState: AUTH_FILE });

  test.beforeEach(async ({ page }) => {
    // gotoApp dismisses the payment-reminder modal that otherwise renders over
    // the dashboard and blocks the widgets and nav — the cause of this suite's
    // earlier intermittent failures.
    await gotoApp(page, PATHS.dashboard);
  });

  test("loads the authenticated dashboard instead of redirecting to sign in @blocker @smoke", async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/app\/dashboard\/?$/);
    await expect(page).toHaveTitle(/Dashboard.*FuseTwo/i);
    await expect(
      page.getByRole("heading", { name: "Welcome to FuseTwo" }),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/\/signin/i);
  });

  test("shows publisher status and performance widgets @blocker", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: /Approved\d*/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Pending\d*/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Publisher Performance \(Clicks\)/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Publisher Performance \(Revenue\)/ }),
    ).toBeVisible();
  });

  test("shows browser, device, and platform analytics widgets", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Top 5 Browsers" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Top 5 Devices" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Top 5 Platforms" }),
    ).toBeVisible();
  });

  test("exposes all primary advertiser navigation links @blocker", async ({
    page,
  }) => {
    for (const linkName of [
      "Programs",
      "Campaigns",
      "Creatives",
      "Products",
      "Publisher List",
      "Reconcile Sales",
      "Performance",
      "My Account",
      "Help Desk",
    ]) {
      await expect(
        page.getByRole("link", { name: linkName, exact: true }),
      ).toBeVisible();
    }
  });

  /**
   * Guards bugs #680 / #690 — Advertiser Overview flooding the API with calls
   * (219+/min) and error toasts, freezing the page. Once the dashboard has
   * loaded it should go quiet: on dev it settles to zero calls. A regression
   * that re-introduces the loop would blow past this bound immediately.
   */
  test("does not flood the API after the dashboard settles @blocker @security", async ({
    page,
  }) => {
    // Let the initial burst of load requests finish.
    await page.waitForTimeout(5_000);

    let steadyStateApiCalls = 0;
    page.on("request", (request) => {
      if (/\/api\//i.test(request.url())) steadyStateApiCalls += 1;
    });

    await page.waitForTimeout(15_000);

    expect(
      steadyStateApiCalls,
      `dashboard made ${steadyStateApiCalls} API calls in 15s of steady state — ` +
        `possible infinite fetch loop (bugs #680 / #690)`,
    ).toBeLessThan(30);
  });

  test("does not show a flood of error toasts @security", async ({ page }) => {
    await page.waitForTimeout(6_000);
    const errorToasts = page.locator(
      ".Toastify__toast--error, .MuiAlert-standardError",
    );
    const count = await errorToasts.count();
    expect(
      count,
      `dashboard showed ${count} error toasts (bug #690)`,
    ).toBeLessThan(3);
  });
});
