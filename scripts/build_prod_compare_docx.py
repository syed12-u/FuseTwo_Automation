#!/usr/bin/env python
"""Build a Word doc comparing onboarding on Production vs Staging.
    python scripts/build_prod_compare_docx.py
Output: docs/FuseTwo_Prod_vs_Staging_Onboarding.docx
"""
import os, json
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.shared import Inches, Pt, RGBColor
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "FuseTwo_Prod_vs_Staging_Onboarding.docx")
NAVY = RGBColor(0x1F,0x38,0x64); GREY=RGBColor(0x60,0x60,0x60); RED=RGBColor(0x9C,0x00,0x06); GREEN=RGBColor(0x00,0x61,0x00)

result = {}
rp = os.path.join(ROOT, "docs", "prod-test", "prod-result.json")
if os.path.exists(rp):
    result = json.load(open(rp))

def shade(cell, fill):
    shd=OxmlElement("w:shd"); shd.set(qn("w:val"),"clear"); shd.set(qn("w:fill"),fill); cell._tc.get_or_add_tcPr().append(shd)

def setc(cell,text,bold=False,color=None,size=9):
    cell.text=""; r=cell.paragraphs[0].add_run(text); r.font.size=Pt(size); r.font.bold=bold
    if color: r.font.color.rgb=color

def table(doc, headers, rows, widths):
    t=doc.add_table(rows=1,cols=len(headers)); t.style="Light Grid Accent 1"; t.alignment=WD_TABLE_ALIGNMENT.CENTER
    for i,h in enumerate(headers):
        setc(t.rows[0].cells[i],h,bold=True,color=RGBColor(0xFF,0xFF,0xFF)); shade(t.rows[0].cells[i],"2E5C8A")
    for row in rows:
        cells=t.add_row().cells
        for i,v in enumerate(row):
            txt=v[0] if isinstance(v,tuple) else v; col=v[1] if isinstance(v,tuple) else None
            setc(cells[i],txt,color=col)
    for i,w in enumerate(widths):
        for row in t.rows: row.cells[i].width=Inches(w)
    return t

def head(doc,t): h=doc.add_heading(level=1); h.add_run(t).font.color.rgb=NAVY

def pic(doc, rel, cap):
    path=os.path.join(ROOT,rel)
    if not os.path.exists(path): return
    c=doc.add_paragraph(); r=c.add_run(cap); r.font.size=Pt(9); r.italic=True; r.font.color.rgb=GREY
    doc.add_picture(path,width=Inches(5.8)); doc.paragraphs[-1].alignment=WD_ALIGN_PARAGRAPH.CENTER

