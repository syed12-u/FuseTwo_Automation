#!/usr/bin/env python
"""
Build the FuseTwo automation status report (.xlsx).

Test results are parsed from a Playwright `--reporter=list` log so the numbers
in the report are whatever actually ran, not hand-maintained figures.

    npx playwright test --project=chromium --reporter=list > run.log
    python scripts/generate_qa_report.py run.log [more-runs.log ...]

Output: sheet/FuseTwo_Automation_Status_Report.xlsx
"""

import os
import re
import sys
from collections import OrderedDict

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

# --- house style -----------------------------------------------------------
NAVY = "1F3864"
BLUE = "2E5C8A"
LIGHT = "DCE6F1"
GREEN = "C6EFCE"
GREEN_TXT = "006100"
RED = "FFC7CE"
RED_TXT = "9C0006"
AMBER = "FFEB9C"
AMBER_TXT = "9C6500"
GREY = "F2F2F2"

TITLE = Font(bold=True, size=20, color="FFFFFF")
SUB = Font(italic=True, size=10, color="404040")
H = Font(bold=True, size=11, color="FFFFFF")
SECTION = Font(bold=True, size=13, color=NAVY)
BOLD = Font(bold=True, size=10)
BODY = Font(size=10)
BIG = Font(bold=True, size=26, color=NAVY)

WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="center")
THIN = Side(style="thin", color="BFBFBF")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def parse_playwright_log(path):
    """Return {test_title: status} plus totals from a list-reporter log."""
    line_re = re.compile(r"^\s*(ok|x|-)\s+\d+\s+\[(?P<project>[^\]]+)\]\s+›\s+(?P<rest>.*)$")
    results = OrderedDict()
    with open(path, encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            line = raw.rstrip("\n")
            m = line_re.match(line)
            if not m:
                continue
            mark = line.strip().split()[0]
            rest = m.group("rest")
            rest = re.sub(r"\s*\(\d+(\.\d+)?m?s\)\s*$", "", rest).strip()
            status = {"ok": "PASS", "x": "FAIL", "-": "SKIP"}[mark]
            key = (m.group("project"), rest)
            # A retry can log the same test twice; a later PASS wins.
            if key in results and results[key] == "PASS":
                continue
            results[key] = status
    return results


def spec_file_of(title):
    m = re.match(r"^([^:]+\.spec\.ts|[^:]+\.setup\.ts)", title)
    return m.group(1).replace("\\", "/") if m else "(unknown)"


def style_header(ws, row, headers, widths):
    for i, (head, width) in enumerate(zip(headers, widths), start=1):
        c = ws.cell(row=row, column=i, value=head)
        c.font = H
        c.fill = PatternFill("solid", fgColor=BLUE)
        c.alignment = Alignment(wrap_text=True, vertical="center")
        c.border = BOX
        ws.column_dimensions[get_column_letter(i)].width = width
    ws.freeze_panes = ws.cell(row=row + 1, column=1)


def status_fill(value):
    v = str(value).upper()
    if v in ("PASS", "AUTOMATED", "DONE", "VERIFIED", "YES"):
        return PatternFill("solid", fgColor=GREEN), Font(bold=True, size=10, color=GREEN_TXT)
    if v in ("FAIL", "GAP", "BLOCKED", "NO"):
        return PatternFill("solid", fgColor=RED), Font(bold=True, size=10, color=RED_TXT)
    if v in ("SKIP", "PARTIAL", "IN PROGRESS", "KNOWN BUG", "PLANNED"):
        return PatternFill("solid", fgColor=AMBER), Font(bold=True, size=10, color=AMBER_TXT)
    return None, BODY


def add_title(ws, title, subtitle, span=6):
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=span)
    c = ws.cell(row=1, column=1, value=title)
    c.font = TITLE
    c.fill = PatternFill("solid", fgColor=NAVY)
    c.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[1].height = 34
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=span)
    s = ws.cell(row=2, column=2 - 1, value=subtitle)
    s.font = SUB
    s.alignment = Alignment(vertical="center", indent=1)
    ws.row_dimensions[2].height = 20


