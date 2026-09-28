import { Page, expect, test } from "@playwright/test";
import { AUTH_FILE, PATHS, appUrl } from "../../config/environment";
import AdvertiserSetupPage, {
  PROGRAM_LOGOS,
  PROGRAM_TABS,
  ProgramLogo,
  SETUP_PLANS,
  SETUP_STEPS,
} from "../../pages/AdvertiserSetupPage";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * New Advertiser Setup wizard: Introduction → Select a Plan → Create a Program.
 *
 * Runs against the shared, already-onboarded account. The "Create a Program"
 * step is NOT a blank form: on staging it fires
 * GET /api/{advertiserId}/programs/{firstProgramId} and pre-fills the
 * account's live first program ("First Program AdvertiserPRO", id 214285), so
 * CONTINUE from it would save over that program. These tests therefore walk
 * and inspect the steps, choose a logo file (preview only) and never press
 * CONTINUE on the program step.
 *
 * "Select a Plan" has no selectable cards either: the enrolled plan shows an
 * ENROLLED badge and the other two a CONTACT US button (a sales request, so
 * it is not clicked here). The plan test asserts that state instead.
 */
test.describe("New Advertiser Setup wizard", () => {
  test.use({ storageState: AUTH_FILE });

  /** Walk to the "Create a Program" step of the wizard. */
  async function openProgramStep(page: Page): Promise<AdvertiserSetupPage> {
    const setup = new AdvertiserSetupPage(page);
    await setup.goto();
    await setup.goToIntroduction();
    await setup.continueButton.click(); // → Select a Plan
    await expect(setup.planCard("Self-Managed")).toBeVisible({ timeout: 30_000 });
    await setup.continueButton.click(); // → Create a Program
    await expect(setup.programTab("GENERAL")).toBeVisible({ timeout: 30_000 });
    return setup;
  }

  /** A solid-colour PNG of exactly the size the upload asks for, drawn in-page. */
  async function generatedPng(page: Page, logo: ProgramLogo) {
    const { width, height } = PROGRAM_LOGOS[logo];
    const dataUrl = await page.evaluate(
      ([w, h]) => {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#2a42a4";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(4, 4, w - 8, h - 8);
        return canvas.toDataURL("image/png");
      },
      [width, height] as const,
    );
    return {
      name: `qa-logo-${width}x${height}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(dataUrl.split(",")[1], "base64"),
    };
  }

  test("opens from the dashboard sidebar with every step listed @smoke", async ({
    page,
  }) => {
    await page.goto(appUrl(PATHS.dashboard), { waitUntil: "domcontentloaded" });
    await dismissPaymentReminderIfPresent(page);
    const setup = new AdvertiserSetupPage(page);
    await setup.openFromSidebar();

    for (const step of SETUP_STEPS) {
      await expect(setup.stepLabel(step), `step "${step}" missing`).toBeVisible();
    }
  });

  test("Introduction describes each setup step and continues to the plan", async ({
    page,
  }) => {
    const setup = new AdvertiserSetupPage(page);
    await setup.goto();
    await setup.goToIntroduction();

    // Short phrases only: the copy has hard line breaks in the source, and a
    // regex spanning one of them does not match.
    for (const text of [
      /Choose to manage the account/i,
      /Also known as an Affiliate Program/i,
      /campaign represents a set of offers/i,
      /Allows your website to report sales/i,
      /tracking is working correctly/i,
    ]) {
      await expect(page.getByText(text)).toBeVisible();
    }

    await setup.continueButton.click();
    await expect(setup.planCard("Self-Managed")).toBeVisible({ timeout: 30_000 });
  });

  test("Select a Plan shows the three plans with Self-Managed enrolled", async ({
    page,
  }) => {
    const setup = new AdvertiserSetupPage(page);
    await setup.goto();
    await setup.goToIntroduction();
    await setup.continueButton.click();

    for (const plan of SETUP_PLANS) {
      await expect(setup.planCard(plan), `plan "${plan}" missing`).toBeVisible({
        timeout: 30_000,
      });
    }
    await expect(setup.enrolledBadge).toBeVisible();
    await expect(page.getByRole("button", { name: "CONTACT US" })).toHaveCount(2);
  });

  test("Select a Plan: the enrolled card is the only selected state and clicking another card does not change it", async ({
    page,
  }, testInfo) => {
    const setup = new AdvertiserSetupPage(page);
    await setup.goto();
    await setup.goToIntroduction();
    await setup.continueButton.click();
    await expect(setup.planCard("Self-Managed")).toBeVisible({ timeout: 30_000 });

    // The current plan is marked by its ENROLLED action; the others offer
    // CONTACT US (a sales request — deliberately not clicked).
    await expect(setup.planAction("Self-Managed")).toHaveText(/enrolled/i);
    for (const plan of ["Relationship Package", "Relationship + Package"] as const) {
      await expect(setup.planAction(plan), `${plan} action`).toHaveText(/contact us/i);
      await expect(setup.planAction(plan)).toBeEnabled();
    }
    await expect(setup.enrolledBadge).toHaveCount(1);

    // Observed on staging 2026-09-25: the cards carry no selectable state
    // (no radio, aria-pressed or "selected" class); clicking one leaves the
    // markup untouched. Evidence is attached for the checklist.
    const before = await setup.planCardRoot("Relationship Package").getAttribute("class");
    await setup.planCard("Relationship Package").click();
    await page.waitForTimeout(500);
    await expect(setup.planCardRoot("Relationship Package")).toHaveAttribute("class", before!);
    await expect(setup.planAction("Self-Managed")).toHaveText(/enrolled/i);
    await expect(setup.planAction("Relationship Package")).toHaveText(/contact us/i);
    await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0);

    const screenshot = testInfo.outputPath("select-a-plan.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach("select-a-plan", { path: screenshot, contentType: "image/png" });
    testInfo.annotations.push({
      type: "absent",
      description: `Plan cards are not selectable (ENROLLED badge / CONTACT US only). Evidence: ${screenshot}`,
    });
  });

  test("Create a Program step carries the program form, logo, defaults, approval criteria and keywords", async ({
    page,
  }) => {
    const setup = await openProgramStep(page);

    for (const tab of PROGRAM_TABS) {
      await expect(setup.programTab(tab), `tab "${tab}" missing`).toBeVisible({
        timeout: 30_000,
      });
    }

    // General
    await expect(setup.programField("programName")).not.toHaveValue("");
    await expect(setup.programField("domainUrl")).toHaveValue(/^https?:\/\//);
    await expect(setup.programField("category")).not.toHaveValue("");
    await expect(setup.programField("country")).not.toHaveValue("");
    await expect(setup.programField("programDescription")).not.toHaveValue("");
    await expect(page.getByText("Program Logo *").first()).toBeVisible();
    await expect(setup.logoInputs).toHaveCount(2);

    // Program defaults
    await setup.programTab("PROGRAM DEFAULTS").click();
    await expect(setup.programField("commissionAmount")).toBeVisible();
    await expect(setup.programField("cookieDuration")).toBeVisible();
    await expect(setup.programField("defaultLandingUrl")).toHaveValue(/^https?:\/\//);

    // Publisher approval criteria
    await setup.programTab("PUBLISHER APPROVAL CRITERIA").click();
    await expect(setup.programField("automatedProcess")).toBeAttached();
    await expect(setup.programField("manualProcess")).toBeAttached();
    await expect(
      page.getByText("Manual Review", { exact: true }).first(),
    ).toBeVisible();

    // Search keywords
    await setup.programTab("SEARCH KEYWORDS").click();
    await expect(setup.programField("searchTag")).toBeVisible();
  });

  test("Create a Program edits the account's existing first program, so the step is never saved", async ({
    page,
  }) => {
    const setup = new AdvertiserSetupPage(page);
    await setup.goto();
    await setup.goToIntroduction();
    await setup.continueButton.click();
    await expect(setup.planCard("Self-Managed")).toBeVisible({ timeout: 30_000 });

    // Entering the step loads a specific, existing program — the proof that
    // CONTINUE would update it rather than create a new one.
    const loaded = page.waitForResponse(
      (r) => /\/api\/\d+\/programs\/\d+$/.test(r.url()) && r.request().method() === "GET",
    );
    await setup.continueButton.click();
    const response = await loaded;
    const programId = response.url().match(/\/programs\/(\d+)$/)![1];
    expect(response.status()).toBe(200);
    const program = await response.json();
    const name: string = program?.programName ?? program?.name ?? program?.result?.programName ?? "";
    console.log(`Create a Program step loaded program ${programId} "${name}"`);

    await expect(setup.programTab("GENERAL")).toBeVisible({ timeout: 30_000 });
    await expect(setup.programField("programName")).not.toHaveValue("");
    if (name) await expect(setup.programField("programName")).toHaveValue(name);
    await expect(setup.continueButton).toBeVisible();
    await expect(setup.continueButton).toHaveAttribute("type", "submit");
  });

  test("both program logos accept a generated PNG and show its preview without saving", async ({
    page,
  }) => {
    const setup = await openProgramStep(page);

    // Nothing here may write: every POST/PUT/PATCH to the programs API is
    // recorded and asserted absent at the end.
    const writes: string[] = [];
    page.on("request", (r) => {
      if (/\/api\/\d+\/programs/i.test(r.url()) && /^(POST|PUT|PATCH|DELETE)$/.test(r.method())) {
        writes.push(`${r.method()} ${r.url()}`);
      }
    });

    for (const logo of Object.keys(PROGRAM_LOGOS) as ProgramLogo[]) {
      const preview = setup.logoPreview(logo);
      await expect(preview, `${logo} preview`).toBeVisible();
      const before = await preview.getAttribute("src");

      const file = await generatedPng(page, logo);
      await setup.chooseLogo(logo, file);

      // The form previews the chosen file as an object URL, replacing the
      // stored logo's data: URL.
      await expect(preview, `${logo} preview after choosing ${file.name}`).toHaveAttribute(
        "src",
        /^blob:/,
        { timeout: 15_000 },
      );
      expect(await preview.getAttribute("src")).not.toBe(before);
      expect(
        await setup.logoInput(logo).evaluate((input: HTMLInputElement) => input.files?.[0]?.name),
      ).toBe(file.name);
      await expect(
        page.getByText(/invalid|not allowed|dimension.*(must|should)/i),
        `${logo} rejected the generated PNG`,
      ).toHaveCount(0);
    }

    await page.waitForTimeout(1_000);
    expect(writes, "the logo choice must not save the program").toEqual([]);
    // Deliberately no CONTINUE: it would submit the live program.
  });
});
