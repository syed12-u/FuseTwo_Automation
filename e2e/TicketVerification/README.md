# Ticket verification

One folder per Azure Boards ticket. Each ticket is tested **against its own
requirement** — not a generic smoke check — so a passing test means "this
ticket's acceptance criteria are met", and a failing test reproduces the defect.

## The workflow

1. **Fetch the tickets that need testing.** Pull the ready-for-QA work items
   from Azure Boards — the ones in the **"Doing"** board column — excluding any
   that already have a comment from the developer (default: "Jokima"), which are
   considered handled.

   ```bash
   node scripts/fetch_qa_tickets.js
   ```

   Needs `AZDO_ORG`, `AZDO_PROJECT`, `AZDO_PAT` in `.env`, plus
   `AZDO_BOARD_COLUMN=Doing` (see `.env.example`). Writes the list to
   `docs/qa-tickets.json` and prints it. Read-only — nothing is written back to
   the board.

2. **Create a folder for the ticket** and write a spec that verifies its
   requirement:

   ```
   e2e/TicketVerification/Ticket-<id>-<slug>/testTicket<id>.spec.ts
   ```

   Copy `_TEMPLATE/ticketTemplate.spec.ts` as a starting point.

3. **Run it** — on any environment:

   ```bash
   npx playwright test e2e/TicketVerification/Ticket-<id>-<slug> --project=chromium
   TEST_ENV=staging npx playwright test e2e/TicketVerification/Ticket-<id>-<slug> --project=chromium
   TEST_ENV=prod    npx playwright test e2e/TicketVerification/Ticket-<id>-<slug> --project=chromium
   ```

## Conventions

- **Title each test `@ticket-<id>`** plus the usual tags (`@blocker`,
  `@security`, `@write`, `@known-bug`). This lets the whole ticket set run with
  `--grep @ticket-`, and keeps open-defect tickets out of the release gate.
- **Test the requirement, and cite it.** Put the ticket's acceptance criterion
  in a comment at the top so the assertion is traceable to what QA signs off.
- **A ticket whose fix is not yet shipped is `@known-bug`.** The test asserts
  the *fixed* behaviour, so it fails until the fix lands — then the tag comes
  off and it gates.
- **Creating data is `@write`.** Tickets that need a fresh advertiser (signup,
  onboarding, etc.) reuse `SignUpPage.registerNewAdvertiser()`, which
  plus-addresses a real mailbox. `@write` tests are excluded from live runs
  unless `ALLOW_WRITE_TESTS=true`.
- **Prod-safe by default.** Read-only ticket checks carry no `@write`, so they
  can gate a live release too.

## Existing

- `Ticket-371-Programs-API/` — management Advertiser Details → Programs API
  returns valid JSON.
- `_TEMPLATE/` — copy this to start a new ticket.
