#!/usr/bin/env python
"""
Build a Word (.docx) version of the advertiser onboarding scenario reference,
with the per-stage screenshots embedded.

    python scripts/build_onboarding_docx.py

Output: docs/FuseTwo_Onboarding_Scenarios.docx
"""

import json
import os

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENS = os.path.join(ROOT, "docs", "stage-screens")
OUT = os.path.join(ROOT, "docs", "FuseTwo_Onboarding_Scenarios.docx")

NAVY = RGBColor(0x1F, 0x38, 0x64)
BLUE = RGBColor(0x2E, 0x5C, 0x8A)
GREY = RGBColor(0x60, 0x60, 0x60)
GREEN = RGBColor(0x00, 0x61, 0x00)
RED = RGBColor(0x9C, 0x00, 0x06)


def shade(cell, hex_color):
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), hex_color)
    tcPr.append(shd)


def header_row(table):
    for cell in table.rows[0].cells:
        shade(cell, "2E5C8A")
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                r.font.bold = True
                r.font.size = Pt(9)


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
    header_row(table)
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
    stages = {}
    stages_json = os.path.join(SCREENS, "stages.json")
    if os.path.exists(stages_json):
        stages = json.load(open(stages_json, encoding="utf-8"))

    doc = Document()
    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)

    # ---- title ----
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = title.add_run("Advertiser Onboarding — Scenario Reference")
    run.font.size = Pt(22)
    run.font.bold = True
    run.font.color.rgb = NAVY

    sub = doc.add_paragraph()
    r = sub.add_run(
        "What an advertiser experiences from registration through every management "
        "status. Captured live on the dev environment on 24 August 2026. "
        "Prepared by Syed Shah, QA."
    )
    r.font.size = Pt(10.5)
    r.italic = True
    r.font.color.rgb = GREY

    body(
        doc,
        "Every scenario in this document is backed by an automated Playwright test "
        "in e2e/Onboarding/. The journey spans both the advertiser app and the "
        "management portal, where staff move an account between statuses.",
    )

    # ---- bugs found ----
    heading(doc, "Bugs and issues found during this work", 1)
    body(
        doc,
        "Everything below was reproduced with an automated test or a scripted probe on "
        "dev while building the onboarding coverage. New items are not yet on the board.",
    )
    bug_table = add_table(
        doc,
        ["#", "Severity", "Bug", "Where", "Evidence", "State"],
        [
            ("B-1", ("High", RED), "Status notification e-mails do not send — Send reports success and closes, but nothing is delivered.",
             "Management → status change",
             "Many status changes + explicit Send: 0 mails in 3 min, while “Verify Your Email” arrives in ~1 min.",
             ("New", RED)),
            ("B-2", ("High (Security)", RED), "Wrong CAPTCHA accepted — a deliberately wrong CAPTCHA advances registration to step 2.",
             "Signup step 1",
             "testSignup.spec.ts “a wrong CAPTCHA is rejected” fails.",
             "#681 — board says Done, still reproduces"),
            ("B-3", ("Medium", None), "$50 vs $100 monthly minimum — Collect Payment page shows $50; management Pricing Schedule shows $100. Customer-facing.",
             "Advertiser Collect Payment page",
             "Screenshot 2-CollectPayment.png.",
             "#762 (open)"),
            ("B-4", ("Low", None), "“Required field*” helper appears after valid input and does not hide.",
             "Signup step 1",
             "Helper count goes 0 → 1 after a valid value.",
             "#686 (open)"),
            ("B-5", ("Low", None), "Confirmation page lies on an invalid token — a forged link shows “Your email has been verified!”, though sign-in stays blocked.",
             "Advertiser e-mail confirmation",
             "Scripted forge probe.",
             "New (minor UX; not an auth bypass)"),
            ("B-6", ("Question", None), "Follow Up is identical to Pending for the advertiser — same URL, same copy. May be intended.",
             "Advertiser account gate",
             "Stage capture: both land on /account/pending-account.",
             "Needs product confirmation"),
        ],
        widths=[0.5, 1.1, 2.3, 1.4, 2.0, 1.4],
    )
    for row in bug_table.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(8)
    body(doc, "Positive findings worth recording:")
    for line in [
        "#684 is fixed on dev — the management Advertiser Detail page renders in full (no “Coming Soon”).",
        "Unverified sign-in is correctly blocked, and only Approved reaches the dashboard; Declined / Deactivated are kept out.",
        "The forged-token check (B-5) shows the token cannot actually verify an account — the concern is only the misleading message.",
    ]:
        bullet(doc, line)

    # ---- journey ----
    heading(doc, "The journey at a glance", 1)
    for line in [
        "Register on the advertiser app — account created, but sign-in is blocked.",
        "Verify e-mail via the link from the real inbox — the account can now sign in.",
        "Management moves the account through statuses, each with its own advertiser view.",
        "Only “Approved” grants the dashboard; every other status routes to a gate page.",
    ]:
        bullet(doc, line)

    # ---- registration ----
    heading(doc, "Registration (advertiser app)", 1)
    body(
        doc,
        "Three steps, then a thank-you screen. Covered by testSignup.spec.ts.",
    )
    add_table(
        doc,
        ["Step", "Fields", "Notes"],
        [
            ("1. Your Information", "name, email + confirm, password + confirm, security Q + A, CAPTCHA", "CAPTCHA drawn on a canvas, regenerated every load"),
            ("2. Company Information", "company, website, address, country, city, state, zip, phone, agency?, platform", "native combobox dropdowns"),
            ("3. Program Information", "in another affiliate network?, network, active publishers", "answering “No” is enough to submit"),
        ],
        widths=[1.7, 3.2, 2.1],
    )

    heading(doc, "Registration scenarios", 2, BLUE)
    add_table(
        doc,
        ["Scenario", "Tag", "Result"],
        [
            ("A new advertiser can register end to end", "@blocker @write @crud", ("PASS", GREEN)),
            ("The CAPTCHA answer is regenerated on every load", "@security", ("PASS", GREEN)),
            ("An empty step 1 cannot be submitted", "@blocker", ("PASS", GREEN)),
            ("An already-registered email cannot proceed", "@write", ("PASS", GREEN)),
            ("A wrong CAPTCHA is rejected", "@security @known-bug", ("FAILS — reproduces #681", RED)),
            ("“Required field*” hides after valid input", "@known-bug", ("FAILS — reproduces #686", RED)),
        ],
        widths=[3.6, 2.0, 1.9],
    )
    body(
        doc,
        "The registration e-mail is sent through HubSpot; the verification link is a "
        "HubSpot tracking redirect, not a link on the advertiser host. It resolves to "
        "/emailconfirmation?userref=<base64(email)>.",
        italic=True,
        color=GREY,
        size=9.5,
    )

    # ---- per-status ----
    heading(doc, "Per-status experience (verified advertiser)", 1)
    body(
        doc,
        "Each status is set from the management portal, then the advertiser signs in "
        "and the landing page is asserted. Covered by testEmailVerification.spec.ts.",
    )
    add_table(
        doc,
        ["Status", "Landing path", "What the advertiser sees", "Dashboard?"],
        [
            ("Unverified", "/signin", "“This account needs to be verified…”", ("No", RED)),
            ("Pending", "/account/pending-account", "“Your application is currently being reviewed.”", ("No", RED)),
            ("Collect Payment", "/account/collect-payment", "“You Have Been Approved” + Agreement, Pricing Schedule, signature form", ("No", RED)),
            ("Initial Setup", "/app/settings/advertisersetup", "Dashboard shell behind a Terms & Conditions modal", ("Gated", GREY)),
            ("Follow Up", "/account/pending-account", "Same as Pending", ("No", RED)),
            ("Approved", "/app/dashboard", "Full dashboard (T&C modal on first entry)", ("Yes", GREEN)),
            ("Deactivated", "/account/deactivated-account", "“…your FuseTwo account has been deactivated.”", ("No", RED)),
            ("Declined", "/account/declined-account", "“…application declined.”", ("No", RED)),
        ],
        widths=[1.3, 1.9, 3.0, 0.9],
    )

    heading(doc, "Notes worth raising", 2, BLUE)
    for line in [
        "Only “Approved” grants the dashboard. Every other status routes to a dedicated gate page — the suite asserts this.",
        "“Follow Up” is indistinguishable from “Pending” — same URL, same copy. If they should differ for the advertiser, that is a gap.",
        "“Collect Payment” shows the Pricing Schedule with a $50 monthly minimum — the advertiser-facing side of bug #762 ($50 vs $100 in management).",
        "“Initial Setup” and “Approved” both surface a Terms & Conditions modal before the dashboard is usable.",
    ]:
        bullet(doc, line)

    # ---- screenshots ----
    heading(doc, "Screenshots", 1)
    order = [
        ("0-unverified", "Unverified — sign-in blocked"),
        ("1-Pending", "Pending — application under review"),
        ("2-CollectPayment", "Collect Payment — approved, agreement & pricing"),
        ("3-InitialSetup", "Initial Setup — dashboard gated by T&C modal"),
        ("4-FollowUp", "Follow Up — same as Pending"),
        ("5-Approved", "Approved — full dashboard"),
        ("6-Deactivated", "Deactivated — account deactivated"),
        ("7-Declined", "Declined — application declined"),
    ]
    for filename, caption in order:
        path = os.path.join(SCREENS, filename + ".png")
        if not os.path.exists(path):
            continue
        cap = doc.add_paragraph()
        run = cap.add_run(caption)
        run.font.bold = True
        run.font.size = Pt(11)
        run.font.color.rgb = NAVY
        doc.add_picture(path, width=Inches(6.3))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER

    # ---- status-change email ----
    heading(doc, "Status-change email notifications", 1)
    body(
        doc,
        "Changing a status does NOT send an e-mail by itself. Submitting a status change "
        "opens an “Advertiser Email Notification” dialog where staff optionally choose a "
        "template and press Send. Covered by testStatusEmail.spec.ts.",
    )
    body(doc, "Templates offered (dev and staging):")
    for t in [
        "Advertiser or Publisher", "Approval Login Information",
        "Collect Payment - Application Accepted", "Collect Payment - Free",
        "Deactivated - Letter", "Declined - Advertiser Application",
        "Follow Up - Free", "Initial Setup - Payment Confirmation & Instruction",
    ]:
        bullet(doc, t)
    add_table(
        doc,
        ["Scenario", "Tag", "Result"],
        [
            ("Dialog opens, pre-addressed, with the templates above", "@blocker", ("PASS", GREEN)),
            ("Sending a template delivers an e-mail", "@known-bug", ("FAILS — no e-mail delivered", RED)),
        ],
        widths=[3.6, 1.6, 2.3],
    )
    p = doc.add_paragraph()
    r = p.add_run("Finding: ")
    r.font.bold = True
    r.font.size = Pt(10.5)
    r.font.color.rgb = RED
    p.add_run(
        "status notification e-mails do not dispatch. On Send the dialog accepts the "
        "template and closes cleanly, but no e-mail arrives. Confirmed on dev — across "
        "many status changes plus an explicit Send, zero notifications reached the inbox "
        "within 3 minutes, while “Verify Your Email” consistently arrives within a "
        "minute. The mail path works; status notifications silently fail to send."
    ).font.size = Pt(10.5)

    for filename, caption in [
        ("mgmt-after-status-submit", "The Advertiser Email Notification dialog after a status change"),
    ]:
        path = os.path.join(SCREENS, filename + ".png")
        if os.path.exists(path):
            cap = doc.add_paragraph()
            run = cap.add_run(caption)
            run.font.bold = True
            run.font.size = Pt(11)
            run.font.color.rgb = NAVY
            doc.add_picture(path, width=Inches(6.3))
            doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER

    # ---- management ----
    heading(doc, "Management status control", 1)
    for line in [
        "Advertiser detail is reached from the overview search (“Search by Advertiser ID | Name”); the result row's link carries the advertiser id.",
        "Actions → Change Status opens a dialog with a native dropdown: Pending, Collect Payment, Initial Setup, Follow Up, Approved, Declined, Deactivated, Fraud, Removed due to Audit, Collect Payment - Free, Follow Up - Free.",
        "The detail panel renders statuses without spaces (“CollectPayment”) while the dropdown uses spaces (“Collect Payment”) — comparisons are normalised.",
        "Bug #684 (“Advertiser Detail — Coming Soon”) is fixed on dev: the detail page renders in full.",
    ]:
        bullet(doc, line)

    # ---- mailbox ----
    heading(doc, "How the mailbox is read", 1)
    body(
        doc,
        "Verification needs the real e-mail, so tests read the actual QA inbox — no "
        "fake mail domain. Two backends, chosen automatically:",
    )
    bullet(doc, "Outlook COM (local, default here) — reuses the signed-in Outlook profile. No credentials, no app registration.")
    bullet(doc, "Microsoft Graph (for CI) — an Azure AD app registration with Mail.Read. Set GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET.")
    body(
        doc,
        "Where neither is available, the mailbox-backed tests skip with a clear reason "
        "rather than passing as if covered. Every signup is plus-addressed "
        "(syed.shah+auto…@flexoffers.com), so one inbox receives them all.",
    )
    p = doc.add_paragraph()
    r = p.add_run("Security note: ")
    r.font.bold = True
    r.font.size = Pt(10.5)
    p.add_run(
        "the confirmation token is just base64(email) — no signature or expiry. A "
        "forged link shows “Your email has been verified!” but sign-in stays "
        "blocked, so it does not actually verify the account. The misleading success "
        "message on an invalid token is a minor UX issue."
    ).font.size = Pt(10.5)

    # ---- open questions ----
    heading(doc, "Open questions for the team", 1)
    for line in [
        "Status notification e-mails do not send — the Send button reports success but nothing is delivered. Needs a fix, then the known-bug tag comes off the delivery test.",
        "Should Follow Up look different from Pending to the advertiser? They are identical today.",
        "Confirm the intended landing page for each status, so the assertions can be locked as the contract.",
        "#762 ($50 vs $100 minimum) is visible on the Collect Payment page — worth prioritising, since it is customer-facing.",
    ]:
        bullet(doc, line)

    # ---- full checklist ----
    heading(doc, "Full scenario checklist", 1)
    add_table(
        doc,
        ["Area", "Scenario", "Tag", "Status"],
        [
            ("Registration", "Register end to end", "@blocker @write @crud", ("PASS", GREEN)),
            ("Registration", "CAPTCHA regenerates every load", "@security", ("PASS", GREEN)),
            ("Registration", "Empty step 1 cannot submit", "@blocker", ("PASS", GREEN)),
            ("Registration", "Duplicate email cannot proceed", "@write", ("PASS", GREEN)),
            ("Registration", "Wrong CAPTCHA rejected", "@known-bug", ("FAIL #681", RED)),
            ("Registration", "“Required field*” hides after valid input", "@known-bug", ("FAIL #686", RED)),
            ("Verification", "E-mail arrives with a link", "@blocker", ("PASS", GREEN)),
            ("Verification", "Link enables sign-in", "@blocker @crud", ("PASS", GREEN)),
            ("Lifecycle", "New account blocked until verified", "@blocker @security", ("PASS", GREEN)),
            ("Lifecycle", "Advertiser appears in management", "@blocker", ("PASS", GREEN)),
            ("Lifecycle", "Moves through onboarding stages", "@crud", ("PASS", GREEN)),
            ("Lifecycle", "Declined kept out", "@security", ("PASS", GREEN)),
            ("Per-stage", "Each status lands on its correct page", "@crud", ("PASS", GREEN)),
            ("Per-stage", "Deactivated cannot sign in", "@security", ("PASS", GREEN)),
            ("Status e-mail", "Dialog opens, pre-addressed, templates present", "@blocker", ("PASS", GREEN)),
            ("Status e-mail", "Sending delivers an e-mail", "@known-bug", ("FAIL — not delivered", RED)),
        ],
        widths=[1.3, 3.1, 1.7, 1.3],
    )
    body(
        doc,
        "Runs identically on dev, staging and live via TEST_ENV. All @write, so excluded "
        "from live runs unless explicitly enabled. Verified headed on dev (21 tests) on "
        "24 August 2026.",
        italic=True,
        color=GREY,
        size=9.5,
    )

    if stages:
        body(
            doc,
            f"Capture reference: advertiser id {stages.get('id', '?')}, "
            f"{stages.get('email', '')}.",
            italic=True,
            color=GREY,
            size=9,
        )

    doc.save(OUT)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
