import { APIResponse, Page, expect, test } from "@playwright/test";
import { AUTH_FILE, appUrl } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";

/**
 * Reporting → Web Services: the API-key table and the embedded Swagger
 * documentation, then real GETs against SalesReport / ClickReport with the
 * "All Programs" key — directly and through the Swagger "Try it out" UI.
 * Read-only — keys are never regenerated.
 *
 * SOAP: the page only *mentions* the SOAP web service in its intro copy
 * ("FuseTwo now offers a RESTful Web API that is meant to eventually replace
 * our SOAP-based Web Service"); it offers no SOAP/WSDL link, so that check is
 * skipped with evidence attached (see the SOAP test below).
 */
test.describe("Reporting - Web Services API", () => {
  test.use({ storageState: AUTH_FILE });

  const GUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

  async function openWebServices(page: Page) {
    await page.goto(appUrl("/app/reports/webservices"), { waitUntil: "domcontentloaded" });
    await dismissPaymentReminderIfPresent(page);
    await expect(page.locator(".opblock-summary").first()).toBeVisible({ timeout: 60_000 });
  }

  /** The All Programs key and the advertiser id used in the Swagger paths. */
  async function readCredentials(page: Page) {
    const allPrograms = page.locator("tbody tr").filter({ hasText: "All Programs" }).first();
    await expect(allPrograms).toBeVisible({ timeout: 30_000 });
    const cells = await allPrograms.locator("td").allInnerTexts();
    const apiKey = cells.map((c) => c.trim()).find((c) => GUID.test(c));
    expect(apiKey, "All Programs API key not shown").toBeTruthy();
    const path = await page.locator(".opblock-summary-path").first().innerText();
    const advertiserId = path.match(/\/(\d+)\//)?.[1];
    expect(advertiserId, `advertiser id not in swagger path "${path}"`).toBeTruthy();
    return { apiKey: apiKey!, advertiserId: advertiserId! };
  }

  /**
   * GET with the API key. Swagger's Authorize sends the bare key as the
   * Authorization header (no "Bearer" prefix); the Bearer form is kept as a
   * fallback in case the scheme changes.
   */
  async function keyedGet(page: Page, url: string, apiKey: string): Promise<APIResponse> {
    let response = await page.request.get(url, {
      headers: { Authorization: apiKey, Accept: "application/json" },
      failOnStatusCode: false,
    });
    if (response.status() === 401) {
      response = await page.request.get(url, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        failOnStatusCode: false,
      });
    }
    return response;
  }

  /** The rows of a report body (SalesReport → reportDetails, ClickReport → clickDetailed). */
  function rowsOf(body: unknown): Record<string, unknown>[] {
    if (Array.isArray(body)) return body;
    const b = (body ?? {}) as Record<string, unknown>;
    const rows = b.reportDetails ?? b.clickDetailed ?? b.result ?? b.data ?? b.records;
    return Array.isArray(rows) ? rows : [];
  }

  function isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /** From the first of the month six months back up to today. */
  function reportWindow() {
    const start = new Date();
    start.setMonth(start.getMonth() - 6, 1);
    return { startDate: isoDate(start), endDate: isoDate(new Date()) };
  }

  test("API key table and Swagger docs list both endpoints with their parameters @blocker", async ({
    page,
  }) => {
    await openWebServices(page);
    for (const header of ["Select Key", "Program ID", "Program Name", "API Key", "Actions"]) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
    }
    const allPrograms = page.locator("tbody tr").filter({ hasText: "All Programs" }).first();
    await expect(allPrograms.getByRole("button", { name: /^Copy$/i })).toBeVisible();
    await expect(allPrograms.getByRole("button", { name: /Regenerate Key/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Generate Key$/i }).first()).toBeVisible();

    await expect(page.getByText(/FuseTwo API 3\.0\.0/)).toBeVisible();
    await expect(page.getByText(/Base URL:\s*\/api/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Authorize/ })).toBeVisible();
    for (const op of ["SalesReport", "ClickReport"]) {
      await expect(page.locator(".opblock-summary").filter({ hasText: op })).toBeVisible();
    }

    await page.locator(".opblock-summary").filter({ hasText: "SalesReport" }).click();
    const open = page.locator(".opblock.is-open").first();
    for (const param of ["startDate", "endDate", "programID", "domainID", "page", "pageSize", "orderBy", "sortBy"]) {
      await expect(open.locator("tr[data-param-name], .parameters tbody tr").filter({ hasText: param }).first(), `parameter ${param}`).toBeVisible();
    }
    await expect(open).toContainText(/yyyy-MM-dd/);
    await expect(open).toContainText(/between 1 and 1000/);
    for (const code of ["200", "204", "400", "401", "403", "404", "429", "500"]) {
      await expect(open.locator(".responses-table, .responses-wrapper").getByText(code, { exact: true }).first()).toBeVisible();
    }
    for (const type of ["application/xml", "application/json", "text/csv"]) {
      await expect(open).toContainText(type);
    }
  });

  test("SOAP: the page mentions the SOAP web service; a SOAP/WSDL link is asserted only when one is offered", async ({
    page,
  }, testInfo) => {
    await openWebServices(page);
    const pageText = await page.locator("body").innerText();
    await expect(page.getByText(/SOAP-based Web Service/i).first()).toBeVisible();

    // Evidence of what the page offers, whichever way the link check goes.
    const screenshot = testInfo.outputPath("webservices-page.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach("webservices-page", { path: screenshot, contentType: "image/png" });
    await testInfo.attach("webservices-page-text", { body: pageText, contentType: "text/plain" });

    const soapLinks = (
      await page.locator("a[href]").evaluateAll((anchors) =>
        anchors.map((a) => ({ text: (a.textContent ?? "").trim(), href: (a as HTMLAnchorElement).href })),
      )
    ).filter(({ text, href }) => /soap|wsdl|\.asmx|\.svc/i.test(`${text} ${href}`));
    console.log(`SOAP links on the page: ${JSON.stringify(soapLinks)} (screenshot: ${screenshot})`);

    if (soapLinks.length) {
      // A SOAP option is offered: it must answer with a WSDL / service page.
      for (const { href } of soapLinks) {
        const response = await page.request.get(href, { failOnStatusCode: false });
        expect(response.status(), `${href} answered ${response.status()}`).toBe(200);
        expect(await response.text()).toMatch(/wsdl|definitions|soap|Web Service/i);
      }
      return;
    }

    // Observed on staging 2026-09-25: SOAP appears only in the intro copy
    // ("...using REST, SOAP, PHP, and ASP..." / "...replace our SOAP-based Web
    // Service"). There is no SOAP/WSDL link, button or endpoint on the page, so
    // the "SOAP option opens" assertion cannot be exercised and is skipped.
    testInfo.annotations.push({
      type: "absent",
      description: `No SOAP/WSDL link on Web Services; only prose mentions. Evidence: ${screenshot}`,
    });
    expect(pageText).toMatch(/REST, SOAP, PHP, and ASP/i);
    test.skip(true, "The Web Services page offers no SOAP/WSDL link — only REST/Swagger (evidence attached)");
  });

  test("SalesReport and ClickReport answer a keyed request with report data @blocker", async ({
    page,
  }) => {
    await openWebServices(page);
    const { apiKey, advertiserId } = await readCredentials(page);
    const { startDate, endDate } = reportWindow();

    for (const report of ["SalesReport", "ClickReport"]) {
      const url = appUrl(
        `/api/${advertiserId}/${report}?startDate=${startDate}&endDate=${endDate}&page=1&pageSize=50`,
      );
      const response = await keyedGet(page, url, apiKey);
      console.log(`${report}: HTTP ${response.status()}`);
      expect([200, 204], `${report} returned ${response.status()}`).toContain(response.status());
      if (response.status() === 200) {
        const body = await response.json();
        const records = rowsOf(body);
        expect(records, `${report} body: ${JSON.stringify(body).slice(0, 200)}`).toBeTruthy();
        expect(records.length, `${report} honours pageSize=50`).toBeLessThanOrEqual(50);
        if (records.length) {
          expect(Object.keys(records[0]).join(",")).toMatch(/sale|order|click|commission|program|domain/i);
        }
      }
    }
  });

  test("keyed requests honour pageSize and filter by programID and domainID @blocker", async ({
    page,
  }) => {
    await openWebServices(page);
    const { apiKey, advertiserId } = await readCredentials(page);
    const { startDate, endDate } = reportWindow();

    for (const report of ["SalesReport", "ClickReport"]) {
      const base = `/api/${advertiserId}/${report}?startDate=${startDate}&endDate=${endDate}`;

      // Unfiltered first page: tells us which program / domain actually has
      // rows in the window, so the filtered requests below cannot be vacuous.
      const all = await keyedGet(page, appUrl(`${base}&page=1&pageSize=10`), apiKey);
      expect([200, 204], `${report} returned ${all.status()}`).toContain(all.status());
      if (all.status() === 204) {
        console.log(`${report}: no rows between ${startDate} and ${endDate}, filter assertions skipped`);
        continue;
      }
      const allBody = await all.json();
      const allRows = rowsOf(allBody);
      expect(allRows.length, `${report} pageSize=10`).toBeLessThanOrEqual(10);
      expect(allRows.length, `${report} returned 200 without rows`).toBeGreaterThan(0);
      if (typeof allBody.totalCount === "number") {
        expect(allBody.totalCount).toBeGreaterThanOrEqual(allRows.length);
      }
      const programId = Number(allRows[0].programId);
      const domainId = Number(allRows[0].domainId);
      expect(programId, `${report} row has no programId: ${JSON.stringify(allRows[0])}`).toBeGreaterThan(0);

      // pageSize=1 → at most one record.
      const one = await keyedGet(page, appUrl(`${base}&page=1&pageSize=1`), apiKey);
      expect(one.status()).toBe(200);
      const oneRows = rowsOf(await one.json());
      expect(oneRows.length, `${report} pageSize=1 returned ${oneRows.length} rows`).toBeLessThanOrEqual(1);
      expect(oneRows.length).toBe(1);

      // programID → every row carries the program asked for.
      const byProgram = await keyedGet(
        page,
        appUrl(`${base}&programID=${programId}&page=1&pageSize=5`),
        apiKey,
      );
      expect(byProgram.status(), `${report} programID=${programId}`).toBe(200);
      const programRows = rowsOf(await byProgram.json());
      expect(programRows.length).toBeGreaterThan(0);
      expect(programRows.length).toBeLessThanOrEqual(5);
      for (const row of programRows) {
        expect(Number(row.programId), `${report} row ${JSON.stringify(row)}`).toBe(programId);
      }

      // domainID is documented for both reports; combine it with the program.
      if (domainId > 0) {
        const byDomain = await keyedGet(
          page,
          appUrl(`${base}&programID=${programId}&domainID=${domainId}&page=1&pageSize=5`),
          apiKey,
        );
        expect(byDomain.status(), `${report} domainID=${domainId}`).toBe(200);
        const domainRows = rowsOf(await byDomain.json());
        expect(domainRows.length).toBeGreaterThan(0);
        for (const row of domainRows) {
          expect(Number(row.programId)).toBe(programId);
          expect(Number(row.domainId)).toBe(domainId);
        }
      }
      console.log(`${report}: programID=${programId} domainID=${domainId} rows=${programRows.length}`);
    }
  });

  test("Swagger UI: Authorize → Try it out → Execute shows a 200 response @blocker", async ({
    page,
  }) => {
    await openWebServices(page);
    const { apiKey, advertiserId } = await readCredentials(page);
    const { startDate } = reportWindow();

    // Authorize with the All Programs key (apiKey scheme, header "Authorization").
    await page.getByRole("button", { name: /^Authorize/ }).first().click();
    const authModal = page.locator(".modal-ux");
    await expect(authModal).toBeVisible({ timeout: 15_000 });
    await expect(authModal).toContainText(/Name:\s*Authorization/);
    await expect(authModal).toContainText(/In:\s*header/);
    await authModal.locator("#api_key_value").fill(apiKey);
    // The submit reads "Authorize" but is labelled aria-label="Apply credentials".
    await authModal.getByRole("button", { name: "Apply credentials" }).click();
    await expect(authModal).toContainText("Authorized");
    await authModal.locator("button.btn-done").click();
    await expect(authModal).toBeHidden();

    // Try it out on SalesReport with a one-row page.
    await page.locator(".opblock-summary").filter({ hasText: "SalesReport" }).click();
    const open = page.locator(".opblock.is-open").first();
    await open.locator(".try-out__btn").click();
    await open.locator('input[placeholder="startDate"]').fill(startDate);
    await open.locator('input[placeholder="pageSize"]').fill("1");

    const sent = page.waitForRequest((r) => r.url().includes(`/api/${advertiserId}/SalesReport`));
    await open.locator("button.execute").click();
    const request = await sent;
    expect(request.headers()["authorization"]).toBe(apiKey);
    expect(request.url()).toContain("pageSize=1");

    const live = open.locator(".live-responses-table");
    await expect(live).toBeVisible({ timeout: 60_000 });
    // The header cell ("Code") shares the class, so read the body row's cell.
    await expect(live.locator("tbody tr.response .response-col_status").first()).toHaveText("200", {
      timeout: 60_000,
    });
    await expect(live).toContainText(/SaleReportResponse|reportDetails|TotalCount|totalCount/i);
    await expect(open.locator(".curl")).toContainText(`/api/${advertiserId}/SalesReport`);
  });

  test("a request without an API key is rejected with 401", async ({ page }) => {
    await openWebServices(page);
    const { advertiserId } = await readCredentials(page);
    const response = await page.request.get(
      appUrl(`/api/${advertiserId}/SalesReport?startDate=2026-01-01&pageSize=10`),
      { failOnStatusCode: false },
    );
    expect(response.status()).toBe(401);
  });
});
