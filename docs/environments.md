# Running against dev, staging or live

One suite, three targets. The target is chosen with the `TEST_ENV` variable and
nothing else — no editing of `.env`, no commented-out URLs.

```bash
npm test                  # dev (default)
npm run test:dev
npm run test:staging
npm run test:prod
```

`TEST_ENV` accepts `dev`, `staging`, `prod` plus the aliases `stg`, `stage`,
`development`, `production`, `live`. An unknown value fails fast with a clear
message instead of silently defaulting.

Every run prints its target before the first test, so a run against the wrong
environment is obvious in the log:

```
[fusetwo-e2e] TEST_ENV=staging  app=https://advertiser.stg.fusetwo.com  management=https://management.stg.fusetwo.com  writes=allowed  skipping=@known-bug
```

## Where configuration lives

| File                                            | Contents                                    | In git? |
| ----------------------------------------------- | ------------------------------------------- | ------- |
| `config/env/dev.env`, `staging.env`, `prod.env` | Host URLs, write policy                     | yes     |
| `config/environment.ts`                         | Resolution logic, paths, typed `env` object | yes     |
| `.env`                                          | Credentials, shared by all environments     | no      |
| `.env.<env>.local`                              | Per-environment credential overrides        | no      |

Resolution order, first hit wins:

1. real environment variables (CLI, Azure pipeline variables)
2. `.env.<env>.local`
3. `.env`
4. `config/env/<env>.env`

**Host URLs are no longer read from `.env`.** `URL`, `HOME_URL`,
`FLEXOFFERS_SIGNUP_URL` and `MANAGEMENT_URL` are derived from the selected
environment and overwritten at startup. This is deliberate: the old `.env`
pinned `URL` to the dev host, which would otherwise hijack every staging and
prod run. Older specs that still read `process.env.URL` keep working and follow
`TEST_ENV` automatically.

## Writing new code

```ts
import { appUrl, managementUrl, env, PATHS } from "../../config/environment";

await page.goto(appUrl(PATHS.programs)); // never hardcode a host
await page.goto(managementUrl("/advertisers"));
if (env.isProd) {
  /* ... */
}
```

`baseURL` is also set from `TEST_ENV`, so relative navigation works too:

```ts
await page.goto("/app/programs");
```

Signed-in state is stored per environment
(`playwright/.auth/advertiser.<env>.json`), so a dev session can never be
replayed against staging. Import it rather than hardcoding the path:

```ts
import { AUTH_FILE } from "../../config/environment";
test.use({ storageState: AUTH_FILE });
```

## Tags

| Tag          | Meaning                                                                                |
| ------------ | -------------------------------------------------------------------------------------- |
| `@blocker`   | Must pass before a release ships. The release gate runs exactly these.                 |
| `@crud`      | Create / read / update / delete coverage for a module.                                 |
| `@smoke`     | Fastest signal that the app is alive.                                                  |
| `@write`     | Creates, edits or deletes real data. Skipped automatically on prod.                    |
| `@known-bug` | Guards a defect that is still open, so it fails today. Never runs in a gating project. |

## Release gate

The one command to run against a release candidate:

```bash
npm run gate:staging      # or gate:dev / gate:prod
```

It runs every `@blocker` scenario across all modules, excluding `@known-bug`
(and `@write` on prod). A green gate means no known blocker shipped.

To check whether a release fixed the open defects:

```bash
npm run known-bugs:staging
```

Failures there are expected until the underlying bug is fixed.

## Production safety

`config/env/prod.env` sets `ALLOW_WRITE_TESTS = false`, so `@write` tests —
anything that creates, edits or deletes real advertiser data — are excluded from
prod runs. The startup banner reports `writes=blocked`. To override for a single
deliberate run:

```bash
ALLOW_WRITE_TESTS=true npm run test:prod
```

## CI

The Azure pipeline exposes two queue-time parameters:

- **Target environment** — `dev` (default) / `staging` / `prod`
- **Playwright project** — `chromium` (default) / `release-gate` / `known-bugs`

Scheduled and PR runs use the defaults. The agent's generated `.env` now
contains credentials only; hosts come from `config/env/<TEST_ENV>.env`.

`CI_DEV_HOST_IP` (the Chromium DNS override for the internal dev host) is
applied only when `TEST_ENV=dev`.

## Before the first staging or live run

The dev hosts are confirmed. The staging and prod hosts in
`config/env/staging.env` and `config/env/prod.env` follow the naming used in the
QA report (`advertiserstg` / `management.stg`) but have not been verified against
a real deployment — confirm them and correct those two files if they differ.
Staging and prod also need their own credentials in `.env.staging.local` /
`.env.prod.local` if they differ from dev.
