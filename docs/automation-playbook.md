# Automation playbook

Working notes for anyone (human or the daily explorer agent) adding tests to
this repo. Everything here was learned the hard way on staging/prod in
September 2026; check it before debugging "element not found" for an hour.

## Toolchain (Syed's QA laptop)

- Node is a portable install, not on PATH by default:
  `C:\Users\Syed.Shah\AppData\Local\Programs\node\node-v24.19.0-win-x64`.
  In an interactive shell every command needs
  `$env:Path += ";$env:LOCALAPPDATA\Programs\node\node-v24.19.0-win-x64"` first.
  The scheduled scripts (`daily_*.cmd`, `daily_explorer.ps1`)
  set PATH and TEST_ENV themselves, so inside them run commands plainly.
- Playwright is **1.45.3**: there is no `locator.filter({ visible })`; use the
  `:visible` CSS pseudo-class. `test.use({ screenshot })` inside a describe is
  rejected; take screenshots explicitly with `testInfo.outputPath`.
- No `tsconfig.json`; type-check with
  `npx -y -p typescript@5 tsc --noEmit --skipLibCheck --target es2020 --module commonjs --moduleResolution node --esModuleInterop <files>`.
  One pre-existing error in `e2e/Onboarding/testStatusEmail.spec.ts:136` is harmless.
- Playwright wipes its `--output` dir at the start of each run. Always pass a
  private `--output=test-results/<name>` so parallel/scheduled runs don't erase
  each other. Never write anything you want to keep under `test-results/`.
- Run a spec on staging (writes allowed there):
  `$env:TEST_ENV="staging"; npx playwright test e2e/<Module>/<file>.spec.ts --project=chromium --reporter=list --output=test-results/<name>`
  Accounting specs use `--project=accounting`; new explorer scenarios `--project=review`.
- Only staging is for unattended runs. Prod runs are deliberate and manual.

## Environments and accounts

- Staging advertiser app `https://advertiserstg.fusetwo.com`, prod
  `https://advertiser.fusetwo.com`; management `management.stg.fusetwo.com`
  (Windows SSO, Chromium allowlisted in `playwright.config.ts`); marketing
  website `www.staging.fusetwo.com` / `www.fusetwo.com` (`websiteUrl()`).
- Test account 1062551 (`playwright@fusetwo.com`), signed-in state per env in
  `playwright/.auth/advertiser.<env>.json` created by `e2e/Auth/auth.setup.ts`.
  It is **Admin but not the account owner**, so Manage Users role/status are
  read-only for it.
- Programs: staging `Test4302026` (249231) / `ApprovedDateTest` (coupon domain
  cakebrandusa.com); prod `TestADO921-9222026` (249442, domain
  testado9219222026.example.com). Use `fixtures/testConstants.ts`, never
  hard-code.
- Mailbox: plus-addressed `syed.shah+auto…@flexoffers.com`; read through
  `utility/mailbox.ts` (Outlook COM or Graph). Internal mailboxes such as
  Advertise@FuseTwo.com are not readable.

## App quirks that break locators

- A **Terms & Conditions modal** can cover every page after login and marks
  the app `aria-hidden`, so role locators report "not found". Use
  `gotoApp()` / `acceptTermsIfPresent()` from `utility/appActions.ts`;
  `dismissPaymentReminderIfPresent()` handles the payment banner.
- MUI tables render **hidden duplicate rows/headers** for other breakpoints
  (Publisher List, Reconcile Sales, Campaigns). Use `tbody tr:visible`.
- MUI selects: click `#mui-component-select-<name>`, read with `toHaveText`.
  Autocomplete inputs (security question, country, state, program) take the
  chosen option text as their value.
- Uppercase button/tab labels are CSS-only; match case-insensitively
  (`Continue`, `Back`, `General`).
- Time pickers (campaign/coupon Active/Expire Time) are read-only inputs with a
  clock dialog; `CampaignPage.pickTime` / `CouponsOffersPage.fillTimeInput`
  drive it by angle.
- Sales Details (Reconcile) opens from `svg[aria-label="view more"]`; Escape
  does not close it, use its X. The row pencil is the approve/deny menu.
- Campaign listing shows "No records available" until `GET /api/<acct>/campaigns`
  returns; wait for the response, not a timeout.
- Non-breaking spaces appear in count texts ("There are 1,666 publishers");
  match with `\s` in regexes.
- Deactivating a program moves it to status 5 "DeactivationRequested" (still
  under Active Programs); only status 3 "Deactivated" rows show REACTIVATE, and
  Reactivate files a real request into the management queue.

## Known open defects (guarded by `@known-bug`, do not re-file)

- Staging Tracking Diagnosis publisher links (`trackstg…/g.ashx`) return 500.
- `UploadReconciledSales` rejects the API Reconcile drawer's own Bearer token
  (401 audience validation) on staging.
- Signup "Required field*" helper shows on a pristine form (#686).
- Publisher List card view wipes the table's column selection (localStorage).
- Manage Users: users with `+` in the e-mail 404 on the account page.

## Conventions

- **Every test gets a scenario comment in Gherkin style**, directly above
  `test(...)`, so anyone can read what it covers without reading the code:

  ```ts
  /**
   * Scenario: a malformed Domain URL blocks step 1 even when everything else is valid
   *   Given I am on Add Program with every step-1 field filled correctly
   *   When I change Domain URL to "not a url" and leave the field
   *   Then Domain URL shows "Enter valid URL: https://example.com"
   *   And Continue is disabled again
   * Data: nothing is saved.
   */
  test("a malformed Domain URL blocks step 2 …", async ({ page }) => { … });
  ```

  Use `Scenario (corner case)` / `Scenario (security)` where it applies, keep
  Given/When/Then/And/But to one line each, and end with a `Data:` line
  (read-only / nothing saved / what is created and how it is cleaned up).
  Inside the test, short comments explain non-obvious steps (why a wait, why a
  workaround).

- Tags: `@blocker` release gate, `@smoke`, `@crud`, `@write` (mutates data,
  skipped on prod unless `ALLOW_WRITE_TESTS=true`), `@known-bug` (asserts the
  fixed behaviour, excluded from gating), `@security`.
- Page objects in `pages/`, helpers in `utility/`, data in `fixtures/`.
- Every test that creates data cleans up (deactivate / disable / revert) in
  the same spec, and uses a `testauto` / `QA` prefixed name.
- Never edit `playwright.config.ts` or `package.json` from an unattended run.