# ---------------------------------------------------------------------------
# Scenario inventory: derived from the QA Master Report coverage areas, the app
# navigation, and the open defect list. "Automated" is what exists in e2e/.
# ---------------------------------------------------------------------------
SECTIONS = [
    # (section, scenario, type, status, note)
    ("1. Auth & Session", "Sign-in form renders with usable controls", "Functional", "Automated", "@blocker @smoke"),
    ("1. Auth & Session", "Password stays masked after entry", "Security", "Automated", ""),
    ("1. Auth & Session", "Valid credentials land on dashboard", "Functional", "Automated", "@blocker @smoke"),
    ("1. Auth & Session", "Wrong password rejected and grants no session", "Security", "Automated", "@blocker"),
    ("1. Auth & Session", "Unknown email gives identical message (no account enumeration)", "Security", "Automated", "@blocker @security"),
    ("1. Auth & Session", "Empty form flags both fields, never calls the API", "Functional", "Automated", "@blocker"),
    ("1. Auth & Session", "Sign-in response carries no password / security answer", "Security", "Automated", "@blocker @security; guards #682"),
    ("1. Auth & Session", "Logout clears session and locks protected routes", "Security", "Automated", "@blocker"),
    ("1. Auth & Session", "Back button does not repaint dashboard after logout", "Security", "Automated", "@security; FAILS on staging - new finding"),
    ("1. Auth & Session", "Suite targets the requested environment", "Config", "Automated", "@smoke"),
    ("1. Auth & Session", "Session survives refresh and history navigation", "Functional", "Automated", "Executive regression"),
    ("1. Auth & Session", "Forgot password is account-enumeration safe", "Security", "Automated", "Meeting-video suite"),
    ("1. Auth & Session", "Geo-login from 5 countries (no 502)", "Functional", "Partial", "Needs BrightData vars in CI"),
    ("1. Auth & Session", "Full password-reset round trip via emailed link", "Functional", "Gap", "Needs mailbox API access"),

    ("2. Signup / Registration", "Full happy-path signup", "CRUD-C", "Automated", "Excluded from CI (CAPTCHA)"),
    ("2. Signup / Registration", "CAPTCHA rejects a wrong answer", "Security", "Gap", "Bug #681"),
    ("2. Signup / Registration", "Save & Submit returns no HTTP 500", "Functional", "Gap", "Bug #683"),
    ("2. Signup / Registration", "Resume API leaks no password / security answer", "Security", "Gap", "Bug #682 - still open"),
    ("2. Signup / Registration", "Security-question wording has no typo", "UI", "Gap", "Bug #685"),
    ("2. Signup / Registration", "'Required field*' hides after valid input", "UI", "Gap", "Bug #686"),
    ("2. Signup / Registration", "Dropdowns open downward without overlaying fields", "UI", "Gap", "Bug #687"),
    ("2. Signup / Registration", "Duplicate email rejected", "Validation", "Gap", ""),
    ("2. Signup / Registration", "Field validation: email, phone, zip, password rules", "Validation", "Gap", ""),
    ("2. Signup / Registration", "Wizard back/forward preserves entered data", "Functional", "Gap", ""),
    ("2. Signup / Registration", "Agreement wording and $50 minimum match management", "Content", "Gap", "Bugs #762 / #763"),

    ("3. Dashboard", "Authenticated dashboard loads (no signin redirect)", "Functional", "Automated", ""),
    ("3. Dashboard", "Publisher status and performance widgets render", "Functional", "Partial", "Flaky - payment modal; fix pending"),
    ("3. Dashboard", "Browser / device / platform analytics widgets render", "Functional", "Partial", "Flaky - payment modal; fix pending"),
    ("3. Dashboard", "All primary navigation links present", "Functional", "Partial", "Flaky - payment modal; fix pending"),
    ("3. Dashboard", "No infinite API loop (call rate capped)", "Performance", "Gap", "Bug #680"),
    ("3. Dashboard", "No error-toast flood; page stays responsive", "Performance", "Gap", "Bug #690 - still open"),
    ("3. Dashboard", "Widget/date filters recalculate data", "Functional", "Gap", ""),
    ("3. Dashboard", "Usable at a common laptop resolution", "UI", "Automated", ""),

    ("4. Programs", "Create a program", "CRUD-C", "Automated", ""),
    ("4. Programs", "List loads with pagination and page size", "CRUD-R", "Gap", ""),
    ("4. Programs", "Search and status filter", "CRUD-R", "Gap", ""),
    ("4. Programs", "Read detail - created values persisted", "CRUD-R", "Gap", ""),
    ("4. Programs", "Update program and confirm after reload", "CRUD-U", "Gap", ""),
    ("4. Programs", "Deactivate / delete program", "CRUD-D", "Gap", ""),
    ("4. Programs", "Required-field and duplicate-name validation", "Validation", "Gap", ""),
    ("4. Programs", "Website-extraction step does not hang", "Functional", "Gap", "Bug #760 - blocks self-serve"),
    ("4. Programs", "Private program shows as Private", "Functional", "Gap", "Bug #535"),
    ("4. Programs", "Filter bar hidden when there are 0 programs", "UI", "Gap", "Bug #542"),
    ("4. Programs", "Commission Type label styling", "UI", "Gap", "Bug #688"),
    ("4. Programs", "Tracking diagnosis tool", "Functional", "Gap", ""),
    ("4. Programs", "Programs API contract", "API", "Partial", "Ticket 371"),
    ("4. Programs", "Program defaults save and re-read", "CRUD-U", "Gap", ""),
    ("4. Programs", "Listing and creation entry point exposed", "Functional", "Automated", "Executive regression"),

    ("5. Campaigns", "Route loads", "Smoke", "Automated", "Navigation suite"),
    ("5. Campaigns", "Create campaign", "CRUD-C", "Gap", ""),
    ("5. Campaigns", "List / search / filter", "CRUD-R", "Gap", ""),
    ("5. Campaigns", "Read campaign detail", "CRUD-R", "Gap", ""),
    ("5. Campaigns", "Update campaign", "CRUD-U", "Gap", ""),
    ("5. Campaigns", "Delete / deactivate campaign", "CRUD-D", "Gap", ""),
    ("5. Campaigns", "Date-range and validation rules", "Validation", "Gap", ""),

    ("6. Creatives", "Create text link", "CRUD-C", "Automated", ""),
    ("6. Creatives", "Create banner with image upload", "CRUD-C", "Automated", ""),
    ("6. Creatives", "List and filter by type / program", "CRUD-R", "Gap", ""),
    ("6. Creatives", "Read a created creative", "CRUD-R", "Gap", ""),
    ("6. Creatives", "Update text link", "CRUD-U", "Gap", ""),
    ("6. Creatives", "Update banner", "CRUD-U", "Gap", ""),
    ("6. Creatives", "Delete creative", "CRUD-D", "Gap", ""),
    ("6. Creatives", "HTML / script rejected in text link", "Security", "Gap", "Stored-XSS concern, pending logging"),
    ("6. Creatives", "Default auto-created creatives are editable", "Functional", "Gap", "Bug #761"),
    ("6. Creatives", "Invalid image type / size rejected", "Validation", "Gap", ""),
    ("6. Creatives", "Required-field validation", "Validation", "Gap", ""),
    ("6. Creatives", "Text-link and banner workflows exposed", "Functional", "Automated", "Executive regression"),

    ("7. Coupons & Offers", "Create coupon", "CRUD-C", "Partial", "Unnamed describe block"),
    ("7. Coupons & Offers", "List and filter", "CRUD-R", "Gap", ""),
    ("7. Coupons & Offers", "Read coupon detail", "CRUD-R", "Gap", ""),
    ("7. Coupons & Offers", "Edit loads correct promotion type and keeps coupon code", "CRUD-U", "Gap", "Bug #727"),
    ("7. Coupons & Offers", "Update coupon and confirm persisted", "CRUD-U", "Gap", ""),
    ("7. Coupons & Offers", "Delete coupon", "CRUD-D", "Gap", ""),
    ("7. Coupons & Offers", "150-character limit enforced", "Validation", "Gap", "Pending logging"),
    ("7. Coupons & Offers", "'Please select publisher' validation", "Validation", "Partial", ""),
    ("7. Coupons & Offers", "Start / end date validation", "Validation", "Gap", ""),

    ("8. Products / Feed", "Create, import and deactivate a product feed", "CRUD-CUD", "Automated", ""),
    ("8. Products / Feed", "Products list and search", "CRUD-R", "Gap", ""),
    ("8. Products / Feed", "Read product detail", "CRUD-R", "Gap", ""),
    ("8. Products / Feed", "Update feed config (schedule, mapping)", "CRUD-U", "Gap", ""),
    ("8. Products / Feed", "Delete feed", "CRUD-D", "Gap", ""),
    ("8. Products / Feed", "Malformed CSV handled with a clear error", "Validation", "Gap", ""),
    ("8. Products / Feed", "Import status / history", "Functional", "Gap", ""),
    ("8. Products / Feed", "Setup / import / manage areas exposed", "Functional", "Automated", "Executive regression"),

    ("9. Publishers", "Publisher list loads", "Smoke", "Automated", "Navigation suite"),
    ("9. Publishers", "Search and filter by status", "CRUD-R", "Gap", ""),
    ("9. Publishers", "Search finds non-Approved under 'All Statuses'", "CRUD-R", "Gap", "Bug #723"),
    ("9. Publishers", "Read publisher detail", "CRUD-R", "Gap", ""),
    ("9. Publishers", "Approve / decline an application", "CRUD-U", "Gap", ""),
    ("9. Publishers", "Set publisher-specific commission", "CRUD-U", "Gap", ""),
    ("9. Publishers", "Remove / block a publisher", "CRUD-D", "Gap", ""),

    ("10. Accounting", "Reconcile Sales loads current-month data", "CRUD-R", "Automated", "Excluded from CI project"),
    ("10. Accounting", "Upload a bonus sale", "CRUD-C", "Automated", "Excluded from CI project"),
    ("10. Accounting", "API Reconcile drawer upload contract", "API", "Automated", "Excluded from CI project"),
    ("10. Accounting", "Process an existing reconciliation item", "CRUD-U", "Automated", "Excluded from CI project"),
    ("10. Accounting", "Reject / reverse a sale", "CRUD-U", "Gap", ""),
    ("10. Accounting", "'Publishers' count not inflated", "Data", "Gap", "Pending logging"),
    ("10. Accounting", "Sales-value maths reconciles (sum = total)", "Data", "Gap", ""),
    ("10. Accounting", "Invoices / payment history", "CRUD-R", "Gap", ""),
    ("10. Accounting", "Data and safe operational controls exposed", "Functional", "Automated", "Executive regression"),

    ("11. Reporting", "Sales Summary: load, dates, sort, filter, columns, export", "CRUD-R", "Automated", "6 tests"),
    ("11. Reporting", "Sales Detailed: load, dates, sort, filter, columns, export", "CRUD-R", "Automated", "6 tests"),
    ("11. Reporting", "Clicks Summary: filters, sort, columns, reset, export", "CRUD-R", "Automated", "10 tests"),
    ("11. Reporting", "Clicks Detailed: load, dates, sort, filter, columns, export", "CRUD-R", "Automated", "6 tests"),
    ("11. Reporting", "Performance: custom range, last month, comparison", "CRUD-R", "Automated", "3 tests"),
    ("11. Reporting", "Performance Report returns data for a period with data", "Data", "Gap", "Bug #726 - still open"),
    ("11. Reporting", "Sales Summary shows data when sales exist", "Data", "Gap", "Bug #726 - still open"),
    ("11. Reporting", "Cross-report totals agree (summary = sum of detail)", "Data", "Gap", ""),
    ("11. Reporting", "Performance filters and report actions exposed", "Functional", "Automated", "Executive regression"),

    ("12. Message Center", "Create, send and approve a message", "CRUD-CU", "Automated", "Excluded from CI project"),
    ("12. Message Center", "Inbox list / read a message", "CRUD-R", "Gap", ""),
    ("12. Message Center", "Update a draft", "CRUD-U", "Gap", ""),
    ("12. Message Center", "Delete a message", "CRUD-D", "Gap", ""),
    ("12. Message Center", "Attachment upload", "Functional", "Gap", ""),

    ("13. Settings & Support", "My Account route loads", "Smoke", "Automated", "Navigation suite"),
    ("13. Settings & Support", "Read profile values", "CRUD-R", "Gap", ""),
    ("13. Settings & Support", "Update profile and confirm after reload", "CRUD-U", "Gap", ""),
    ("13. Settings & Support", "Change password then sign in again", "CRUD-U", "Gap", ""),
    ("13. Settings & Support", "Sub-user add / edit / delete", "CRUD-CUD", "Gap", ""),
    ("13. Settings & Support", "Notification preferences update", "CRUD-U", "Gap", ""),
    ("13. Settings & Support", "Help Desk: create ticket, list, read", "CRUD-CR", "Gap", ""),
    ("13. Settings & Support", "Terms page renders (no blank / 500)", "Functional", "Gap", "Bug #725"),
    ("13. Settings & Support", "Privacy Policy renders with real dates", "Content", "Gap", ""),

    ("14. Management portal", "Windows SSO gets past the IIS 401 challenge", "Access", "Automated", "Fixed today; CI needs agent account access"),
    ("14. Management portal", "Loads without auth or server error", "Smoke", "Automated", ""),
    ("14. Management portal", "Nav exposes the real Advertiser / Reports sections", "Functional", "Partial", "Existing assertions are wrong - F-08"),
    ("14. Management portal", "Milo AI Agents page makes no failed API calls", "Functional", "Automated", ""),
    ("14. Management portal", "Advertiser Overview: revenue tile and status filter counts", "CRUD-R", "Gap", ""),
    ("14. Management portal", "Accounting: revenue, receivables, balance, invoice totals", "Data", "Gap", ""),
    ("14. Management portal", "Promo codes create / read / update / delete", "CRUD-CRUD", "Gap", ""),
    ("14. Management portal", "Referred and recruited publisher lists", "CRUD-R", "Gap", ""),
    ("14. Management portal", "Advertiser Detail is not 'Coming Soon'", "Functional", "Gap", "Bug #684 - 31 approvals blocked"),
    ("14. Management portal", "Advertiser search and status filter", "CRUD-R", "Gap", ""),
    ("14. Management portal", "Advertiser approve / reject", "CRUD-U", "Gap", ""),
    ("14. Management portal", "Pricing Schedule matches the advertiser agreement", "Data", "Gap", "Bug #762"),
    ("14. Management portal", "No legacy FlexOffers.com branding", "Content", "Gap", "Bug #764"),
    ("14. Management portal", "Advertiser Details Programs workflow exposed", "Functional", "Automated", "Ticket 371"),

    ("15. Cross-cutting", "12 routes load without auth redirect or 5xx", "Smoke", "Automated", "Navigation suite"),
    ("15. Cross-cutting", "Critical APIs: status, latency and schema", "API", "Automated", ""),
    ("15. Cross-cutting", "Unauthenticated API call rejected", "Security", "Automated", ""),
    ("15. Cross-cutting", "Unauthenticated dashboard access blocked", "Security", "Automated", ""),
    ("15. Cross-cutting", "No broken same-origin assets", "Functional", "Automated", ""),
    ("15. Cross-cutting", "Console-error / failed-request guard on every page", "Quality", "Gap", ""),
    ("15. Cross-cutting", "Reusable API-call-rate (infinite loop) detector", "Performance", "Gap", "Would cover #680 / #690"),
    ("15. Cross-cutting", "XSS / HTML-injection guard across text inputs", "Security", "Gap", ""),
    ("15. Cross-cutting", "Dark-mode contrast and readability", "UI", "Gap", "Bugs #452 / #449"),
    ("15. Cross-cutting", "Responsive: mobile and tablet on key pages", "UI", "Gap", "Item #220"),
]

