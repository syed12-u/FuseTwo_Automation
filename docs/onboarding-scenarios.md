# Advertiser onboarding — scenario reference

What an advertiser experiences from registration through every management status,
captured live on **dev** on **2026-08-24**. Screenshots are in
[`docs/stage-screens/`](stage-screens/). Every row here is backed by an automated
test in [`e2e/Onboarding/`](../e2e/Onboarding/).

The journey spans **both portals**: the advertiser app
(`advertiser.dev.fusetwo.com`) and the management portal
(`management.dev.fusetwo.com`), which is where staff move an account between
statuses.

---

## The journey at a glance

```
Register (advertiser app)
   │   account created, but sign-in is blocked
   ▼
Verify e-mail (link from the real inbox)
   │   account now signs in, lands on its status page
   ▼
Management moves the account through statuses
   │
   ├── Pending          → "application under review"
   ├── Collect Payment  → agreement + pricing, "You Have Been Approved"
   ├── Initial Setup    → dashboard, gated by a Terms & Conditions modal
   ├── Follow Up        → back to "application under review"
   ├── Approved         → full dashboard (T&C modal on first entry)
   ├── Deactivated      → "account has been deactivated"  (sign-in blocked)
   └── Declined         → "application declined"          (sign-in blocked)
```

---

## Bugs and issues found during this work

Everything below was reproduced with an automated test or a scripted probe on
**dev** while building the onboarding coverage. New items are not yet on the
board.

| # | Severity | Bug | Where | Evidence | State |
|---|---|---|---|---|---|
| B-1 | High | **Status notification e-mails do not send.** The "Advertiser Email Notification" Send reports success and closes, but no e-mail is delivered. | Management → status change | Many status changes + explicit Send of "Approval Login Information": 0 mails in 3 min, while "Verify Your Email" arrives in ~1 min. | New |
| B-2 | High (Security) | **Wrong CAPTCHA accepted.** A deliberately wrong CAPTCHA advances registration to step 2. | Signup step 1 | `testSignup.spec.ts` "a wrong CAPTCHA is rejected" fails. | #681 — board says Done, still reproduces |
| B-3 | Medium | **$50 vs $100 monthly minimum.** The Collect Payment page shows a $50 monthly minimum; management Pricing Schedule shows $100. Customer-facing. | Advertiser Collect Payment page | Screenshot `2-CollectPayment.png`. | #762 (open) |
| B-4 | Low | **"Required field*" helper appears after valid input** and does not hide. | Signup step 1 | `testSignup.spec.ts` helper test fails; count goes 0 → 1 after a valid value. | #686 (open) |
| B-5 | Low | **Confirmation page lies on an invalid token.** A forged `/emailconfirmation?userref=<base64(email)>` shows "Your email has been verified!", though sign-in stays blocked (account is not actually verified). | Advertiser e-mail confirmation | Scripted forge probe. | New (minor UX; not an auth bypass) |
| B-6 | Question | **Follow Up is identical to Pending** for the advertiser — same URL, same copy. May be intended. | Advertiser account gate | Stage capture: both land on `/account/pending-account`. | Needs product confirmation |

Positive findings worth recording:

- **#684 is fixed on dev** — the management Advertiser Detail page renders in
  full (no "Coming Soon").
- **Unverified sign-in is correctly blocked**, and only **Approved** reaches the
  dashboard; Declined / Deactivated are kept out.
- The forged-token check (B-5) shows the token cannot actually verify an
  account — the concern is only the misleading message.

## Registration (advertiser app)

Three steps, then a thank-you screen. Covered by
[`testSignup.spec.ts`](../e2e/Onboarding/testSignup.spec.ts).

| # | Step | Fields | Notes |
|---|---|---|---|
| 1 | Your Information | first/last name, email + confirm, password + confirm, security question + answer, **CAPTCHA** | CAPTCHA is drawn on a `<canvas>` and regenerated every load |
| 2 | Company Information | company, website, address, country, city, state, zip, phone, agency?, platform | dropdowns are native comboboxes |
| 3 | Program Information | in another affiliate network?, network, active publishers | answering "No" is enough to submit |

| Scenario | Tag | Result |
|---|---|---|
| A new advertiser can register end to end | `@blocker @write @crud` | ✅ pass |
| The CAPTCHA answer is regenerated on every load | `@security` | ✅ pass |
| An empty step 1 cannot be submitted (Continue disabled) | `@blocker` | ✅ pass |
| An already-registered email cannot proceed | `@write` | ✅ pass |
| A wrong CAPTCHA is rejected | `@security @known-bug` | ❌ reproduces **#681** — wrong CAPTCHA advances |
| "Required field*" hides after valid input | `@known-bug` | ❌ reproduces **#686** — appears after valid input |

