#!/usr/bin/env python
"""
Build the daily progress report (.docx).

    python scripts/build_progress_docx.py

Output: docs/FuseTwo_Progress_Report.docx
"""

import os

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "FuseTwo_Progress_Report.docx")

NAVY = RGBColor(0x1F, 0x38, 0x64)
BLUE = RGBColor(0x2E, 0x5C, 0x8A)
GREY = RGBColor(0x60, 0x60, 0x60)
GREEN = RGBColor(0x00, 0x61, 0x00)
RED = RGBColor(0x9C, 0x00, 0x06)
AMBER = RGBColor(0x9C, 0x65, 0x00)


def shade(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), hex_color)
    tcPr.append(shd)


def set_cell(cell, text, *, bold=False, color=None, size=9):
    cell.text = ""
    p = cell.paragraphs[0]
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.font.bold = bold
    if color:
        run.font.color.rgb = color


def add_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Light Grid Accent 1"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        set_cell(table.rows[0].cells[i], h, bold=True)
        shade(table.rows[0].cells[i], "2E5C8A")
        for r in table.rows[0].cells[i].paragraphs[0].runs:
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    for row in rows:
        cells = table.add_row().cells
        for i, value in enumerate(row):
            text = value[0] if isinstance(value, tuple) else value
            color = value[1] if isinstance(value, tuple) else None
            set_cell(cells[i], text, color=color)
    if widths:
        for i, w in enumerate(widths):
            for row in table.rows:
                row.cells[i].width = Inches(w)
    return table


def heading(doc, text, level, color=NAVY):
    h = doc.add_heading(level=level)
    run = h.add_run(text)
    run.font.color.rgb = color
    return h


def body(doc, text, *, italic=False, color=None, size=10.5):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.italic = italic
    if color:
        run.font.color.rgb = color
    return p


def bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.add_run(text).font.size = Pt(10.5)
    return p