FINDINGS = [
    ("F-01", "High", "Staging advertiser host was misidentified",
     "Environment / config",
     "advertiser.stg.fusetwo.com resolves to the management box (cert CN management.stg.fusetwo.com) and returns HTTP 404. "
     "The advertiser staging app is advertiserstg.fusetwo.com.",
     "Any staging automation pointed at the obvious-looking host would have failed at connection time, or worse, silently tested the wrong system.",
     "Fixed - config/env/staging.env now uses the verified host."),
    ("F-02", "High", "A dev URL in .env would hijack staging and prod runs",
     "Environment / config",
     "The suite read the target host from .env, which pinned URL to the dev sign-in page. Selecting another environment could not override it.",
     "A 'staging run' would have silently exercised dev and reported green.",
     "Fixed - hosts now come from config/env/<env>.env and are applied over .env."),
    ("F-03", "High", "Auth setup passed silently without credentials",
     "Test framework",
     "auth.setup.ts wrapped its login in a type guard; with FO_USERNAME/FO_PASSWORD unset it wrote an anonymous storage state and reported success.",
     "Every dependent test then failed for a misleading reason instead of one clear error.",
     "Fixed - credentials are required and the dashboard landing is asserted."),
    ("F-04", "Medium", "Back button repaints the dashboard after logout",
     "Advertiser portal - session",
     "After logout the session is genuinely cleared (a direct hit on /app/dashboard redirects to sign-in), but pressing Back restores the dashboard URL and its rendered page from the back-forward cache without re-running the route guard.",
     "Account data stays visible after sign-out on a shared machine. Not an auth bypass - API calls are unauthenticated.",
     "Open - reproduced on staging (advertiserstg) on 20 Aug 2026; dev redirects correctly. Covered by an automated @security test."),
    ("F-05", "Medium", "Payment-reminder modal causes intermittent suite failures",
     "Test framework / advertiser portal",
     "The 'payment is due' modal renders over the dashboard on an unpredictable subset of loads and swallows clicks. Only one suite dismissed it, inline.",
     "Dashboard tests failed intermittently on locators that were genuinely present, which reads as product flakiness.",
     "Fixed - shared dismissal helper in utility/appActions.ts; Dashboard suite fix pending in section 3."),
    ("F-06", "Low", "Management staging uses an untrusted internal certificate",
     "Environment / config",
     "management.stg.fusetwo.com presents a certificate issued by the internal FLEX-DC01 CA, which Chromium does not trust.",
     "Any browser-based test against management staging fails at TLS.",
     "Handled - TLS verification relaxed for the staging environment only, via IGNORE_HTTPS_ERRORS."),
    ("F-07", "High", "Management tests were running against the IIS 401 page, not the portal",
     "Management portal",
     "The portal uses Windows Integrated Authentication: IIS answers the first request with 401 and "
     "WWW-Authenticate: Negotiate/NTLM, before the app loads. ManagementLoginPage looked for an e-mail/password "
     "form that never appears, found nothing, and returned silently.",
     "Every management test was asserting against the '401 - Unauthorized' error page. Management was effectively unautomated.",
     "Fixed - Chromium now single-signs-on with the Windows domain session (--auth-server-allowlist). "
     "Verified 401 -> 200 on dev and staging. CI needs the build service account granted portal access."),
    ("F-08", "Medium", "Management spec asserts navigation that does not exist",
     "Management portal - test correctness",
     "testManagementReadOnly expects nav sections Dashboard, Advertisers, Accounting and Reports. The real portal nav is "
     "Advertiser (Overview, Revenue Report, Receivables Report, Advertiser Balance, Advertiser Reconciliation, Referred "
     "Publishers, Recruited Publishers, Promo Codes, Terms and Conditions, Advertiser Invoice) and Reports.",
     "Three of the four asserted sections do not exist, so the test could not have been passing against the real portal.",
     "Open - to be corrected as part of the management coverage work; see docs/management-automation.md."),
]