The registration e-mail is sent through **HubSpot**; the verification link is a
HubSpot tracking redirect (`hubspotlinks.com/...`), not a link on the advertiser
host. It resolves to `…/emailconfirmation?userref=<base64(email)>`.

---

## Per-status experience (verified advertiser)

Covered by
[`testEmailVerification.spec.ts`](../e2e/Onboarding/testEmailVerification.spec.ts).
Each status is set from the management portal, then the advertiser signs in and
the landing page is asserted.

| Status | Landing path | What the advertiser sees | Reaches dashboard? | Screenshot |
|---|---|---|---|---|
| **Unverified** | `/signin` | "This account needs to be verified…" | No | [0-unverified.png](stage-screens/0-unverified.png) |
| **Pending** | `/account/pending-account` | "Your application is currently being reviewed." | No | [1-Pending.png](stage-screens/1-Pending.png) |
| **Collect Payment** | `/account/collect-payment` | "You Have Been Approved / Congratulations!" + Advertiser Agreement, **Pricing Schedule**, signature form | No | [2-CollectPayment.png](stage-screens/2-CollectPayment.png) |
| **Initial Setup** | `/app/settings/advertisersetup` | Dashboard shell behind a **Terms & Conditions** modal that must be accepted | Gated | [3-InitialSetup.png](stage-screens/3-InitialSetup.png) |
| **Follow Up** | `/account/pending-account` | "Your application is currently being reviewed." (same as Pending) | No | [4-FollowUp.png](stage-screens/4-FollowUp.png) |
| **Approved** | `/app/dashboard` | Full dashboard (T&C modal on first entry, then widgets) | **Yes** | [5-Approved.png](stage-screens/5-Approved.png) |
| **Deactivated** | `/account/deactivated-account` | "…your FuseTwo account has been deactivated." | No | [6-Deactivated.png](stage-screens/6-Deactivated.png) |
| **Declined** | `/account/declined-account` | "Thank you for applying… application declined." | No | [7-Declined.png](stage-screens/7-Declined.png) |

### Notes worth raising

- **Only `Approved` grants the dashboard.** Every other status routes to a
  dedicated gate page. This is the security property the suite now asserts.
- **`Follow Up` is indistinguishable from `Pending`** — same URL, same copy. If
  they are meant to differ for the advertiser, that is a gap.
- **`Collect Payment` shows the Pricing Schedule with a `$50` monthly minimum** —
  this is the advertiser-facing side of **bug #762** (agreement `$50` vs the
  management Pricing Schedule `$100`).
- **`Initial Setup` and `Approved` both surface a Terms & Conditions modal**
  before the dashboard is usable; automation dismisses it where needed.

---

## Status-change e-mail notifications

Changing a status does **not** send an e-mail by itself. Submitting a status
change opens an **"Advertiser Email Notification"** dialog where staff optionally
choose a template and press **Send**. Covered by
[`testStatusEmail.spec.ts`](../e2e/Onboarding/testStatusEmail.spec.ts).

Templates offered (both dev and staging):

- Advertiser or Publisher
- Approval Login Information
- Collect Payment - Application Accepted
- Collect Payment - Free
- Deactivated - Letter
- Declined - Advertiser Application
- Follow Up - Free
- Initial Setup - Payment Confirmation & Instruction

| Scenario | Tag | Result |
|---|---|---|
| Status change opens the dialog, pre-addressed to the advertiser, with the templates above | `@blocker` | ✅ pass |
| Sending a template delivers an e-mail to the advertiser | `@known-bug` | ❌ **no e-mail delivered** |

**Finding — status notification e-mails do not dispatch.** On Send the dialog
accepts the template and closes cleanly, but no e-mail arrives. Confirmed on dev
(2026-08-24): across many status changes plus an explicit Send of the "Approval
Login Information" template, **zero** notification e-mails reached the advertiser
inbox within 3 minutes, while "Verify Your Email" consistently arrives within a
minute — so the mail path works, but status notifications silently fail to send.
The test keeps a real delivery assertion so it will pass (and the tag be
removed) once this is fixed.

## Management status control

Covered by
[`testOnboardingLifecycle.spec.ts`](../e2e/Onboarding/testOnboardingLifecycle.spec.ts)
and [`ManagementAdvertiserPage`](../pages/ManagementAdvertiserPage.ts).

