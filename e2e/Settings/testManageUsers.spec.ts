import { expect, Page, test } from "@playwright/test";
import { AUTH_FILE, appUrl } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";
import { uniqueSignupEmail } from "../../fixtures/onboardingData";

/**
 * Settings → Manage Users: the user list with roles and statuses, adding an
 * Associate sub-user, and opening a user's account page from the row pencil.
 * @write — sub-users cannot be deleted by a non-owner (see prod report bug),
 * so each run leaves one Pending "QA Sub …" user.
 *
 * Editing: the pencil opens /app/settings/manageuseraccount/update/<email>,
 * a "User Account" form with Status chip, Role select, name / phone / e-mail
 * and SAVE CHANGES — but it states "Only the account owner can edit this
 * page", renders the form with pointer-events: none and keeps SAVE CHANGES
 * disabled. The test login (playwright@fusetwo.com, Admin) is not the account
 * owner (localStorage isAccountOwner=false; the owner is another user), so
 * role / status changes cannot be exercised from this account. The list row
 * offers nothing else (no status toggle, no delete). What the UI does offer
 * to a non-owner admin — read the details — is covered below.
 */
test.describe("Settings - Manage Users", () => {
  test.use({ storageState: AUTH_FILE });

  const ROLES = ["Associate", "Admin", "Manager", "Agency Admin", "Agency Manager", "Agency Associate"];
  const USERS_PATH = "/app/settings/users";

  /** Open the list and widen the page so every user is on screen. */
  async function openUsers(page: Page) {
    await page.goto(appUrl(USERS_PATH), { waitUntil: "domcontentloaded" });
    await dismissPaymentReminderIfPresent(page);
    // The table shows a "No records available" placeholder row until the
    // users load, so wait for a row that carries an e-mail address.
    const rows = page.locator("tbody tr:visible").filter({ hasText: "@" });
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Rows per page").first().selectOption("50");
    await page.waitForTimeout(2_000);
    return rows;
  }

  test("lists existing users with email, role and status @smoke", async ({
    page,
  }) => {
    await page.goto(appUrl(USERS_PATH), { waitUntil: "domcontentloaded" });
    await dismissPaymentReminderIfPresent(page);

    for (const h of ["Name", "Email", "User Since", "Logins", "Last Login", "Role", "Status", "Actions"]) {
      await expect(page.getByRole("columnheader", { name: h }).first()).toBeVisible({
        timeout: 30_000,
      });
    }
    // The table shows a "No records available" placeholder row until the
    // users load, so wait for a row that carries an e-mail address.
    const rows = page.locator("tbody tr:visible").filter({ hasText: "@" });
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    const first = await rows.first().locator("td").allInnerTexts();
    expect(first.join(" ")).toMatch(/@/);
    expect(first.join(" ")).toMatch(new RegExp(ROLES.join("|")));
    expect(first.join(" ")).toMatch(/Active|Pending|Inactive|Deactivated|Deleted/i);
    await expect(page.getByRole("button", { name: /Add User/i })).toBeVisible();
  });

  test("Add User creates an Associate sub-user that appears as Pending @write @crud", async ({
    page,
  }) => {
    await page.goto(appUrl(USERS_PATH), { waitUntil: "domcontentloaded" });
    await dismissPaymentReminderIfPresent(page);
    await page.getByRole("button", { name: /Add User/i }).click();
    await expect(page.locator("#mui-component-select-role")).toBeVisible({ timeout: 30_000 });

    await page.locator("#mui-component-select-role").click();
    const roles = (await page.getByRole("option").allInnerTexts()).map((r) => r.trim());
    expect(roles).toEqual(expect.arrayContaining(ROLES));
    await page.getByRole("option", { name: "Associate", exact: true }).click();

    const email = uniqueSignupEmail();
    const last = `Sub${Date.now().toString().slice(-6)}`;
    await page.locator('input[name="firstName"]').fill("QA");
    await page.locator('input[name="lastName"]').fill(last);
    await page.locator('input[name="phone"]').fill("6175550177");
    await page.locator('input[name="emailAddress"]').fill(email);
    await page.getByRole("button", { name: /^Add User$/i }).click();

    // The form carries a static "An activation email will be sent…" alert, so
    // match the success toast by its text.
    await expect(
      page.getByRole("alert").filter({ hasText: /created user successfully/i }),
    ).toBeVisible({ timeout: 30_000 });
    await page.goto(appUrl(USERS_PATH), { waitUntil: "domcontentloaded" });
    await dismissPaymentReminderIfPresent(page);
    // The list is paginated (10 per page by default) and not sorted by
    // creation date, so widen the page and walk the pages until the row shows.
    const row = page.locator("tbody tr:visible").filter({ hasText: email });
    await page.getByLabel("Rows per page").first().selectOption("50");
    await page.waitForTimeout(2_000);
    for (let i = 0; i < 10 && !(await row.first().isVisible().catch(() => false)); i++) {
      const next = page.getByRole("button", { name: /next page/i });
      if (!(await next.isEnabled().catch(() => false))) break;
      await next.click();
      await page.waitForTimeout(1_500);
    }
    await expect(row.first()).toBeVisible({ timeout: 30_000 });
    await expect(row.first()).toContainText("Associate");
    await expect(row.first()).toContainText(/Pending/i);
    console.log(`created sub-user ${email}`);
  });

  test("the row pencil opens the user's account page with the listed email, role and status, read-only for a non-owner", async ({
    page,
  }) => {
    const rows = await openUsers(page);

    // Any user other than the signed-in account, with a plain address: e-mails
    // containing "+" cannot be opened today (see the @known-bug below).
    const count = await rows.count();
    let picked: { row: ReturnType<typeof rows.nth>; name: string; email: string; role: string; status: string } | undefined;
    for (let i = 0; i < count && !picked; i++) {
      const cells = (await rows.nth(i).locator("td").allInnerTexts()).map((c) => c.trim());
      if (cells[1].includes("+") || /^playwright@fusetwo\.com$/i.test(cells[1])) continue;
      picked = { row: rows.nth(i), name: cells[0], email: cells[1], role: cells[5], status: cells[6] };
    }
    expect(picked, "no plain-address user to open").toBeTruthy();
    if (!picked) return;
    console.log(`opening ${picked.email} (${picked.role}, ${picked.status})`);

    // The only control in the Actions cell is the edit pencil.
    await picked.row.locator("button").first().click();
    await page.waitForURL(/\/settings\/manageuseraccount\/update\//, { timeout: 30_000 });
    expect(decodeURIComponent(page.url())).toContain(`/manageuseraccount/update/${picked.email}`);

    await expect(page.getByRole("heading", { name: /User Account/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('input[name="emailAddress"]')).toHaveValue(picked.email, {
      timeout: 30_000,
    });
    await expect(page.locator("#mui-component-select-role")).toHaveText(picked.role);
    await expect(page.locator(".MuiChip-label").first()).toHaveText(picked.status);
    const fullName = [
      await page.locator('input[name="firstName"]').inputValue(),
      await page.locator('input[name="lastName"]').inputValue(),
    ]
      .join(" ")
      .trim();
    expect(fullName).toBe(picked.name);
    // Fields that were listed are shown (values may be blank on old records).
    await expect(page.locator('input[name="phone"]')).toBeVisible();

    // Non-owner admins get a read-only page: notice, inert form, Save disabled.
    const isOwner = await page.evaluate(() => localStorage.getItem("isAccountOwner") === "true");
    if (!isOwner) {
      await expect(page.getByText(/Only the account owner can edit this page/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /Save Changes/i })).toBeDisabled();
      expect(
        await page.locator("form").first().evaluate((form) => getComputedStyle(form).pointerEvents),
        "form should be inert for a non-owner",
      ).toBe("none");
      // The Role select cannot be opened either.
      await page.locator("#mui-component-select-role").click({ force: true });
      await expect(page.getByRole("option")).toHaveCount(0);
    } else {
      console.log("signed in as the account owner: the page is editable, skipping read-only checks");
    }
  });

  // Found 2026-09-25 on staging: for a user whose e-mail contains "+" (every
  // QA sub-user this suite creates, e.g. syed.shah+auto…@flexoffers.com) the
  // pencil navigates to /app/settings/manageuseraccount/update/<email>, but
  // the page's GET /api/<advertiserId>/manageusers/<email> answers 404, a red
  // error snackbar shows and every field stays empty — the user can never be
  // viewed or edited. Plain addresses load fine. Not yet reported.
  test("a plus-addressed QA sub-user can be opened from the row pencil @known-bug", async ({
    page,
  }) => {
    const rows = await openUsers(page);
    const row = rows.filter({ hasText: "syed.shah+auto" }).first();
    test.skip(!(await row.isVisible().catch(() => false)), "no QA sub-user on this account");
    const email = (await row.locator("td").nth(1).innerText()).trim();
    const role = (await row.locator("td").nth(5).innerText()).trim();

    await row.locator("button").first().click();
    await page.waitForURL(/\/settings\/manageuseraccount\/update\//, { timeout: 30_000 });
    await expect(page.locator('input[name="emailAddress"]')).toHaveValue(email, {
      timeout: 30_000,
    });
    await expect(page.locator("#mui-component-select-role")).toHaveText(role);
  });
});
