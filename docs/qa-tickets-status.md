# QA-Ready tickets — testability & status

Fetched from Azure Boards (`fusetwo/Development`), board column **"QA Ready"**,
excluding tickets that already carry a comment from **Jokima**.

- In "QA Ready": **45**
- Excluded (Jokima commented): **32**
- **To test: 13** (below)

Source of truth: `docs/qa-tickets.json` (regenerate with
`node scripts/fetch_qa_tickets.js`).

## Legend

- **E2E-now** — verifiable in the browser with the current setup.
- **E2E-needs-state** — verifiable, but needs a specific advertiser account
  state (e.g. an account at the "Select a Plan" step) or seeded data.
- **Not-UI** — backend / DB / AI-tuning; cannot be signed off from a browser
  test. Needs API/DB checks or dev confirmation.

## The 13

| # | Type | Title | Class | Status |
|---|---|---|---|---|
| 740 | PBI | Conversion Tracking > "Javascript" → "JavaScript", trim after `</script>` | E2E-needs-state | Blocked — the trackingpixel page renders empty for a non-approved account |
| 742 | PBI | Click ID Lookup > rename path, redirect old, "FuseTwo.com" → "FuseTwo" | **E2E-now** | **Partial** — new `/clickidlookup` loads ✅, "FuseTwo.com" removed ✅, **old `/clicksidlookup` does NOT redirect** ❌ |
| 703 | Bug | Self-Managed "ENROLLED" button should advance Advertiser Setup step | E2E-needs-state | Needs an advertiser at the "Select a Plan" step (fresh onboarding) |
| 220 | PBI | FuseTwo.com responsive & cross-browser QA (all marketing pages) | E2E-now | Not yet run — public marketing site, self-contained |
| 803 | Bug | Sales Detailed > Currency & Geo Location columns blank despite data | E2E-needs-state | Needs a sale with Currency/Geo values to assert non-blank |
| 774 | Bug (Critical) | Account Summary shows a startup invoice as paid when it is not | E2E-needs-state | Needs an advertiser moved to Initial Setup with an unpaid startup invoice |
| 800 | Bug | AI picks wrong Category/Subcategory for a brand (restaurant → Shopping) | Not-UI (AI) | AI-tuning; non-deterministic, verify by sampling |
| 743 | Bug | Management Tracking Event Dates in wrong time zone (should be ET) | E2E-needs-state | Needs known event data; timezone-correctness hard to assert generically |
| 426 | PBI | Control > Program Edit > Contact Info [FE] | E2E-needs-state | Legacy Control site (control.corp.flexoffers.com); dev build task |
| 476 | PBI | Control > Program Edit > Contact Info [BE] | Not-UI | Backend |
| 484 | PBI | Control > Program Edit > Payout History [BE] | Not-UI | Backend |
| 782 | Bug | Post Launch table not populated when a program goes live | Not-UI | Database — needs a DB/API check |
| 806 | PBI | Add/Update DefaultPayoutHistory table on program create/update | Not-UI | Database |

## Summary for sign-off

- **Can sign off from a browser test once green:** #742 (currently partial),
  #220 (to run), #740 (once the account is approved), #703 / #803 / #774 (once
  the right account state / seed data exists).
- **Cannot be signed off by QA automation in a browser:** #476, #484, #782,
  #806 (backend / DB), #800 (AI tuning). These need an API/DB check or a dev
  confirmation — automation should not mark them "verified".

## Blockers to clear

1. **Board write access.** Adding the "verified, ready to deploy" comment,
   attaching a screenshot and moving a ticket to Done needs a PAT with
   **Work Items (Read & Write)**. The current PAT is Read-only.
   Tool ready: `scripts/update_ticket.js` (supports `--dry-run`).
2. **Test-account state.** The shared advertiser account (1062551) is currently
   in **Initial Setup**, not Approved — which blanks the dashboard and several
   settings/reports pages. Restoring it to Approved (or provisioning dedicated
   accounts per state) unblocks #740 and the Dashboard suite.

Only tickets that actually pass a real check will be commented + moved to Done.
Nothing is signed off on trust.
