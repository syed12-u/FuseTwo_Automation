import { expect, Locator, Page } from "@playwright/test";
import BasePage from "./BasePage";
import { appUrl, PATHS } from "../config/environment";
import { dismissPaymentReminderIfPresent } from "../utility/appActions";

export const SETUP_STEPS = [
  "Introduction",
  "Select a Plan",
  "Create a Program",
  "Create a Campaign",
  "Conversion Tracking",
  "Create Test Transaction",
  "Complete",
] as const;

export const SETUP_PLANS = [
  "Self-Managed",
  "Relationship Package",
  "Relationship + Package",
] as const;

/**
 * The two logo uploads on the program step, keyed by the input name and the
 * pixel size the helper text asks for.
 */
export const PROGRAM_LOGOS = {
  imagePath: { width: 150, height: 40 },
  imagePath_V3: { width: 300, height: 300 },
} as const;

export type ProgramLogo = keyof typeof PROGRAM_LOGOS;

export const PROGRAM_TABS = [
  "GENERAL",
  "PROGRAM DEFAULTS",
  "ADVANCED COMMISSIONS",
  "PUBLISHER APPROVAL CRITERIA",
  "SEARCH KEYWORDS",
] as const;

/**
 * Settings → New Advertiser Setup (/app/settings/advertisersetup).
 *
 * A stepper wizard: Introduction → Select a Plan → Create a Program → Create a
 * Campaign → Conversion Tracking → Create Test Transaction → Complete. It opens
 * on the account's current step, so callers walk BACK to reach an earlier one.
 * "Create a Program" is the program editor (five tabs) for the account's first
 * program — pre-filled once a program exists — so CONTINUE from it saves.
 * (Confirmed on staging 2026-09-25: entering the step fires
 * GET /api/{advertiserId}/programs/{firstProgramId} and shows that program.)
 *
 * "Select a Plan" has no selectable cards: the enrolled plan carries an
 * ENROLLED badge and the other two a CONTACT US button, which is how a plan
 * change is requested.
 */
export default class AdvertiserSetupPage extends BasePage {
  readonly heading: Locator;
  readonly backButton: Locator;
  readonly continueButton: Locator;
  readonly introHeading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByText("New Advertiser Setup", { exact: true }).last();
    // The labels are uppercase via CSS only (accessible names are "Back" /
    // "Continue"), and every program tab pane renders its own hidden pair, so
    // match the visible button case-insensitively.
    this.backButton = page.locator("button:visible", { hasText: /^back$/i }).first();
    this.continueButton = page
      .locator("button:visible", { hasText: /^continue$/i })
      .first();
    // Rendered with a typographic apostrophe ("Let’s").
    this.introHeading = page
      .getByText(/Let.s Get Your FuseTwo Program Set Up/i)
      .first();
  }

  async goto() {
    await this.page.goto(appUrl(PATHS.advertiserSetup), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(this.page);
    await this.expectLoaded();
  }

  /** Open the wizard the way a user does: Settings → New Advertiser Setup. */
  async openFromSidebar() {
    // The sidebar groups are li.menu.collapse-box with a ul.sub-menu that is
    // collapsed to 0px height until the group header is clicked. The header
    // must be located inside the group: a bare getByText("Settings") also
    // matches the top-bar "Settings" button, which is what used to be clicked.
    const group = this.page
      .locator("li.menu.collapse-box")
      .filter({ has: this.page.getByRole("link", { name: "New Advertiser Setup" }) });
    const subMenu = group.locator("ul.sub-menu");
    const link = group.getByRole("link", { name: "New Advertiser Setup" });

    const collapsed = async () =>
      ((await subMenu.boundingBox().catch(() => null))?.height ?? 0) < 1;
    if (await collapsed()) {
      await group.getByText("Settings", { exact: true }).first().click();
      await expect.poll(collapsed, { timeout: 10_000 }).toBe(false);
    }
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(this.page).toHaveURL(new RegExp(PATHS.advertiserSetup));
    await this.expectLoaded();
  }

  async expectLoaded() {
    await expect(this.stepLabel("Introduction")).toBeVisible({ timeout: 30_000 });
  }

  stepLabel(step: (typeof SETUP_STEPS)[number]): Locator {
    return this.page.getByText(step, { exact: true }).first();
  }

  /** Walk BACK until the Introduction step is showing. */
  async goToIntroduction() {
    for (let i = 0; i < SETUP_STEPS.length; i++) {
      if (await this.introHeading.isVisible().catch(() => false)) return;
      await this.backButton.click();
      await this.page.waitForTimeout(1_000);
    }
    await expect(this.introHeading).toBeVisible();
  }

  planCard(plan: (typeof SETUP_PLANS)[number]): Locator {
    return this.page.getByRole("heading", { name: plan, exact: true });
  }

  get enrolledBadge(): Locator {
    return this.page.getByRole("button", { name: "ENROLLED" });
  }

  /** The whole plan card (header, action button and feature list). */
  planCardRoot(plan: (typeof SETUP_PLANS)[number]): Locator {
    return this.page.locator(".card.package").filter({ has: this.planCard(plan) });
  }

  /** The card's single action: ENROLLED on the current plan, CONTACT US elsewhere. */
  planAction(plan: (typeof SETUP_PLANS)[number]): Locator {
    return this.planCardRoot(plan).getByRole("button");
  }

  /** The hidden file input of one of the two program-logo uploads. */
  logoInput(logo: ProgramLogo): Locator {
    return this.page.locator(`input[type="file"][name="${logo}"]`);
  }

  /** The preview image rendered above that upload's "Re-upload file" link. */
  logoPreview(logo: ProgramLogo): Locator {
    return this.page
      .locator(".adpro-file-control")
      .filter({ has: this.logoInput(logo) })
      .locator("img.body-image");
  }

  /**
   * Pick a file for one of the logo uploads. Nothing is sent to the server:
   * the form only swaps the preview to a blob: URL until CONTINUE is pressed.
   */
  async chooseLogo(logo: ProgramLogo, file: { name: string; mimeType: string; buffer: Buffer }) {
    await this.logoInput(logo).setInputFiles(file);
  }

  programTab(tab: (typeof PROGRAM_TABS)[number]): Locator {
    // Tab labels are uppercase via CSS; the accessible names are title case.
    return this.page.getByRole("tab", { name: new RegExp(`^${tab}$`, "i") });
  }

  /** Program step fields, addressed by the names the form renders. */
  programField(name: string): Locator {
    return this.page.locator(`[name="${name}"]`).first();
  }

  get logoInputs(): Locator {
    return this.page.locator('input[type="file"][name^="imagePath"]');
  }
}
