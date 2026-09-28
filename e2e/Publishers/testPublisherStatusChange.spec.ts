import { expect, test } from "@playwright/test";
import PublisherListPage from "../../pages/PublisherListPage";
import { AUTH_FILE } from "../../config/environment";

/**
 * Publisher List → search a publisher → select it → Change Status → status +
 * reason → OK → the application moves to the new status tab. The change is
 * then reverted so the account's publisher relationships end as they
 * started. @write.
 *
 * Search: the table view has no search box, so the publisher lookup goes
 * through the card view's Filters panel (Publisher ID / Publisher Name →
 * FILTER), which filters server-side. Once a test has been in the card view
 * it stays there for every later lookup, because the table view loses its
 * columns afterwards (see the @known-bug test at the end).
 */
test.describe("Publishers - change status @write", () => {
  test.use({ storageState: AUTH_FILE });
  test.setTimeout(4 * 60 * 1000);

  test("a searched publisher can be deactivated with a reason and re-approved @blocker @crud", async ({
    page,
  }) => {
    const publishers = new PublisherListPage(page);
    await publishers.goto();

    await publishers.openTab("Approved");
    const approvedBefore = await publishers.tabCount("Approved");
    const deactivatedBefore = await publishers.tabCount("Deactivated");
    const row = publishers.rows().first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    const app = await publishers.identify(row);
    console.log(`publisher ${app.publisherId} (${app.publisher}) on program ${app.programId}`);

    // Search by publisher id: every result is that publisher, and the set is
    // narrower than the whole tab.
    await publishers.search({ publisherId: app.publisherId });
    const found = await publishers.resultCount();
    expect(found, "search returned nothing").toBeGreaterThan(0);
    expect(found, "search did not narrow the list").toBeLessThan(approvedBefore);
    const ids = await publishers.cardIds().allInnerTexts();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.map((id) => id.trim())).toEqual(ids.map(() => app.publisherId));
    const card = publishers.card(app.publisherId, app.programId).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText(app.publisher);

    // Approved → Deactivated, from the searched card.
    const reason = "QA automation status change";
    await publishers.select(card);
    const submitted = await publishers.changeStatus("Deactivated", reason);
    expect(submitted, "no request carried the reason").toBeTruthy();
    console.log(`status change sent to ${submitted?.url}: ${submitted?.body}`);

    await publishers.goto();
    expect(await publishers.tabCount("Approved")).toBe(approvedBefore - 1);
    expect(await publishers.tabCount("Deactivated")).toBe(deactivatedBefore + 1);
    await publishers.openTab("Deactivated");
    await publishers.search({ publisherId: app.publisherId });
    const moved = publishers.card(app.publisherId, app.programId).first();
    await expect(moved, "application not listed under Deactivated").toBeVisible({
      timeout: 30_000,
    });
    // The reason is stored server-side only: the listing has no reason column
    // (Show/Hide Columns lists none), no cell tooltip, no row detail view, and
    // get-publishers-paged returns no reason field. If it ever surfaces here,
    // this trips so the check can be turned into a real assertion.
    expect(
      await page.getByText(reason, { exact: true }).count(),
      "the reason is now displayed in the listing - assert it properly",
    ).toBe(0);

    // Revert: Deactivated → Approved
    await publishers.select(moved);
    await publishers.changeStatus("Approved", "QA automation revert");
    await publishers.goto();
    expect(await publishers.tabCount("Approved")).toBe(approvedBefore);
    expect(await publishers.tabCount("Deactivated")).toBe(deactivatedBefore);
    await publishers.openTab("Approved");
    await publishers.search({ publisherId: app.publisherId });
    await expect(
      publishers.card(app.publisherId, app.programId).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("the publisher search filters the list by id and by name", async ({
    page,
  }) => {
    const publishers = new PublisherListPage(page);
    await publishers.goto();
    await publishers.openTab("Approved");
    const total = await publishers.tabCount("Approved");
    const app = await publishers.identify(publishers.rows().first());

    await publishers.search({ publisherId: app.publisherId });
    const byId = await publishers.resultCount();
    expect(byId).toBeGreaterThan(0);
    expect(byId).toBeLessThan(total);
    for (const id of await publishers.cardIds().allInnerTexts()) {
      expect(id.trim()).toBe(app.publisherId);
    }
    // The result set carries over to the table view (row contents cannot be
    // checked there today — see the @known-bug test).
    await publishers.openTableView();
    expect(await publishers.resultCount()).toBe(byId);

    await publishers.openCardView();
    await publishers.resetSearch();
    expect(await publishers.resultCount()).toBe(total);

    await publishers.search({ publisherName: app.publisher });
    const byName = await publishers.resultCount();
    expect(byName).toBeGreaterThanOrEqual(byId);
    expect(byName).toBeLessThan(total);
    const card = publishers.card(app.publisherId, app.programId).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText(app.publisher);
  });

  test("the Change Status dialog offers every publisher status", async ({
    page,
  }) => {
    const publishers = new PublisherListPage(page);
    await publishers.goto();
    await publishers.openTab("Approved");
    await publishers.select(publishers.rows().first());
    await publishers.changeStatusButton.click();
    await expect(publishers.dialog).toBeVisible();
    await publishers.statusField.click();
    const options = await page.getByRole("option").allInnerTexts();
    expect(options.map((o) => o.trim())).toEqual(
      expect.arrayContaining(["Approved", "Pending", "Deactivated", "Declined", "Pre-Approved"]),
    );
    await page.keyboard.press("Escape");
    await publishers.dialog.getByRole("button", { name: /^Close$/i }).click();
    await expect(publishers.dialog).toBeHidden();
  });

  // Found 2026-09-25 on staging: after the card view has been opened, going
  // back to the table view shows only the Promotional Methods and Groups
  // columns — Show/Hide Columns lists every other column as switched off —
  // and a plain reload does not restore them (only clearing the persisted
  // "<firstName>_publisherList" column preference does). Not yet reported.
  test("the table keeps its columns after a visit to the card view @known-bug", async ({
    page,
  }) => {
    const publishers = new PublisherListPage(page);
    await publishers.goto();
    await publishers.openTab("Approved");
    const before = await publishers.visibleColumns();
    expect(before).toEqual(expect.arrayContaining(["Publisher ID", "Publisher", "Program ID", "Program Name"]));

    await publishers.openCardView();
    await publishers.openTableView();
    await page.waitForTimeout(1_000);
    expect(await publishers.visibleColumns()).toEqual(before);
  });
});
