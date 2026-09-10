# Automating the management portal

## Short version

It works. The management portal can be automated end to end, on dev and on
staging. There is one thing the team needs to decide: which domain account CI
uses.

## What the "login issue" actually was

The management portal is not an application login at all. IIS answers the very
first request with:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Negotiate
WWW-Authenticate: NTLM
Server: Microsoft-IIS/10.0
```

That is Windows Integrated Authentication, and it happens *before* any
application code runs. So:

- There is no e-mail/password form to fill. `ManagementLoginPage` used to look
  for a password box, which never appears, then continued silently — every
  management test really ran against the IIS "401 - Unauthorized" error page.
- Playwright's `httpCredentials` option cannot fix it either: it only speaks
  Basic and Digest, not Negotiate/NTLM.

## The fix

Chromium *can* do Negotiate/NTLM single sign-on with the machine's current
Windows domain session, but only for hosts that are explicitly allowlisted.
Adding those flags is the whole fix:

```
--auth-server-allowlist=*fusetwo.com
--auth-negotiate-delegate-allowlist=*fusetwo.com
```

Verified on 20 Aug 2026:

| Host | Before | After |
|---|---|---|
| management.dev.fusetwo.com | 401 Unauthorized | 200, `/advertiser/overview` renders, signed in |
| management.stg.fusetwo.com | 401 Unauthorized | 200, `/advertiser/overview` renders, signed in |

No credentials are stored anywhere — the browser reuses the Windows session of
whoever runs the tests. This is now wired into `playwright.config.ts`, so it
applies to every project and environment.

## The one open question for the team

Locally this works because we run as our own domain user. **On the Azure agent
(DEV-FT-BUILD01) the tests run as the build service account**, and SSO will only
succeed if that account is permitted on the management portal.

So we need one of:

1. **Grant the existing build service account read access to the management
   portal.** Simplest, no new secrets. Preferred.
2. **Run the pipeline agent as a dedicated domain QA account** with portal
   access.
3. Keep management tests local-only for now and gate them out of CI.

Until that is settled, management tests pass locally and fail on the agent with
a clear message telling you exactly this (see `ManagementLoginPage`).

Second, smaller item: `management.stg.fusetwo.com` presents a certificate from
the internal **FLEX-DC01** CA, which Chromium does not trust. TLS verification
is relaxed for the staging environment only (`IGNORE_HTTPS_ERRORS` in
`config/env/staging.env`). If that CA were added to the agent's trust store we
could drop the exception.

## What the portal actually contains

Real navigation, read from both environments (worth noting because the existing
`testManagementReadOnly` spec asserts `Dashboard` / `Advertisers` / `Accounting`
/ `Reports`, and the first three do not exist):

- Advertiser → Overview, Revenue Report, Receivables Report, Advertiser Balance,
  Advertiser Reconciliation, Referred Publishers, Recruited Publishers, Promo
  Codes, Terms and Conditions, Advertiser Invoice
- Reports
- Advertiser Overview dashboard: this month's revenue, search, status filters
  (Pending / Collect Payment / Initial Setup / Follow Up / Approved / Declined /
  Deactivated), Tracking Diagnosis Completed, Pending Emails, Top Ten

Landing route is `/advertiser/overview`.

## Proposed management coverage

Once the account question is answered, this is the scope worth automating:

| Area | Scenarios |
|---|---|
| Access | SSO succeeds; portal renders; no failed API calls on load |
| Advertiser Overview | Revenue tile; status filter counts reconcile with the list; Top Ten; Pending Emails |
| Advertiser search | Search by id, name and e-mail; **non-Approved found under "All Statuses"** (bug #723) |
| Advertiser detail | Detail page renders instead of "Coming Soon" (bug #684 — 31 approvals blocked) |
| Advertiser lifecycle | Approve / decline / deactivate, and the status count updates |
| Pricing & terms | Pricing Schedule matches the advertiser agreement (bug #762); no legacy "FlexOffers.com" branding (bug #764) |
| Accounting | Revenue, Receivables, Balance, Reconciliation, Invoice — totals reconcile |
| Publishers | Referred and Recruited publisher lists |
| Promo codes | Create, read, update, delete |
| Cross-cutting | No console errors or failed APIs on any page; dark-mode readability |

Lifecycle actions (approve/decline/deactivate) mutate real advertiser records,
so they will be tagged `@write` and are excluded from live runs automatically.

---

## Message you can paste to the team

> The management portal automation is unblocked — the "login problem" was not an
> app login at all. The portal uses Windows Integrated Authentication (IIS
> returns 401 with Negotiate/NTLM before the app loads), so there was never a
> form to fill. I've configured Chromium to single-sign-on with the current
> Windows domain session, and management now loads correctly on both dev and
> staging. No credentials are stored.
>
> One thing I need from the team: on the Azure agent the tests run as the build
> service account, and SSO will only work if that account has access to the
> management portal. Could we either grant the existing build service account
> read access, or set up a dedicated domain QA account for the agent? Until then
> management tests pass locally but will fail in CI.
>
> Also minor: management.stg presents a certificate from our internal FLEX-DC01
> CA that Chromium doesn't trust. I've allowed it for staging only; adding that
> CA to the agent's trust store would let us remove the exception.
>
> Separately, while checking this I found the existing management spec asserts
> navigation sections (Dashboard / Advertisers / Accounting) that don't exist in
> the portal — the real nav is Advertiser → Overview / Revenue Report /
> Receivables Report / etc. I'm correcting that, and I'd like to extend coverage
> to advertiser search, detail, approve-decline lifecycle, accounting totals and
> promo codes. That would also give us automated regression guards for #723,
> #684, #762 and #764.
