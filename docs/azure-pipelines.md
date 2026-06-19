# Azure Pipelines Setup

This repository runs Playwright tests in Azure DevOps with `azure-pipelines.yml`.

## Required Pipeline Variables

Create these variables in Azure DevOps under:

`Pipelines` -> your pipeline -> `Edit` -> `Variables`

Mark passwords and proxy credentials as secret.

- `URL`
- `HOME_URL`
- `FO_USERNAME`
- `FO_PASSWORD`
- `FLEXOFFERS_SIGNUP_URL`
- `CONTROL_USERNAME`
- `CONTROL_PASSWORD`
- `BRIGHTDATA_HOST`
- `BRIGHTDATA_PORT`
- `BRIGHTDATA_USERNAME`
- `BRIGHTDATA_PASSWORD`

## What The Pipeline Does

- Installs Node.js 20
- Runs `npm ci`
- Installs Chromium and required Playwright Linux dependencies
- Creates a runtime `.env` file from Azure pipeline variables
- Runs `npm run test:chromium`
- Publishes JUnit test results to the Azure test summary
- Publishes `playwright-report` and `test-results` as pipeline artifacts

## Schedule

The pipeline is configured to run on pushes and pull requests to `main` or `master`.
It also has a weekday scheduled run at 13:00 UTC.
