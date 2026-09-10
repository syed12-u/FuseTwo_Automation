# FuseTwo Advertiser App — Master Scenario Tracker

Living checklist of every tab and its scenarios. Executed on **staging**
(`advertiserstg.fusetwo.com`, account 1062551 "Playwright"). Writes create
throwaway data tagged `testautomation*` and are cleaned up at the end of each run.

**Status key:** ✅ pass · 🔴 bug/fail · ⏳ pending · ⚪ read-only (safe) · 🧹 needs cleanup

Owner: Syed Shah (QA). Last updated: 2026-09-02.

---

## 0. Onboarding  — DONE (previous sessions)
| # | Scenario | Type | Status |
|---|----------|------|--------|
| 0.1 | Register new advertiser (dynamic CAPTCHA, 3 steps → Thank You) | write | ✅ |
| 0.2 | Verification e-mail received + link resolves | read | ✅ |
| 0.3 | Unverified login → pending-account gate | read | ✅ |
| 0.4 | Management: change status through each stage | write | ✅ |
| 0.5 | Status-change notification e-mail delivered | read | 🔴 B-1 (not delivered) |
| 0.6 | Management CRUD: edit info / contact / note | write | ✅ |

## 1. Programs  — DONE
| # | Scenario | Type | Status |
|---|----------|------|--------|
| 1.1 | Create program (4-step wizard) → appears in listing | write | ✅ |
| 1.2 | Read program back (detail page shows entered data) | read | ✅ |
| 1.3 | Update program description → persists | write | 🔴 **500** `requestupdate` — "Oops! Something went wrong" |
| 1.4 | Deactivate program → leaves Active listing | write | 🔴 **500** `/programs/{id}/requestdeactivation` (UI shows no error) |
| 1.5 | Add-Program form gates step 2 until step 1 done | read | ✅ |
| 1.6 | Listing tabs: Active / Pending / Deactivated render | read | ✅ |
| 1.7 | Cleanup: deactivate all `testautomationprogram*` | write | 🔴 blocked by 1.4 bug |

---

## 2. Campaigns  — ⏳
Tabs: Active Campaigns / Inactive Campaigns. Actions: Add Campaign, Deactivate, Show/Hide Columns.
| # | Scenario | Type | Status |
|---|----------|------|--------|
| 2.1 | Listing loads; Active/Inactive tabs render with counts | read | ✅ |
| 2.2 | Column headers present; tab switching works | read | ✅ |
| 2.3 | Add Campaign form opens + required fields + empty-form gated | read | ✅ |
| 2.4 | Create a campaign (full wizard: General→Links→Save) → appears in Active | write | ✅ (200 create) |
| 2.5 | Deactivate a campaign → leaves Active | write | ✅ (200 deactivate) |

## 3. Creatives  — ⏳
Tabs: Active / Inactive / Disabled. Actions: Add Text Link, Add Banner, Bulk Import, Export, Edit.
| # | Scenario | Type | Status |
|---|----------|------|--------|
| 3.1 | Listing loads; 3 tabs render with counts | read | ✅ |
| 3.2 | Text-link & banner entry points present | read | ✅ |
| 3.3 | Create a Text Link creative → appears | write | ✅ (create works on staging) |
| 3.4 | Active/Inactive tab selection | read | ✅ |
| 3.5 | Create a Banner creative → appears | write | ✅ |
| 3.6 | Export / Bulk Import entry points | read | ⏳ (present in nav; deep flow deferred) |

## 4. Coupons & Offers  — ⏳
Tabs: Active / Inactive / Disabled. Actions: Add Coupon or Offer, Clone, Edit, Bulk Import, Export.
| # | Scenario | Type | Status |
|---|----------|------|--------|
| 4.1 | Listing loads; Active/Inactive/Disabled tabs render | read | ✅ |
| 4.2 | Add Coupon/Offer wizard opens + required fields | read | ✅ |
| 4.3 | Action entry points (Add / Bulk Import / Export) present | read | ✅ |
| 4.4 | Create a coupon → appears | write | ✅ FIXED — root cause was a Destination-URL/program-domain **mismatch** (ApprovedDateTest → cakebrandusa.com). Green in testCouponCreate.spec.ts |
| 4.5 | Update / enable-disable toggle lifecycle | write | ⏳ deferred (edit-mode selectors need refresh) |

