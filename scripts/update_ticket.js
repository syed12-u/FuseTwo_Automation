#!/usr/bin/env node
/**
 * Sign off a QA ticket on Azure Boards: add a verification comment (optionally
 * with a screenshot attachment) and move it to the Done column.
 *
 * WRITE operation — changes the real board. Run it only for tickets you have
 * actually verified as passing. Requires a PAT with Work Items (Read & Write).
 *
 * Usage:
 *   node scripts/update_ticket.js --id 740 [--comment "..."] [--screenshot path.png] [--done] [--dry-run]
 *
 * Defaults:
 *   --comment    "Verified by QA automation. Ready to deploy to production."
 *   --done       move the work item's board column to "Done" (omit to only comment)
 *   --dry-run    print what would happen, change nothing
 *
 * Config (.env): AZDO_ORG, AZDO_PROJECT, AZDO_PAT (Read & Write),
 *   AZDO_DONE_COLUMN (default "Done").
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();

const ORG = process.env.AZDO_ORG;
const PROJECT = process.env.AZDO_PROJECT;
const PAT = process.env.AZDO_PAT;
const DONE_COLUMN = process.env.AZDO_DONE_COLUMN || "Done";
const API = "7.0";

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

const ID = arg("id");
const COMMENT =
  arg("comment") === undefined || arg("comment") === true
    ? "Verified by QA automation. Ready to deploy to production."
    : arg("comment");
const SCREENSHOT = arg("screenshot");
const MOVE_DONE = arg("done") === true || arg("done") === "true";
const DRY = arg("dry-run") === true;

if (!ID) {
  console.error("Missing --id <work item id>.");
  process.exit(1);
}
for (const [k, v] of Object.entries({
  AZDO_ORG: ORG,
  AZDO_PROJECT: PROJECT,
  AZDO_PAT: PAT,
})) {
  if (!v) {
    console.error(
      `Missing ${k} in .env. AZDO_PAT here needs Work Items (Read & Write).`,
    );
    process.exit(1);
  }
}

const auth = "Basic " + Buffer.from(":" + PAT).toString("base64");
const base = `https://dev.azure.com/${encodeURIComponent(
  ORG,
)}/${encodeURIComponent(PROJECT)}`;

async function azdo(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok)
    throw new Error(
      `Azure DevOps ${res.status} for ${url}\n${(await res.text()).slice(
        0,
        400,
      )}`,
    );
  return res.json();
}

async function uploadAttachment(file) {
  const name = path.basename(file);
  const data = fs.readFileSync(file);
  const res = await fetch(
    `${base}/_apis/wit/attachments?fileName=${encodeURIComponent(
      name,
    )}&api-version=${API}`,
    {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/octet-stream",
      },
      body: data,
    },
  );
  if (!res.ok)
    throw new Error(
      `Attachment upload failed ${res.status}: ${(await res.text()).slice(
        0,
        200,
      )}`,
    );
  return res.json(); // { id, url }
}

async function main() {
  console.log(`Ticket #${ID} on ${ORG}/${PROJECT}`);
  console.log(`  comment : ${COMMENT}`);
  console.log(`  screenshot: ${SCREENSHOT || "(none)"}`);
  console.log(`  move to "${DONE_COLUMN}": ${MOVE_DONE ? "yes" : "no"}`);
  console.log(`  mode: ${DRY ? "DRY RUN (no changes)" : "LIVE"}\n`);

  let commentText = COMMENT;

  if (SCREENSHOT) {
    if (!fs.existsSync(SCREENSHOT))
      throw new Error(`Screenshot not found: ${SCREENSHOT}`);
    if (DRY) {
      console.log("would upload screenshot", SCREENSHOT);
    } else {
      const att = await uploadAttachment(SCREENSHOT);
      // Reference the image inline in the comment (Azure renders the attachment URL).
      commentText += `<br><img src="${att.url}" alt="verification screenshot" />`;
      console.log("uploaded screenshot ->", att.url);
    }
  }

  if (DRY) {
    console.log(
      "would add comment and",
      MOVE_DONE ? `move board column to "${DONE_COLUMN}"` : "not move column",
    );
    return;
  }

  // 1) comment
  await azdo(
    `${base}/_apis/wit/workItems/${ID}/comments?api-version=${API}-preview.3`,
    {
      method: "POST",
      body: JSON.stringify({ text: commentText }),
    },
  );
  console.log("comment added.");

  // 2) move board column
  if (MOVE_DONE) {
    await azdo(`${base}/_apis/wit/workitems/${ID}?api-version=${API}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json-patch+json" },
      body: JSON.stringify([
        { op: "add", path: "/fields/System.BoardColumn", value: DONE_COLUMN },
      ]),
    });
    console.log(`moved to board column "${DONE_COLUMN}".`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
