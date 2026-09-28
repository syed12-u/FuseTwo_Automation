import { expect, test } from "@playwright/test";
import PrivateOffersPage from "../../pages/PrivateOffersPage";
import { AUTH_FILE } from "../../config/environment";
import { TRACKING_PROGRAM_NAME } from "../../fixtures/testConstants";

/**
 * Publishers → Private Offers: the listing and a full create through the
 * "Create Private Offer" dialog, read back through the row's View Offer and
 * Edit dialogs. @write — offers cannot be deleted from the UI, so each run
 * leaves one "QA private offer …" behind (ends in 7 days).
 */
test.describe("Private Offers", () => {
  test.use({ storageState: AUTH_FILE });

  test("listing shows the status tabs and the offers table @smoke", async ({
    page,
  }) => {
    const offers = new PrivateOffersPage(page);
    await offers.goto();
    for (const tab of ["Active", "Inactive", "Recruitment", "Expired"] as const) {
      await expect(offers.tab(tab), `tab "${tab}" missing`).toBeVisible();
    }
    for (const header of [
      "Name",
      "Offer Type",
      "Program",
      "Created",
      "Start Date",
      "End Date",
      "Actions",
    ]) {
      await expect(
        page.getByRole("columnheader", { name: header }).first(),
        `column "${header}" missing`,
      ).toBeVisible();
    }
  });

  test("a fixed private offer can be created, appears in Active and reads back every field @write @crud", async ({
    page,
  }) => {
    const offers = new PrivateOffersPage(page);
    await offers.goto();

    const name = `QA private offer ${Date.now().toString().slice(-6)}`;
    const input = {
      programName: TRACKING_PROGRAM_NAME,
      name,
      description: "QA automation private offer",
      offerModel: "Fixed" as const,
      referralPeriod: 30,
      amount: 15,
      startDate: PrivateOffersPage.dateFromNow(0),
      endDate: PrivateOffersPage.dateFromNow(7),
    };
    await offers.create(input);

    // Starts today, so it is Active; the list refreshes without a reload.
    await offers.tab("Active").click();
    const row = offers.offerRow(name).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(TRACKING_PROGRAM_NAME);
    await expect(row).toContainText(/Fixed/i);

    // Open the saved offer: every field equals what was entered, both in the
    // read-only View Offer dialog and in the Edit form (closed without saving).
    const expected = {
      programName: input.programName,
      name: input.name,
      description: input.description,
      offerModel: input.offerModel,
      referralPeriod: String(input.referralPeriod),
      amount: String(input.amount),
      startDate: input.startDate,
      endDate: input.endDate,
    };
    const view = await offers.openOffer(name, "View Offer");
    expect(await offers.readOffer(view)).toEqual(expected);
    await offers.closeDialog(view);

    const edit = await offers.openOffer(name, "Edit");
    expect(await offers.readOffer(edit)).toEqual(expected);
    await offers.closeDialog(edit);
  });

  test("required fields block Save on the create dialog @blocker", async ({
    page,
  }) => {
    const offers = new PrivateOffersPage(page);
    await offers.goto();
    await offers.addButton.click();
    await expect(offers.dialog).toBeVisible();

    await offers.saveButton.click();
    await page.waitForTimeout(1_500);
    // Still open, nothing created.
    await expect(offers.dialog).toBeVisible();
    await expect(offers.successAlert).toHaveCount(0);
  });
});