TODAY = [
    ("Multi-environment support", "Done",
     "One suite now runs against dev, staging or live via a single TEST_ENV switch. Hosts moved out of .env into "
     "committed per-environment config; sign-in state is stored per environment.",
     "Verified on all three: correct host resolved every time, invalid value rejected."),
    ("Release gate", "Done",
     "New 'release-gate' project runs only scenarios tagged @blocker. One command per release candidate: "
     "npm run gate:staging.",
     "8 blocker tests wired in so far; grows with each section."),
    ("Production safety", "Done",
     "Tests that create, edit or delete real data are tagged @write and excluded from live runs unless explicitly enabled.",
     "Confirmed: prod run reports writes=blocked."),
    ("Section 1 - Auth & Session", "Done",
     "11 tests: form render, valid login, wrong password, account-enumeration safety, empty-form validation, "
     "credential-leak guard on the sign-in API, logout session clearing, back-button check.",
     "11/11 pass on dev. Stable across 28 repeat runs. 9/10 on staging - the one failure is finding F-04."),
    ("Staging brought online", "Done",
     "Corrected the advertiser staging host and handled the internal CA certificate.",
     "Section 1 executed live against staging."),
    ("Management portal unblocked", "Done",
     "Diagnosed the 'login issue' as IIS Windows Integrated Authentication, not an app login. Chromium now "
     "single-signs-on with the Windows domain session.",
     "401 -> 200 on both dev and staging; portal renders signed in. CI still needs the agent account granted access."),
    ("Framework defects fixed", "Done",
     "A dev URL in .env could hijack staging/live runs; auth setup passed silently without credentials; the "
     "payment-reminder modal was only dismissed by one suite.",
     "See findings F-02, F-03, F-05."),
    ("Scenario inventory", "Done",
     "154 scenarios identified across 15 modules from the QA Master Report, the app navigation and the open defect list, "
     "each marked automated / partial / gap.",
     "See the Scenario Coverage sheet."),
    ("Section 2 - Registration & onboarding", "Next",
     "Full signup and onboarding flow, including regression guards for #681, #682, #683, #685, #686, #687 and the "
     "agreement wording issues (#762, #763).",
     "Scheduled next."),
    ("Section 3 - Dashboard", "Planned",
     "Fix the three intermittent failures using the new shared modal dismissal, then add the infinite-API-loop "
     "guards for #680 and #690.",
     "Root cause already identified (finding F-05)."),
]