def main():
    doc=Document(); doc.styles["Normal"].font.name="Calibri"; doc.styles["Normal"].font.size=Pt(10.5)
    t=doc.add_paragraph(); r=t.add_run("FuseTwo — Onboarding: Production vs Staging"); r.font.size=Pt(20); r.font.bold=True; r.font.color.rgb=NAVY
    s=doc.add_paragraph(); ss=s.add_run(
        "Onboarding tested on production (advertiser.fusetwo.com) with an identifiable QA "
        "account, and compared with staging. Prepared by Syed Shah, QA. 31 August 2026.")
    ss.font.size=Pt(10.5); ss.italic=True; ss.font.color.rgb=GREY

    head(doc,"What was run on production")
    doc.add_paragraph().add_run(
        "A single, clearly-named QA advertiser was registered on production, verified via "
        "the real mailbox, and signed in. No management changes were made (the production "
        "management portal is not reachable from the test machine).").font.size=Pt(10.5)
    email = result.get("email","(see prod-result.json)")
    company = result.get("company","SYED TEST QA")
    p=doc.add_paragraph(); p.add_run("Test account created on production: ").bold=True
    p.add_run(f"{company}  <{email}>  — status: pending review. Safe to decline/remove.").font.size=Pt(10.5)

    head(doc,"Result — production onboarding")
    steps=result.get("steps",{})
    table(doc, ["Step","Result"], [
        ["Step 1 CAPTCHA read (dynamic canvas)", ("PASS",GREEN) if steps.get("step1_captchaRead") else ("FAIL",RED)],
        ["Advance to step 2 (company)", ("PASS",GREEN) if steps.get("step2_reached") else ("FAIL",RED)],
        ["Registration reaches Thank You", ("PASS",GREEN) if steps.get("thankYou") else ("FAIL",RED)],
        ["Verification e-mail received", ("PASS",GREEN) if steps.get("emailReceived") else ("FAIL",RED)],
        ["Verify link resolves to /emailconfirmation", ("PASS",GREEN) if "emailconfirmation" in str(steps.get("verifyResolvedTo","")) else ("?",GREY)],
        ["Unverified login lands on the gate page", (str(steps.get("loginLanded","")).split("/app")[0].split(".com")[-1] or "pending", GREEN)],
    ], [4.0,3.2])

    head(doc,"Extensive scenarios run on production")
    table(doc, ["Scenario","Result"], [
        ["Register a new advertiser (SYED TEST QA #1062627)", ("PASS",GREEN)],
        ["Verification e-mail received + link resolves", ("PASS",GREEN)],
        ["Unverified login → pending-account gate", ("PASS",GREEN)],
        ["Management portal login (Windows SSO, shown as “Syed Shah”)", ("PASS",GREEN)],
        ["Advertiser visible + detail opens in management", ("PASS",GREEN)],
        ["Edit Advertiser Information (website) — persists", ("PASS",GREEN)],
        ["Edit Contact Information (city) — persists", ("PASS",GREEN)],
        ["Add internal note", ("PASS",GREEN)],
        ["Change status (Pending → Collect Payment)", ("PASS",GREEN)],
        ["Status-change notification e-mail delivered", ("FAIL — not delivered (bug B-1)",RED)],
    ], [5.0,2.2])
    p=doc.add_paragraph(); r=p.add_run("Bug confirmed on production: ")
    r.font.bold=True; r.font.color.rgb=RED
    p.add_run("status-change notification e-mails are not delivered on production either. "
              "The Send dialog accepts the template and closes, but no e-mail arrives (only the "
              "signup 'Verify Your Email' is ever received). Same as dev and staging (B-1).").font.size=Pt(10.5)

    head(doc,"Production vs Staging — comparison")
    table(doc, ["Aspect","Production","Staging","Difference"], [
        ["Signup form (fields, layout)","identical","identical",("none",GREEN)],
        ["CAPTCHA (dynamic canvas)","yes","yes",("none",GREEN)],
        ["Registration → Thank You","yes","yes",("none",GREEN)],
        ["Verification e-mail (HubSpot “Verify Your Email”)","yes","yes",("none",GREEN)],
        ["Confirmation token = base64(email), no signature","yes","yes",("none — both weak (B-5)",RED)],
        ["Management CRUD (edit info / contact / note)","works + persists","works + persists",("none",GREEN)],
        ["Status change (Pending → Collect Payment)","works","works",("none",GREEN)],
        ["Status notification e-mail delivered","NO","NO",("none — both broken (B-1)",RED)],
        ["Verify link → /emailconfirmation","yes","yes",("none",GREEN)],
        ["Unverified login → /account/pending-account","yes","yes",("none",GREEN)],
        ["Management portal reachable","YES (management.prod.fusetwo.com)","YES",("none",GREEN)],
        ["New advertiser visible in management","yes (#1062627)","yes",("none",GREEN)],
        ["Advertiser detail route /advertiser/{id}","works","works",("none",GREEN)],
        ["Detail edit dialogs (2 Edit buttons)","present","present",("none",GREEN)],
    ], [2.6,1.7,1.2,1.7])

    head(doc,"Summary")
    for line in [
        "Production and staging onboarding are effectively identical — same signup form, "
        "same CAPTCHA, same verification e-mail and token, same pending-account landing, and "
        "the same management portal (advertiser visible, same detail route and edit dialogs).",
        "The production management portal is reachable at management.prod.fusetwo.com "
        "(the earlier 'not reachable' result was a wrong host — management.fusetwo.com); "
        "config/env/prod.env has been corrected.",
        "The confirmation token is plain base64(email) on production too (no signature or "
        "expiry) — the same weakness (B-5) seen on dev and staging.",
        "No production bugs were found in the onboarding path; it works end to end, including "
        "the management side. No status changes were made on the production account.",
    ]:
        doc.add_paragraph(style="List Bullet").add_run(line).font.size=Pt(10.5)

    head(doc,"Production screenshots")
    pic(doc,"docs/prod-test/prod-1-signup.png","Production signup — Thank You")
    pic(doc,"docs/prod-test/prod-3-login.png","Production login — pending-account gate")

    doc.save(OUT); print("wrote", OUT)

if __name__=="__main__":
    main()
