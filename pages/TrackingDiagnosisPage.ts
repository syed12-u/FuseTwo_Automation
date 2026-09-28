import { expect, Locator, Page } from "@playwright/test";
import BasePage from "./BasePage";
import { appUrl, PATHS } from "../config/environment";
import { dismissPaymentReminderIfPresent } from "../utility/appActions";

/**
 * Support → Tracking Diagnosis (/app/support/tracking-diagnosis).
 *
 * Three steps: Introduction → Select a Program → Diagnose Tracking. Step 3
 * shows a publisher test link on the tracking host, the purchase instructions
 * and a results table that lists test transactions as they arrive. Every visit
 * to step 3 issues a fresh test link (its trackingid increments).
 */
export default class TrackingDiagnosisPage extends BasePage {
  readonly continueButton: Locator;
  readonly nextButton: Locator;
  readonly programField: Locator;
  readonly publisherLink: Locator;
  readonly resultsTable: Locator;

  constructor(page: Page) {
    super(page);
    this.continueButton = page.getByRole("button", { name: "CONTINUE" });
    this.nextButton = page.getByRole("button", { name: "NEXT" });
    this.programField = page.locator('input[name="programName"]');
    this.publisherLink = page.locator('a[href*="/g.ashx?"]');
    this.resultsTable = page.getByRole("table").filter({
      has: page.getByRole("columnheader", { name: "Error Message" }),
    });
  }

  async goto() {
    await this.page.goto(appUrl(PATHS.trackingDiagnosis), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(this.page);
    await expect(
      this.page.getByText(/Create a Test Transaction via the FuseTwo Tracking Diagnosis Tool/i),
    ).toBeVisible({ timeout: 30_000 });
  }

  /** Introduction → Select a Program → Diagnose Tracking. Returns the test link. */
  async diagnoseProgram(programName: string): Promise<string> {
    await this.continueButton.click();
    await expect(this.programField).toBeVisible({ timeout: 30_000 });
    await this.programField.click();
    await this.page
      .getByRole("option", { name: programName, exact: true })
      .click();
    await expect(this.programField).toHaveValue(programName);
    await this.nextButton.click();
    await expect(this.publisherLink).toBeVisible({ timeout: 30_000 });
    return (await this.publisherLink.getAttribute("href")) ?? "";
  }

  instruction(text: RegExp): Locator {
    return this.page.getByText(text);
  }

  /** Result rows for the program (header row excluded). */
  resultRows(programName: string): Locator {
    return this.resultsTable.locator("tbody tr").filter({ hasText: programName });
  }
}
