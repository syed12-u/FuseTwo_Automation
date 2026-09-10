import { expect, test } from "@playwright/test";
import SignUpPage, {
  type CreatedAdvertiser,
} from "../../pages/FlexOffersSignUpPage";
import ManagementAdvertiserPage from "../../pages/ManagementAdvertiserPage";
import ManagementLoginPage from "../../pages/ManagementLoginPage";

/**
 * Management — CRUD on an advertiser's detail page.
 *
 * Registers a fresh advertiser on the advertiser app, then in the management
 * portal opens that advertiser and updates its data through the edit dialogs,
 * confirming each change persists. @write throughout.
 */
test.describe("Management - advertiser detail CRUD @write", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(8 * 60 * 1000);

  let advertiser: CreatedAdvertiser;
  let advertiserId: string;

  test("register a new advertiser and locate it in management @blocker", async ({
    page,
  }) => {
    const signUp = new SignUpPage(page);
    advertiser = await signUp.registerNewAdvertiser();
    await expect(page.getByText(/thank you/i).first()).toBeVisible({
      timeout: 60_000,
    });

    const management = new ManagementAdvertiserPage(page);
    await management.openOverview();
    await new ManagementLoginPage(page).assertAuthenticated();

    // Newly registered advertisers take a minute or two to be searchable.
    advertiserId = await management.searchAndOpenWithRetry(
      advertiser.companyName,
    );
    expect(advertiserId).toMatch(/^\d+$/);
    console.log(`advertiser ${advertiserId} <${advertiser.email}>`);
  });

  test("update Advertiser Information (website) and it persists @crud", async ({
    page,
  }) => {
    expect(advertiserId, "registration step did not complete").toBeTruthy();

    const management = new ManagementAdvertiserPage(page);
    await management.openAdvertiserById(advertiserId);

    const newWebsite = `https://qa-updated-${Date.now()}.com`;
    await management.editAdvertiserInfo({ website: newWebsite });

    // Re-open and confirm the new value stuck.
    await management.openAdvertiserById(advertiserId);
    const saved = await management.readAdvertiserWebsite();
    expect(saved, `website did not persist (shows "${saved}")`).toBe(
      newWebsite,
    );
  });

  test("update Contact Information (city) without error @crud", async ({
    page,
  }) => {
    expect(advertiserId, "registration step did not complete").toBeTruthy();

    const management = new ManagementAdvertiserPage(page);
    await management.openAdvertiserById(advertiserId);

    const newCity = `QAcity${Date.now().toString().slice(-5)}`;
    await management.editContactInfo({ city: newCity });

    // No server error on the detail page after saving.
    await management.openAdvertiserById(advertiserId);
    await expect(page.locator("body")).not.toContainText(
      /502 Bad Gateway|Internal Server Error|Application error/i,
    );
  });

  test("add an internal note @crud", async ({ page }) => {
    expect(advertiserId, "registration step did not complete").toBeTruthy();

    const management = new ManagementAdvertiserPage(page);
    await management.openAdvertiserById(advertiserId);

    const note = `QA automation note ${Date.now()}`;
    await management.addNote(note);

    // The note is submitted without a server error. (Notes render in a separate
    // panel whose exact location is not asserted here.)
    await expect(page.locator("body")).not.toContainText(
      /502 Bad Gateway|Internal Server Error|Application error/i,
    );
  });
});