- Advertiser detail is reached from the overview search ("Search by Advertiser
  ID | Name"); the result row's link carries the advertiser id.
- **Actions → Change Status** opens a dialog with a native `<select>`. Options:
  Pending, Collect Payment, Initial Setup, Follow Up, Approved, Declined,
  Deactivated, Fraud, Removed due to Audit, Collect Payment - Free,
  Follow Up - Free. Notes are optional.
- The detail panel renders statuses **without spaces** ("CollectPayment") while
  the dropdown uses spaces ("Collect Payment") — comparisons are normalised.
- Bug **#684** ("Advertiser Detail — Coming Soon") is **fixed on dev**: the
  detail page renders in full.

| Scenario | Tag | Result |
|---|---|---|
| Register → reaches thank-you | `@blocker @crud` | ✅ |
| New account cannot sign in until verified | `@blocker @security` | ✅ |
| New advertiser appears in management | `@blocker` | ✅ |
| Management moves through Collect Payment → Initial Setup → Follow Up | `@crud` | ✅ |
| A declined advertiser is kept out | `@security` | ✅ |
| Verification e-mail arrives with a link | `@blocker` | ✅ (mailbox required) |
| Verification link enables sign-in | `@blocker @crud` | ✅ (mailbox required) |
| Each status lands on its correct page | `@crud` | ✅ (mailbox required) |
| A deactivated advertiser cannot sign in | `@security` | ✅ (mailbox required) |

---

## How the mailbox is read

Verification needs the real e-mail, so tests read the actual QA inbox — no fake
mail domain. Two backends, chosen automatically
([`utility/mailbox.ts`](../utility/mailbox.ts)):

- **Outlook COM** (local, default on this workstation) — reuses the signed-in
  Outlook profile. No credentials, no app registration.
- **Microsoft Graph** (for CI) — an Azure AD app registration with `Mail.Read`.
  Set `GRAPH_TENANT_ID` / `GRAPH_CLIENT_ID` / `GRAPH_CLIENT_SECRET`.

Where neither is available, the mailbox-backed tests **skip with a clear reason**
rather than passing as if covered.

Every signup is plus-addressed (`syed.shah+auto…@flexoffers.com`), so one inbox
receives them all and each e-mail maps back to the test that created it.

### Security note found while building this

The confirmation token is just `base64(email)` — no signature or expiry. A
forged link produces the page "Your email has been verified!", **but sign-in
stays blocked**, so it does not actually verify the account. The misleading
success message on an invalid token is a minor UX issue; the account is not
actually verifiable this way.

---

## Open questions for the team

1. **Status notification e-mails do not send.** The Send button reports success
   but nothing is delivered — needs a fix, then the `@known-bug` tag comes off
   the delivery test.
2. Should **Follow Up** look different from **Pending** to the advertiser? They
   are identical today.
3. Confirm the intended landing page for each status, so the assertions can be
   locked as the contract. Current mapping is in
   [`fixtures/onboardingData.ts`](../fixtures/onboardingData.ts) (`STAGE_LANDING`).
4. **#762** ($50 vs $100 minimum) is visible on the Collect Payment page — worth
   prioritising since it is customer-facing.

---

## Full scenario checklist

| Area | Scenario | Tag | Status |
|---|---|---|---|
| Registration | Register end to end | `@blocker @write @crud` | ✅ |
| Registration | CAPTCHA regenerates every load | `@security` | ✅ |
| Registration | Empty step 1 cannot submit | `@blocker` | ✅ |
| Registration | Duplicate email cannot proceed | `@write` | ✅ |
| Registration | Wrong CAPTCHA rejected | `@known-bug` | ❌ #681 |
| Registration | "Required field*" hides after valid input | `@known-bug` | ❌ #686 |
| Verification | E-mail arrives with a link | `@blocker` | ✅ |
| Verification | Link enables sign-in | `@blocker @crud` | ✅ |
| Lifecycle | New account blocked until verified | `@blocker @security` | ✅ |
| Lifecycle | Advertiser appears in management | `@blocker` | ✅ |
| Lifecycle | Moves through onboarding stages | `@crud` | ✅ |
| Lifecycle | Declined kept out | `@security` | ✅ |
| Per-stage | Each status lands on its correct page | `@crud` | ✅ |
| Per-stage | Deactivated cannot sign in | `@security` | ✅ |
| Status e-mail | Dialog opens, pre-addressed, templates present | `@blocker` | ✅ |
| Status e-mail | Sending delivers an e-mail | `@known-bug` | ❌ not delivered |

Runs identically on **dev, staging and live** via `TEST_ENV`. All `@write`, so
excluded from live runs unless explicitly enabled. Verified headed on dev
(21 tests) on 2026-08-24.