def main():
    doc = Document()
    doc.styles["Normal"].font.name = "Calibri"
    doc.styles["Normal"].font.size = Pt(10.5)

    # ---- title ----
    title = doc.add_paragraph()
    run = title.add_run("FuseTwo E2E Automation — Progress Report")
    run.font.size = Pt(22)
    run.font.bold = True
    run.font.color.rgb = NAVY
    sub = doc.add_paragraph()
    r = sub.add_run(
        "Cumulative status of the Playwright automation suite. One suite, run against "
        "dev, staging or live. Prepared by Syed Shah, QA. As of 24 August 2026."
    )
    r.font.size = Pt(10.5)
    r.italic = True
    r.font.color.rgb = GREY

    # ---- headline ----
    heading(doc, "Headline", 1)
    for line in [
        "One Playwright suite runs against dev, staging or live via a single TEST_ENV switch.",
        "A release gate ('npm run gate') runs only blocker-tagged scenarios — one command per release candidate.",
        "Data-mutating tests are excluded from live runs automatically unless explicitly enabled.",
        "Open defects are automated as tagged regression guards, kept out of the gate so they never mask a new failure.",
        "Coverage now spans Auth, Onboarding (both portals + real mailbox), and Programs full CRUD.",
    ]:
        bullet(doc, line)

    # ---- coverage by area ----
    heading(doc, "Coverage delivered", 1)
    add_table(
        doc,
        ["Area", "Tests", "What it covers", "Env verified"],
        [
            ("Auth & Session", "11", "Sign-in, wrong-password, account-enumeration safety, empty-form, credential-leak guard, logout, session", "dev, staging"),
            ("Onboarding — Signup", "6", "Full registration, dynamic CAPTCHA, duplicate email, validation", "dev, staging"),
            ("Onboarding — Lifecycle", "5", "Register → verify-gated → management status changes → per-stage access", "dev, staging"),
            ("Onboarding — Verification", "9", "Real mailbox (Outlook/Graph), verification link, per-status landing pages", "dev"),
            ("Onboarding — Status email", "3", "Status-change notification dialog, templates, delivery", "dev, staging"),
            ("Programs — CRUD", "5", "Create, read-back, update (persist), deactivate, Add-Program gate", "dev, staging"),
            ("Programs — Listing", "5", "Status tabs, columns, detail open — read-only, gate-safe on live", "dev, staging"),
            ("Programs — existing", "2", "Create program, Product Feed create/import/deactivate (repaired)", "dev"),
            ("Campaigns — Listing", "4", "Tabs, columns, Add Campaign — read-only", "dev"),
            ("Creatives — Listing", "5", "Status tabs, Add Text Link / Add Banner entry points", "dev"),
            ("Dashboard", "7", "Loads, widgets, nav, API-flood + error-toast guards (#680 / #690)", "dev"),
            ("Management portal", "3", "Windows SSO access, navigation, no failed APIs", "dev, staging"),
            ("Reporting / Nav / Executive", "~35", "Existing suites (sales, clicks, performance, navigation, executive)", "dev"),
        ],
        widths=[1.9, 0.7, 3.6, 1.3],
    )

    # ---- today ----
    heading(doc, "Most recent session — Programs, listings and Dashboard", 1)
    add_table(
        doc,
        ["Work item", "Status", "Notes"],
        [
            ("Programs listing / detail (read-only)", ("Done", GREEN), "5 tests; safe on live (no writes)."),
            ("Programs create / read / update / deactivate", ("Done", GREEN), "5 tests; each acts only on a program it creates itself."),
            ("Repaired testCreateProgram", ("Done", GREEN), "Was a 2-min timeout; direct-navigation fix → 16s."),
            ("Repaired testProductFeed", ("Done", GREEN), "Was a 2-min timeout; direct-navigation fix → 19s."),
            ("Campaigns + Creatives listing", ("Done", GREEN), "9 read-only tests."),
            ("Dashboard suite fixed + hardened", ("Done", GREEN), "7 tests; payment-modal flakiness fixed; added #680/#690 API-flood and error-toast guards."),
            ("Ran Programs suite on staging", ("Done", GREEN), "11/11 pass against advertiserstg."),
        ],
        widths=[3.0, 0.9, 3.6],
    )
    body(
        doc,
        "Notable findings while building this: the app's sidebar navigation labels had "
        "changed (breaking the two old specs); the program editor is a multi-tab wizard "
        "whose form values hydrate a moment after mount (typing too early was silently "
        "overwritten); the save toast fires just before the write settles server-side; and "
        "the dashboard's earlier intermittent failures were caused by the payment-reminder "
        "modal, not the product.",
        italic=True,
        color=GREY,
        size=9.5,
    )
    body(
        doc,
        "Environment note: the Dashboard widget checks are verified on dev, where the test "
        "account is an approved advertiser with data. On staging the same login lands on an "
        "empty dashboard (the account is not a fully-approved advertiser there), so those "
        "widget assertions need an approved staging account before they can gate staging.",
        italic=True,
        color=AMBER,
        size=9.5,
    )

    # ---- bugs ----
    heading(doc, "Open bugs found by the automation", 1)
    add_table(
        doc,
        ["#", "Severity", "Bug", "State"],
        [
            ("B-1", ("High", RED), "Status notification e-mails do not send (Send reports success, nothing delivered)", "New"),
            ("B-2", ("High (Security)", RED), "Wrong CAPTCHA accepted at signup", "#681 — reproduces"),
            ("B-3", ("Medium", AMBER), "$50 vs $100 monthly minimum on Collect Payment page", "#762"),
            ("B-4", ("Low", None), "'Required field*' helper appears after valid input", "#686"),
            ("B-5", ("Low", None), "Confirmation page shows 'verified' on an invalid token", "New"),
            ("B-6", ("Question", None), "Follow Up status is identical to Pending for the advertiser", "Needs confirmation"),
        ],
        widths=[0.5, 1.2, 4.3, 1.5],
    )
    body(
        doc,
        "Details and evidence for each are in FuseTwo_Onboarding_Scenarios.docx. B-1 and "
        "B-5 are new and not yet on the board.",
        italic=True,
        color=GREY,
        size=9.5,
    )

    # ---- how to run ----
    heading(doc, "How to run", 1)
    add_table(
        doc,
        ["Goal", "Command"],
        [
            ("Full suite on dev / staging / live", "npm test  /  npm run test:staging  /  npm run test:prod"),
            ("Release gate (blocker scenarios only)", "npm run gate:staging"),
            ("Check open defects", "npm run known-bugs"),
            ("Just the Programs suite", "npx playwright test e2e/Programs --project=chromium"),
        ],
        widths=[3.3, 4.0],
    )

    # ---- next ----
    heading(doc, "Next", 1)
    for line in [
        "Extend CRUD to Campaigns, Creatives and Coupons (currently listing + create only).",
        "Publishers and Settings / My Account coverage.",
        "Provide an approved advertiser account on staging so the Dashboard widget checks can gate there too.",
        "Log B-1 (status e-mail) and B-5 (confirmation page) on the board.",
        "Confirm the intended per-status landing pages so those assertions can be locked as the contract.",
    ]:
        bullet(doc, line)

    doc.save(OUT)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