## 5. Products (Feed)  — ✅ (read)
Tabs: Setup / Specifications / Import / Manage / Troubleshooting. Action: Save Changes.
| # | Scenario | Type | Status |
|---|----------|------|--------|
| 5.1 | All 5 sub-tabs render | read | ✅ |
| 5.2 | Create feed → Import CSV → View products → Historical → Request → Deactivate | write | ✅ (full E2E passes) |

## 6. Publishers  — ✅ (read)
Publisher List tabs: Approved / Pending / Deactivated / Declined / Pre-Approved / Recruitment.
| # | Scenario | Type | Status |
|---|----------|------|--------|
| 6.1 | Publisher List loads; all 6 tabs render | read | ✅ |
| 6.2 | Entry points (Find Publishers / Export / Manage Groups) present | read | ✅ |
| 6.3 | Find Publishers wizard: Introduction → Start | read | ✅ |
| 6.4 | Change Status: select publisher → enabled + dialog + fields + gating (validated, not committed — status change mutates a real publisher relationship) | write | ✅ |
| 6.5 | Manage Groups dialog opens; Export present | write | ✅ |

## 7. Reporting  — ✅ (all 7 sub-tabs + report CRUD)
| # | Sub-tab / Scenario | Type | Status |
|---|----------|------|--------|
| 7.1 | Performance — run (custom range, monthly grouping, last-month) + Export | read | ✅ pre-existing |
| 7.2 | Sales Summary — load, date range, sort, filter, columns, Export (real .csv/.xlsx) | read | ✅ pre-existing |
| 7.3 | Sales Detailed | read | ✅ pre-existing |
| 7.4 | Clicks Summary | read | ✅ pre-existing |
| 7.5 | Clicks Detailed — view, date filter, details, export download | read | ✅ pre-existing |
| 7.6 | Products Summary — loads + Export | read | ✅ new |
| 7.7 | Click ID Lookup — loads + Search + Export + lookup runs | read | ✅ new |
| 7.8 | **Report-template CRUD** — Save Report (Time Frame+Report By) → "Report template saved" → appears in Load Saved Report | write | ✅ new |

## 8. Accounting  — ✅ (partial)
| # | Scenario | Type | Status |
|---|----------|------|--------|
| 8.1 | Reconcile Sales page loads | read | ✅ pre-existing spec |
| 8.2 | Other Accounting sub-pages render | read | ⏳ deferred |

## 9. Settings  — ✅ (read)
| # | Scenario | Type | Status |
|---|----------|------|--------|
| 9.1 | My Account: **Save Changes persists** (phone round-trip, restored) | write | ✅ |
| 9.2 | Advertiser Setup: all 5 sub-tabs open without error | read | ✅ |
| 9.3 | Tracking Pixel: 4 tabs (JS/S2S/Ecommerce/API) render | read | ✅ |

## 10. Support  — ✅
| # | Scenario | Type | Status |
|---|----------|------|--------|
| 10.1 | Help Desk: Launch Support Site present | read | ✅ |
| 10.2 | Terms & Conditions full text renders | read | ✅ (via #857) |

## 11. Message Center  — ✅ (watch)
| # | Scenario | Type | Status |
|---|----------|------|--------|
| 11.1 | Message Center loads without error | read | ✅ (intermittent error on rapid crawl; clean on retry) |

---

## Bugs found so far (staging)
- **PROG-500-A** — Program **update** returns HTTP 500 (`"Oops! Something went wrong"`).
- **PROG-500-B** — Program **deactivate** returns HTTP 500 (`POST /api/{adv}/programs/{id}/requestdeactivation`); UI shows no error, dialog just closes (misleading — no success/error toast).
- **B-1** — Status-change notification e-mails not delivered (all envs).
- _MSG (watch)_ — Message Center intermittently showed "Page not found" during a rapid crawl; loaded cleanly on retry. Not reproducible standalone; guarded by a smoke test.

## Coverage summary
- **Green (working + tested):** Onboarding, Programs (create/read), Campaigns (form), Creatives (create text-link + banner), Coupons (form), Products/Publishers/Reporting/Accounting/Settings/Support (read + entry points), Message Center.
- **Red (app bugs):** Programs update & deactivate (500), status e-mails (B-1).
- **Deferred (deep write wizards):** Campaign create (dates/sections), Coupon create (blocked by app data), Products feed save, Settings save, Publisher Change-Status/Manage-Groups.
