#!/usr/bin/env node
/**
 * Fetch "Ready for QA" work items from Azure Boards and list the ones that
 * still need testing — i.e. those WITHOUT a comment from a given person
 * (by default "Jokima", the developer whose comment marks a ticket as handled).
 *
 * Usage:
 *   node scripts/fetch_qa_tickets.js
 *
 * Configuration (in .env — never on the command line):
 *   AZDO_ORG                 Azure DevOps organization (e.g. "fusetwo" from
 *                            https://dev.azure.com/fusetwo)
 *   AZDO_PROJECT             Project name (e.g. "FuseTwo Development")
 *   AZDO_PAT                 Personal Access Token with Work Items (Read)
 *   AZDO_BOARD_COLUMN        Kanban board column the ready-for-QA items sit in
 *                            (e.g. "Doing"). Preferred — matches how the board
 *                            is organised. Takes precedence over AZDO_QA_STATE.
 *   AZDO_QA_STATE            Work-item State to match instead, if you filter by
 *                            state rather than board column (default "QA Ready")
 *   AZDO_EXCLUDE_COMMENTER   Skip tickets that have a comment from this person
 *                            (default "Jokima"); matched against comment author
 *                            display name / email, case-insensitive
 *
 * Output:
 *   - a table on stdout
 *   - docs/qa-tickets.json  (machine-readable, for scaffolding ticket specs)
 *
 * A PAT is required because there is no Azure DevOps connector configured for
 * this environment. Nothing is written back to the board; this is read-only.
 */

const fs = require("fs");
const path = require("path");

require("dotenv").config();

const ORG = process.env.AZDO_ORG;
const PROJECT = process.env.AZDO_PROJECT;
const PAT = process.env.AZDO_PAT;
const QA_STATE = process.env.AZDO_QA_STATE || "QA Ready";
const BOARD_COLUMN = process.env.AZDO_BOARD_COLUMN || "";
const EXCLUDE = (process.env.AZDO_EXCLUDE_COMMENTER || "Jokima").toLowerCase();
// What we are filtering on, for logging.
const FILTER_LABEL = BOARD_COLUMN
  ? `board column "${BOARD_COLUMN}"`
  : `state "${QA_STATE}"`;
const API = "7.0";

function requireConfig() {
  const missing = ["AZDO_ORG", "AZDO_PROJECT", "AZDO_PAT"].filter(
    (k) => !process.env[k],
  );
  if (missing.length) {
    console.error(
      `Missing configuration: ${missing.join(", ")}.\n` +
        `Add them to .env. AZDO_PAT is a Personal Access Token with Work Items (Read),\n` +
        `created at https://dev.azure.com/<org>/_usersSettings/tokens.`,
    );
    process.exit(1);
  }
}

function authHeader() {
  // Azure DevOps basic auth: empty username, PAT as password.
  return "Basic " + Buffer.from(":" + PAT).toString("base64");
}

async function azdo(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Azure DevOps ${res.status} for ${url}\n${body.slice(0, 400)}`,
    );
  }
  return res.json();
}

function base() {
  return `https://dev.azure.com/${encodeURIComponent(ORG)}/${encodeURIComponent(
    PROJECT,
  )}`;
}

/** Work item ids ready for QA — by board column if given, else by state. */
async function qaReadyIds() {
  const filter = BOARD_COLUMN
    ? `[System.BoardColumn] = '${BOARD_COLUMN.replace(/'/g, "''")}'`
    : `[System.State] = '${QA_STATE.replace(/'/g, "''")}'`;
  const wiql = {
    query:
      `SELECT [System.Id] FROM WorkItems ` +
      `WHERE [System.TeamProject] = @project ` +
      `AND ${filter} ` +
      `ORDER BY [System.ChangedDate] DESC`,
  };
  const data = await azdo(`${base()}/_apis/wit/wiql?api-version=${API}`, {
    method: "POST",
    body: JSON.stringify(wiql),
  });
  return (data.workItems || []).map((w) => w.id);
}

/** Details for a batch of work item ids. */
async function workItemDetails(ids) {
  if (!ids.length) return [];
  const out = [];
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    const data = await azdo(
      `${base()}/_apis/wit/workitemsbatch?api-version=${API}`,
      {
        method: "POST",
        body: JSON.stringify({
          ids: batch,
          fields: [
            "System.Id",
            "System.Title",
            "System.WorkItemType",
            "System.State",
            "System.AssignedTo",
            "System.BoardColumn",
            "Microsoft.VSTS.Common.Severity",
            "System.Tags",
          ],
        }),
      },
    );
    out.push(...(data.value || []));
  }
  return out;
}

/** Comments for one work item. */
async function comments(id) {
  const data = await azdo(
    `${base()}/_apis/wit/workItems/${id}/comments?api-version=${API}-preview.3`,
  );
  return data.comments || [];
}

function commenterMatches(comment) {
  const by = comment.createdBy || {};
  const who = `${by.displayName || ""} ${by.uniqueName || ""}`.toLowerCase();
  return who.includes(EXCLUDE);
}

async function main() {
  requireConfig();
  console.log(
    `Fetching work items in ${FILTER_LABEL} from ${ORG}/${PROJECT}, ` +
      `excluding those with a comment from "${EXCLUDE}"...\n`,
  );

  const ids = await qaReadyIds();
  if (!ids.length) {
    console.log(`No work items in ${FILTER_LABEL}.`);
    return;
  }

  const items = await workItemDetails(ids);
  const toTest = [];
  let excluded = 0;

  for (const item of items) {
    const id = item.id;
    const list = await comments(id).catch(() => []);
    if (list.some(commenterMatches)) {
      excluded += 1;
      continue;
    }
    const f = item.fields || {};
    toTest.push({
      id,
      title: f["System.Title"] || "",
      type: f["System.WorkItemType"] || "",
      state: f["System.State"] || "",
      severity: f["Microsoft.VSTS.Common.Severity"] || "",
      boardColumn: f["System.BoardColumn"] || "",
      assignedTo:
        (f["System.AssignedTo"] && f["System.AssignedTo"].displayName) || "",
      tags: f["System.Tags"] || "",
      url: `${base()}/_workitems/edit/${id}`,
    });
  }

  console.log(`Total in ${FILTER_LABEL}: ${items.length}`);
  console.log(`Excluded (have a comment from "${EXCLUDE}"): ${excluded}`);
  console.log(`To test: ${toTest.length}\n`);

  for (const t of toTest) {
    console.log(`#${t.id} [${t.severity || t.type}] ${t.title}`);
    console.log(`    ${t.url}`);
  }

  const outPath = path.join(__dirname, "..", "docs", "qa-tickets.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        fetchedState: QA_STATE,
        excludedCommenter: EXCLUDE,
        count: toTest.length,
        tickets: toTest,
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${outPath}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
