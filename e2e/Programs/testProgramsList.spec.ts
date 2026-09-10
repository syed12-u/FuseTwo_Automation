import { expect, test } from "@playwright/test";
import ProgramPage from "../../pages/ProgramPage";
import { AUTH_FILE, PATHS } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Programs listing — read and navigation only.
 *
 * These are safe on every environment (they never create, edit or deactivate a
 * program), so they carry no @write tag and can gate a live release. The
 * create/update/deactivate write flows live in their own @write specs.
 */
test.describe("Programs - listing and detail (read-only)", () => {
  test.use({ storageState: AUTH_FILE });

  let programs: ProgramPage;

  test.beforeEach(async ({ page }) => {
    programs = new ProgramPage(page);
    await programs.gotoListing();
    await dismissPaymentReminderIfPresent(page);
  });

  test("the listing loads with the status tabs and Add Program @blocker @smoke", async ({
    page,
  }) => {
    await expect(page).toHaveURL(new RegExp(`${PATHS.programs}/?$`));
    await expect(programs.statusTab("Active")).toBeVisible();
    await expect(programs.statusTab("Deactivated")).toBeVisible();
    await expect(programs.addProgramBtn).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /502 Bad Gateway|Internal Server Error|Application error/i,
    );
  });

  test("the table exposes the expected columns @blocker", async ({ page }) => {
    for (const column of ProgramPage.LISTING_COLUMNS) {
      await expect(
        page.getByRole("columnheader", { name: column }).first(),
        `column "${column}" is missing from the programs listing`,
      ).toBeVisible();
    }
  });

  test("the active tab is selected by default and renders programs @blocker", async ({
    page,
  }) => {
    // Active is the default tab...
    await expect(programs.statusTab("Active")).toHaveAttribute(
      "aria-selected",
      "true",
      {
        timeout: 30_000,
      },
    );

    // ...and it lists programs (a page's worth; the total is paginated).
    await expect
      .poll(() => programs.dataRows().count(), { timeout: 30_000 })
      .toBeGreaterThan(0);
    console.log(
      `Active tab rows rendered=${await programs.dataRows().count()}`,
    );
  });

  test("switching to the Deactivated tab selects it and shows its programs @crud", async ({
    page,
  }) => {
    const deactivatedTab = programs.statusTab("Deactivated");
    await expect(deactivatedTab).toBeVisible({ timeout: 30_000 });

    await deactivatedTab.click();
    // The tab reports itself selected once the switch completes.
    await expect(deactivatedTab).toHaveAttribute("aria-selected", "true", {
      timeout: 30_000,
    });

    // The deactivated listing renders its own rows (count capped by paging).
    await expect
      .poll(() => programs.dataRows().count(), { timeout: 30_000 })
      .toBeGreaterThan(0);
    console.log(
      `Deactivated rows rendered=${await programs.dataRows().count()}`,
    );
  });

  test("opening a program loads its Update Program detail page @blocker @crud", async ({
    page,
  }) => {
    await expect(programs.dataRows().first()).toBeVisible({ timeout: 30_000 });

    const id = await programs.openFirstProgram();
    expect(id, "no program id in the detail URL").toMatch(/^\d+$/);

    await expect(
      page.getByRole("heading", {
        name: new RegExp(`Update Program \\(#${id}\\)`),
      }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /502 Bad Gateway|Internal Server Error|Application error/i,
    );
  });
});
