import { expect, test } from "@playwright/test";
import ProgramPage from "../../pages/ProgramPage";
import { AUTH_FILE } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Programs — full write lifecycle on a program the test creates itself.
 *
 * Every test works only on its own freshly created program, so it never
 * mutates existing advertiser data. All @write, so excluded from live runs
 * unless explicitly enabled.
 */
test.describe("Programs - create / read / update / deactivate @write", () => {
  test.use({ storageState: AUTH_FILE });
  test.setTimeout(3 * 60 * 1000);

  test("a program can be created and appears in the listing @blocker @crud", async ({
    page,
  }) => {
    const programs = new ProgramPage(page);
    await programs.navigateToPrograms();
    const name = await programs.createProgram();

    await expect(programs.successAlert).toContainText(/Program Created/i);

    await programs.gotoListing();
    await dismissPaymentReminderIfPresent(page);
    await expect(programs.programRowByName(name).first()).toBeVisible({
      timeout: 30_000,
    });
    console.log(`created program "${name}"`);
  });

  test("a created program reads back with its details @crud", async ({
    page,
  }) => {
    const programs = new ProgramPage(page);
    await programs.navigateToPrograms();
    const name = await programs.createProgram();
    await expect(programs.successAlert).toContainText(/Program Created/i);

    await programs.gotoListing();
    await dismissPaymentReminderIfPresent(page);
    const id = await programs.openProgramByName(name);
    expect(id, "no program id in the detail URL").toMatch(/^\d+$/);

    // The name that was entered is what the detail page shows.
    await expect(programs.programNameInput).toHaveValue(name);
  });

  // App bug: the program update endpoint returns HTTP 500 ("Oops! Something
  // went wrong"), so the change never persists. Tagged @known-bug so it leaves
  // the green gate and runs as a regression guard until the API is fixed.
  test("a created program can be updated and the change persists @crud @known-bug", async ({
    page,
  }) => {
    const programs = new ProgramPage(page);
    await programs.navigateToPrograms();
    const name = await programs.createProgram();
    await expect(programs.successAlert).toContainText(/Program Created/i);

    await programs.gotoListing();
    await dismissPaymentReminderIfPresent(page);
    const id = await programs.openProgramByName(name);

    const updated = `Updated by automation ${Date.now()}`;
    await programs.updateDescription(updated);

    // Re-open the same program by id and confirm the new description stuck.
    await programs.gotoProgramDetail(id);
    await expect(programs.programDescriptionField).toHaveValue(updated);
  });

  test("a created program can be deactivated @crud", async ({ page }) => {
    const programs = new ProgramPage(page);
    await programs.navigateToPrograms();
    const name = await programs.createProgram();
    await expect(programs.successAlert).toContainText(/Program Created/i);

    await programs.gotoListing();
    await dismissPaymentReminderIfPresent(page);
    await expect(programs.programRowByName(name).first()).toBeVisible({
      timeout: 30_000,
    });

    await programs.deactivateProgram(name);
    await page.waitForTimeout(3_000);

    // The core assertion: it is gone from the Active listing after a reload.
    await programs.gotoListing();
    await dismissPaymentReminderIfPresent(page);
    await expect(programs.programRowByName(name)).toHaveCount(0, {
      timeout: 30_000,
    });
  });

  test("the Add Program form opens on step 1 and gates step 2 @blocker", async ({
    page,
  }) => {
    const programs = new ProgramPage(page);
    await programs.navigateToPrograms();

    // Step 1 is the program-name form.
    await expect(programs.programNameInput).toBeVisible({ timeout: 30_000 });

    // With nothing filled in, the commission step is not reachable — the form
    // has not advanced past step 1.
    await expect(
      programs.commissionInput,
      "the commission step is visible before step 1 is completed",
    ).toBeHidden();
  });
});