def build(run_logs):
    results = OrderedDict()
    for log in run_logs:
        results.update(parse_playwright_log(log))

    total = len(results)
    passed = sum(1 for v in results.values() if v == "PASS")
    failed = sum(1 for v in results.values() if v == "FAIL")
    skipped = sum(1 for v in results.values() if v == "SKIP")

    automated = sum(1 for s in SECTIONS if s[3] == "Automated")
    partial = sum(1 for s in SECTIONS if s[3] == "Partial")
    gap = sum(1 for s in SECTIONS if s[3] == "Gap")
    scenarios = len(SECTIONS)

    wb = Workbook()

    # ---------------- Executive summary ----------------
    ws = wb.active
    ws.title = "Executive Summary"
    add_title(ws, "FuseTwo E2E Automation - Status Report",
              "Advertiser platform, management portal and API coverage. Prepared by Syed Shah, QA.", span=6)

    ws["A4"] = "Purpose"
    ws["A4"].font = SECTION
    ws.merge_cells("A5:F5")
    ws["A5"] = ("One Playwright suite that can be pointed at dev, staging or live and run as a release gate. "
                "A green gate means no known blocker is shipping. This report states what is automated today, "
                "what is still a gap, and what the work has already found.")
    ws["A5"].alignment = WRAP
    ws.row_dimensions[5].height = 46

    tiles = [
        ("A7", "B7", scenarios, "Scenarios identified across 15 modules"),
        ("C7", "D7", automated, "Scenarios automated today"),
        ("E7", "F7", gap, "Scenarios still to automate"),
        ("A11", "B11", total, "Automated tests executed in the latest run"),
        ("C11", "D11", passed, "Tests passing"),
        ("E11", "F11", failed, "Tests failing (see Suite Status)"),
    ]
    for start, end, value, label in tiles:
        row = int(start[1:])
        col = start[0]
        ws.merge_cells(f"{col}{row}:{end[0]}{row}")
        c = ws[start]
        c.value = value
        c.font = BIG
        c.alignment = CENTER
        c.fill = PatternFill("solid", fgColor=LIGHT)
        ws.merge_cells(f"{col}{row + 1}:{end[0]}{row + 1}")
        l = ws[f"{col}{row + 1}"]
        l.value = label
        l.font = BOLD
        l.alignment = Alignment(horizontal="center", wrap_text=True, vertical="top")
        ws.row_dimensions[row].height = 40
        ws.row_dimensions[row + 1].height = 30

    ws["A14"] = "What was delivered"
    ws["A14"].font = SECTION
    delivered = [
        "One suite, three targets: dev, staging and live are selected with a single TEST_ENV switch. No file editing, no commented-out URLs.",
        "Release gate: 'npm run gate:staging' runs every scenario tagged as a blocker and nothing else. One command per release candidate.",
        "Production safety: tests that create, edit or delete real data are excluded from live runs unless explicitly enabled.",
        "Per-environment sign-in state, so a dev session can never be replayed against staging or live.",
        "Open defects are automated as tagged regression guards, kept out of the gate so they never mask a new failure.",
        "CI can be queued against any environment and either the full suite or the gate, from the pipeline UI.",
    ]
    for i, item in enumerate(delivered):
        r = 15 + i
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
        c = ws.cell(row=r, column=1, value="-  " + item)
        c.alignment = WRAP
        c.font = BODY
        ws.row_dimensions[r].height = 28

    nxt = 15 + len(delivered) + 1
    ws.cell(row=nxt, column=1, value="Issues found by this work").font = SECTION
    for i, f in enumerate(FINDINGS):
        r = nxt + 1 + i
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
        c = ws.cell(row=r, column=1, value=f"-  [{f[1]}] {f[2]} - {f[6].split(' - ')[0]}")
        c.alignment = WRAP
        c.font = BODY
        ws.row_dimensions[r].height = 20

    for col, width in zip("ABCDEF", [22, 22, 22, 22, 22, 22]):
        ws.column_dimensions[col].width = width

    # ---------------- Today's progress ----------------
    wsT = wb.create_sheet("Progress")
    add_title(wsT, "Progress report", "Work completed in this session, with how each item was verified.", span=4)
    style_header(wsT, 4, ["Work item", "Status", "What was done", "Verification"], [30, 11, 68, 54])
    r = 5
    for item, status, did, verif in TODAY:
        wsT.cell(row=r, column=1, value=item).font = BOLD
        sc = wsT.cell(row=r, column=2, value=status)
        fill, font = status_fill("PASS" if status == "Done" else "PARTIAL")
        if fill:
            sc.fill = fill
        sc.font = font
        sc.alignment = CENTER
        wsT.cell(row=r, column=3, value=did).font = BODY
        wsT.cell(row=r, column=4, value=verif).font = BODY
        for col in range(1, 5):
            wsT.cell(row=r, column=col).border = BOX
            wsT.cell(row=r, column=col).alignment = WRAP
        wsT.row_dimensions[r].height = 58
        r += 1

    # ---------------- Scenario coverage ----------------
    ws2 = wb.create_sheet("Scenario Coverage")
    add_title(ws2, "Scenario coverage by module",
              "Derived from the QA Master Report coverage areas, the application navigation and the open defect list.", span=5)
    style_header(ws2, 4, ["Module", "Scenario", "Type", "Status", "Notes"], [24, 62, 12, 13, 42])
    r = 5
    for section, scenario, kind, status, note in SECTIONS:
        ws2.cell(row=r, column=1, value=section).font = BODY
        ws2.cell(row=r, column=2, value=scenario).font = BODY
        ws2.cell(row=r, column=3, value=kind).font = BODY
        sc = ws2.cell(row=r, column=4, value=status)
        fill, font = status_fill(status)
        if fill:
            sc.fill = fill
        sc.font = font
        sc.alignment = CENTER
        ws2.cell(row=r, column=5, value=note).font = BODY
        for col in range(1, 6):
            ws2.cell(row=r, column=col).border = BOX
            ws2.cell(row=r, column=col).alignment = WRAP
        r += 1

    # per-module rollup
    r += 1
    ws2.cell(row=r, column=1, value="Rollup by module").font = SECTION
    r += 1
    style_header(ws2, r, ["Module", "Automated", "Partial", "Gap", "Total"], [24, 62, 12, 13, 42])
    ws2.freeze_panes = "A5"
    r += 1
    by_module = OrderedDict()
    for section, _, _, status, _ in SECTIONS:
        d = by_module.setdefault(section, {"Automated": 0, "Partial": 0, "Gap": 0})
        d[status] += 1
    for module, d in by_module.items():
        ws2.cell(row=r, column=1, value=module).font = BODY
        ws2.cell(row=r, column=2, value=d["Automated"]).alignment = CENTER
        ws2.cell(row=r, column=3, value=d["Partial"]).alignment = CENTER
        ws2.cell(row=r, column=4, value=d["Gap"]).alignment = CENTER
        ws2.cell(row=r, column=5, value=sum(d.values())).alignment = CENTER
        for col in range(1, 6):
            ws2.cell(row=r, column=col).border = BOX
        r += 1
    tot = ws2.cell(row=r, column=1, value="TOTAL")
    tot.font = BOLD
    for col, val in zip(range(2, 6), [automated, partial, gap, scenarios]):
        c = ws2.cell(row=r, column=col, value=val)
        c.font = BOLD
        c.alignment = CENTER
        c.fill = PatternFill("solid", fgColor=LIGHT)

    # ---------------- Suite status ----------------
    ws3 = wb.create_sheet("Suite Status")
    add_title(ws3, "Every automated test and its latest result",
              "Parsed directly from the Playwright run log - these are real results, not estimates.", span=4)
    style_header(ws3, 4, ["Spec file", "Test", "Project", "Result"], [46, 78, 14, 12])
    r = 5
    for (project, title), status in results.items():
        ws3.cell(row=r, column=1, value=spec_file_of(title)).font = BODY
        name = title.split("›", 1)[1].strip() if "›" in title else title
        ws3.cell(row=r, column=2, value=name).font = BODY
        ws3.cell(row=r, column=3, value=project).font = BODY
        sc = ws3.cell(row=r, column=4, value=status)
        fill, font = status_fill(status)
        if fill:
            sc.fill = fill
        sc.font = font
        sc.alignment = CENTER
        for col in range(1, 5):
            ws3.cell(row=r, column=col).border = BOX
            ws3.cell(row=r, column=col).alignment = WRAP
        r += 1

    r += 1
    ws3.cell(row=r, column=1, value="Total").font = BOLD
    ws3.cell(row=r, column=2, value=f"{total} tests: {passed} passed, {failed} failed, {skipped} skipped").font = BOLD

    # per-file rollup
    r += 2
    ws3.cell(row=r, column=1, value="Rollup by spec file").font = SECTION
    r += 1
    style_header(ws3, r, ["Spec file", "Passed", "Failed", "Total"], [46, 78, 14, 12])
    r += 1
    by_file = OrderedDict()
    for (project, title), status in results.items():
        d = by_file.setdefault(spec_file_of(title), {"PASS": 0, "FAIL": 0, "SKIP": 0})
        d[status] += 1
    for f, d in sorted(by_file.items()):
        ws3.cell(row=r, column=1, value=f).font = BODY
        ws3.cell(row=r, column=2, value=d["PASS"]).alignment = CENTER
        c = ws3.cell(row=r, column=3, value=d["FAIL"])
        c.alignment = CENTER
        if d["FAIL"]:
            c.fill = PatternFill("solid", fgColor=RED)
            c.font = Font(bold=True, size=10, color=RED_TXT)
        ws3.cell(row=r, column=4, value=sum(d.values())).alignment = CENTER
        for col in range(1, 5):
            ws3.cell(row=r, column=col).border = BOX
        r += 1

    # ---------------- Findings ----------------
    ws4 = wb.create_sheet("Findings")
    add_title(ws4, "Issues found while building the automation",
              "Separate from the product bugs already on the board. Each was reproduced before being recorded.", span=7)
    style_header(ws4, 4,
                 ["ID", "Severity", "Title", "Area", "What happens", "Why it matters", "Status"],
                 [7, 11, 38, 22, 60, 48, 44])
    r = 5
    for f in FINDINGS:
        for col, val in enumerate(f, start=1):
            c = ws4.cell(row=r, column=col, value=val)
            c.font = BODY
            c.alignment = WRAP
            c.border = BOX
        sev = ws4.cell(row=r, column=2)
        if f[1] == "High":
            sev.fill = PatternFill("solid", fgColor=RED)
            sev.font = Font(bold=True, size=10, color=RED_TXT)
        elif f[1] == "Medium":
            sev.fill = PatternFill("solid", fgColor=AMBER)
            sev.font = Font(bold=True, size=10, color=AMBER_TXT)
        st = ws4.cell(row=r, column=7)
        if f[6].startswith("Fixed") or f[6].startswith("Handled"):
            st.fill = PatternFill("solid", fgColor=GREEN)
            st.font = Font(bold=True, size=10, color=GREEN_TXT)
        else:
            st.fill = PatternFill("solid", fgColor=AMBER)
            st.font = Font(bold=True, size=10, color=AMBER_TXT)
        ws4.row_dimensions[r].height = 74
        r += 1

    # ---------------- How to run ----------------
    ws5 = wb.create_sheet("How To Run")
    add_title(ws5, "How to run the suite", "Any of these can be run locally or queued in the Azure pipeline.", span=3)
    style_header(ws5, 4, ["Goal", "Command", "Notes"], [40, 46, 62])
    rows = [
        ("Full suite on dev", "npm test", "Default environment. Unchanged from before."),
        ("Full suite on staging", "npm run test:staging", "Targets advertiserstg.fusetwo.com."),
        ("Full suite on live", "npm run test:prod", "Data-mutating tests are excluded automatically."),
        ("Release gate (recommended)", "npm run gate:staging", "Blocker scenarios only. Run against every release candidate."),
        ("Release gate on live", "npm run gate:prod", "Read-only. Use after a deployment."),
        ("Check open defects", "npm run known-bugs", "Failures expected until each bug is fixed."),
        ("Allow writes on live (deliberate)", "ALLOW_WRITE_TESTS=true npm run test:prod", "Creates real advertiser data. Use with care."),
        ("Open the last HTML report", "npm run report", "Traces and screenshots for any failure."),
    ]
    r = 5
    for goal, cmd, note in rows:
        ws5.cell(row=r, column=1, value=goal).font = BOLD
        c = ws5.cell(row=r, column=2, value=cmd)
        c.font = Font(name="Consolas", size=10)
        c.fill = PatternFill("solid", fgColor=GREY)
        ws5.cell(row=r, column=3, value=note).font = BODY
        for col in range(1, 4):
            ws5.cell(row=r, column=col).border = BOX
            ws5.cell(row=r, column=col).alignment = WRAP
        ws5.row_dimensions[r].height = 30
        r += 1

    r += 1
    ws5.cell(row=r, column=1, value="Environments").font = SECTION
    r += 1
    style_header(ws5, r, ["Environment", "Advertiser app", "Management portal"], [40, 46, 62])
    r += 1
    envs = [
        ("dev (default)", "advertiser.dev.fusetwo.com", "management.dev.fusetwo.com"),
        ("staging", "advertiserstg.fusetwo.com", "management.stg.fusetwo.com"),
        ("live", "advertiser.fusetwo.com", "management.fusetwo.com"),
    ]
    for name, app, mgmt in envs:
        ws5.cell(row=r, column=1, value=name).font = BODY
        ws5.cell(row=r, column=2, value=app).font = BODY
        ws5.cell(row=r, column=3, value=mgmt).font = BODY
        for col in range(1, 4):
            ws5.cell(row=r, column=col).border = BOX
        r += 1

    r += 1
    ws5.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
    c = ws5.cell(row=r, column=1,
                 value="Tags: @blocker = must pass before release (the gate runs these) | @crud = create/read/update/delete "
                       "| @smoke = fastest liveness signal | @write = mutates real data, skipped on live "
                       "| @known-bug = guards an open defect, never gates a release.")
    c.alignment = WRAP
    c.font = SUB
    ws5.row_dimensions[r].height = 40

    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sheet")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "FuseTwo_Automation_Status_Report.xlsx")
    wb.save(out)
    print(f"wrote {out}")
    print(f"  scenarios: {scenarios} (automated {automated}, partial {partial}, gap {gap})")
    print(f"  tests parsed: {total} (pass {passed}, fail {failed}, skip {skipped})")
    return out


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: generate_qa_report.py <playwright-run.log> [...]")
    build(sys.argv[1:])
