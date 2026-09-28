# Advertiser Flow — Automation Coverage

Maps the 20-section advertiser flow (signup → tracking → creatives → coupons →
publishers → reconcile → API → reporting → settings) to the Playwright suites
that cover it. Verified on **staging** (`advertiserstg.fusetwo.com`, account
1062551) on 2026-09-24 unless noted.

**Status key:** ✅ passing · 🐞 guarded by `@known-bug` (fails until the defect is fixed) · ⏭ skips with reason

| # | Flow section | Spec(s) | Status |
|---|--------------|---------|--------|
| 1 | Advertiser signup (incl. agency Yes → brand URL, promo code, platform Other → platform name) | `e2e/Onboarding/testSignup.spec.ts` | ✅ |
| 2 | Email verification | `e2e/Onboarding/testEmailVerification.spec.ts` (needs mailbox) | ⏭ without mailbox |
| 3 | Management: search by **ID**, company/contact data, initial status, CRUD | `e2e/Onboarding/testManagementAdvertiserCrud.spec.ts` | ✅ |
| 4 | Login → dashboard → New Advertiser Setup from sidebar | `e2e/Settings/testAdvertiserSetupWizard.spec.ts` | ✅ |
| 5 | Setup wizard: Introduction → Select a Plan → Create a Program (5 tabs, logo, defaults, approval criteria, keywords) | `e2e/Settings/testAdvertiserSetupWizard.spec.ts` | ✅ (inspects; never saves over the first program) |
| 6 | Campaign with coupon code + chosen program, read back on edit page | `e2e/Campaigns/testCampaignCreate.spec.ts` | ✅ |
| 7 | Conversion Tracking: program → implementation script → integration parameters (Advertiser ID, order amount/number, coupon, currency, geo, commission id) + generated code | `e2e/Tracking/testConversionTracking.spec.ts` | ✅ |
| 8 | Tracking Diagnosis: test link, purchase steps, results table; test purchase → Success | `e2e/Tracking/testTrackingDiagnosis.spec.ts` | ✅ wizard · 🐞 purchase (staging `g.ashx` returns 500) |
| 9 | Browser-side conversion request (`da.ashx` URL, params, body, status) | `e2e/Tracking/testConversionRequest.spec.ts` | ✅ |
| 10 | Text link with each targeting option, success message, listed | `e2e/Creatives/testTextLinkTargeting.spec.ts` | ✅ |
| 11 | Coupon create (existing) + empty-Description negative | `e2e/Coupons/testCouponCreate.spec.ts`, `testCouponValidation.spec.ts` | ✅ |
| 12 | Publisher change status (Approved → Deactivated → Approved) | `e2e/Publishers/testPublisherStatusChange.spec.ts` | ✅ |
| 13 | Private offer create (Fixed) | `e2e/Publishers/testPrivateOffers.spec.ts` | ✅ |
| 14 | Reconcile Sales: tiles, Sales Details fields, sale-amount adjustment + revert | `e2e/Accounting/testReconcileSalesDetails.spec.ts` | ✅ |
| 15 | API Reconcile: drawer contract, Bearer token + tracking id, real POST, UI check, revert; unauthenticated rejected | `e2e/Accounting/testReconcileApi.spec.ts` | ✅ contract + rejection · 🐞 real POST (drawer token → 401 audience validation) |
| 16 | Sales Adjustment Notice e-mail | `e2e/Accounting/testSalesAdjustmentEmail.spec.ts` | ⏭ notice goes to the advertiser's own mailbox, which the suite cannot read |
| 17 | Sales Summary, Sales Detailed, Non-Comm Sales, Account Balance | `e2e/Reporting/testSalesAndBalanceReports.spec.ts` | ✅ |
| 18 | Web Services: key table, Swagger params/responses, live SalesReport + ClickReport calls, 401 without key | `e2e/Reporting/testWebServicesApi.spec.ts` | ✅ |
| 19 | Manage Users (list, Add User), Company Information + My Account persistence | `e2e/Settings/testManageUsers.spec.ts`, `testProfilePersistence.spec.ts` | ✅ |
| 20 | Conversion tracking code view | covered by section 7 | ✅ |

## Running

```powershell
npm run test:staging                 # day-to-day chromium project (Accounting excluded)
npm run test:accounting:staging      # Reconcile Sales UI + API suites (adjust + revert real sale amounts)
npm run known-bugs:staging           # the @known-bug guards (expected to fail while the bugs are open)
```

## Shared helpers added

- `utility/appActions.ts` — `acceptTermsIfPresent` / `installTermsAutoAccept`: the Terms & Conditions
  modal hides the whole app from role locators until accepted; `auth.setup.ts` accepts it once.
- `utility/trackingSimulator.ts` — serves a fake merchant landing/confirmation page that runs the real
  FuseTwo tracking library and posts to the real `da.ashx`.
- New page objects: `ConversionTrackingPage`, `TrackingDiagnosisPage`, `AdvertiserSetupPage`,
  `PublisherListPage`, `PrivateOffersPage`; extended `CampaignPage`, `CreativesPage`,
  `FlexOffersSignUpPage`, `ManagementAdvertiserPage`, `ReconcileSalesPage`.

## Defects found while automating (2026-09-24)

Staging:
- Every Tracking Diagnosis publisher link (`trackstg.fusetwo.com/g.ashx?…`) returns HTTP 500 with an
  ASP.NET `NullReferenceException` page — no test transaction can be created on staging.
- `UploadReconciledSales` without a token answers 400 "Token is not passed in header." (drawer documents 401).
- `UploadReconciledSales` **with the Bearer token shown in the API Reconcile drawer** answers
  401 "IDX10214: Audience validation failed" — the drawer's JWT (iss/aud `https://www.flexoffers.com`)
  is not accepted by the endpoint it documents, so the Postman flow cannot succeed on staging.
- Pre-existing `testReconcileSales` "upload a bonus sale" fails: the Add New drawer no longer offers
  the publisher option `FlexOffers Test Account | Advertiser`.
- Publisher List / Reconcile tables render hidden duplicate rows and headers (breakpoint copies).

Prod (re-verified read-only/with reverts on the test account):
- Editing a Coupon reopens it as "Offers" and saving drops the coupon code (data loss).
- Message Center → Address Book → Choose Program has no options.
- ~~`GET /api/{advertiserId}/managedaccount/` returns 500 on New Advertiser Setup and Account Management.~~
  Re-checked 25 Sep 2026: returns 200 (`plan: SelfManaged, isEnrolled: true`) on both pages — no longer reproduces.
- `programs/new?allowAutomation=true` renders the form disabled on load.
- Typed dates ignored; Find Publishers lists 5 of 26 programs; saved report templates cannot be deleted;
  coupon toasts say "Text Link".
