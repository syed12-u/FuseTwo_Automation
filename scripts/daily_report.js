#!/usr/bin/env node
/**
 * End-of-day QA report: what the daily regression found, which failures are
 * NEW since the previous regression (bug candidates), what the daily explorer
 * added, and what needs a human next.
 *
 *   node scripts/daily_report.js [--date yyyy-mm-dd]
 *
 * Input:  logs/regression/<date>.json (+ the previous one), docs/daily-explorer/
 * Output: docs/daily-report/<date>.md and docs/daily-report/latest.md
 * Scheduled by scripts/register_schedules.ps1 ("FuseTwo Daily Report").
 *
 * A machine-local scripts/daily_report.local.js (not in git) may add its own
 * summary rows, a section and next actions; the report works without it.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const i = process.argv.indexOf("--date");
const DAY = i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : new Date().toISOString().slice(0, 10);
const OUT_DIR = path.join(ROOT, "docs", "daily-report");
fs.mkdirSync(OUT_DIR, { recursive: true });

const localFile = path.join(__dirname, "daily_report.local.js");
const local = fs.existsSync(localFile) ? require(localFile)({ ROOT, DAY }) : { summary: [], section: [], actions: [], log: "" };

// ---- regression: today vs previous --------------------------------------
const regDir = path.join(ROOT, "logs", "regression");
const regFiles = fs.existsSync(regDir) ? fs.readdirSync(regDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : [];
const todayFile = regFiles.find((f) => f.startsWith(DAY));
const prevFile = [...regFiles].reverse().find((f) => f < `${DAY}.json`);

function flatten(report) {
  const tests = [];
  const walk = (suite, chain) => {
    const here = suite.title && !/\.spec\.ts$/.test(suite.title) ? [...chain, suite.title] : chain;
    for (const spec of suite.specs || []) {
      const file = (spec.file || suite.file || "").replace(/\\/g, "/");
      for (const t of spec.tests || []) {
        const err = (t.results || []).map((r) => r.error?.message || "").find(Boolean) || "";
        tests.push({
          key: `${file} › ${[...here, spec.title].join(" › ")}`,
          file,
          suite: file.split("/")[0],
          title: spec.title,
          status: t.status, // expected | unexpected | skipped | flaky
          error: err.replace(/\u001b\[[0-9;]*m/g, "").split("\n").find((l) => l.trim()) || "",
          duration: (t.results || []).reduce((s, r) => s + (r.duration || 0), 0),
        });
      }
    }
    for (const s of suite.suites || []) walk(s, here);
  };
  for (const s of report.suites || []) walk(s, []);
  return tests;
}
const today = todayFile ? flatten(JSON.parse(fs.readFileSync(path.join(regDir, todayFile), "utf8"))) : null;
const prev = prevFile ? flatten(JSON.parse(fs.readFileSync(path.join(regDir, prevFile), "utf8"))) : null;
const count = (arr, st) => (arr || []).filter((t) => t.status === st).length;
const failed = (today || []).filter((t) => t.status === "unexpected");
const prevFailedKeys = new Set((prev || []).filter((t) => t.status === "unexpected").map((t) => t.key));
const prevKeys = new Set((prev || []).map((t) => t.key));
const newFailures = failed.filter((t) => !prevFailedKeys.has(t.key));
const fixedSincePrev = (prev || []).filter((t) => t.status === "unexpected" && (today || []).some((x) => x.key === t.key && x.status === "expected"));
const newTests = (today || []).filter((t) => prev && !prevKeys.has(t.key));
const bySuite = {};
for (const t of today || []) {
  const s = (bySuite[t.suite] ||= { passed: 0, failed: 0, skipped: 0 });
  if (t.status === "unexpected") s.failed++; else if (t.status === "skipped") s.skipped++; else s.passed++;
}
const totalMs = (today || []).reduce((s, t) => s + t.duration, 0);

// ---- write ---------------------------------------------------------------
const lines = [];
lines.push(`# FuseTwo QA daily report — ${DAY}`, "");
lines.push(`## Summary`, "");
lines.push(`| | |`, `|---|---|`);
lines.push(...local.summary);
if (today) {
  lines.push(`| Regression tests run (staging) | ${today.length} in ${(totalMs / 60000).toFixed(0)} min |`);
  lines.push(`| Regression passed / failed / skipped | ${count(today, "expected") + count(today, "flaky")} / ${failed.length} / ${count(today, "skipped")} |`);
  lines.push(`| **New failures since ${prevFile ? prevFile.slice(0, 10) : "—"} (bug candidates)** | **${prev ? newFailures.length : "n/a (first run)"}** |`);
  lines.push(`| Fixed since previous run | ${fixedSincePrev.length} |`);
} else {
  lines.push(`| Regression | not run today |`);
}
lines.push("");
lines.push(...local.section);

lines.push(`## Regression (staging, chromium project)`, "");
if (!today) lines.push("_No regression result for today._", "");
else {
  lines.push(`| Suite | Passed | Failed | Skipped |`, `|---|---|---|---|`);
  for (const [s, v] of Object.entries(bySuite).sort()) lines.push(`| ${s} | ${v.passed} | ${v.failed} | ${v.skipped} |`);
  lines.push("");
  if (newFailures.length) { lines.push(`### New failures — triage these first (possible new bugs)`, ""); for (const t of newFailures) lines.push(`- **${t.file}** › ${t.title}\n  \`${t.error.slice(0, 220).replace(/`/g, "'")}\``); lines.push(""); }
  const known = failed.filter((t) => prevFailedKeys.has(t.key));
  if (known.length) { lines.push(`### Still failing (also failed in the previous run)`, ""); for (const t of known) lines.push(`- ${t.file} › ${t.title}`); lines.push(""); }
  if (fixedSincePrev.length) { lines.push(`### Fixed since previous run`, ""); for (const t of fixedSincePrev) lines.push(`- ${t.file} › ${t.title}`); lines.push(""); }
  if (newTests.length) { lines.push(`### New scenarios added since previous run: ${newTests.length}`, ""); for (const t of newTests.slice(0, 40)) lines.push(`- ${t.file} › ${t.title}`); if (newTests.length > 40) lines.push(`- … and ${newTests.length - 40} more`); lines.push(""); }
}

// ---- daily explorer (most recent report) --------------------------------
const expDir = path.join(ROOT, "docs", "daily-explorer");
const expFiles = fs.existsSync(expDir) ? fs.readdirSync(expDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort() : [];
const expFile = [...expFiles].reverse().find((f) => f <= `${DAY}.md`);
lines.push(`## Daily explorer (new scenarios)`, "");
if (!expFile) lines.push("_No explorer report yet._", "");
else {
  const body = fs.readFileSync(path.join(expDir, expFile), "utf8").replace(/^﻿/, "");
  lines.push(`From \`docs/daily-explorer/${expFile}\`:`, "");
  lines.push(...body.split("\n").filter((l) => !/^# /.test(l)).slice(0, 45).map((l) => (l.startsWith("#") ? "#" + l : l)));
  lines.push("");
}

lines.push(`## Next actions`, "");
const actions = [];
for (const t of newFailures) actions.push(`Triage new regression failure: ${t.file} › ${t.title} → real bug? report it; test issue? fix the spec.`);
actions.push(...local.actions);
actions.push("Review the explorer's pending scenarios (npm run review:cases) and add corner cases for today's failures.");
for (const a of actions) lines.push(`- ${a}`);
lines.push("", `_Generated ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC by scripts/daily_report.js._`, "");

const md = lines.join("\n");
fs.writeFileSync(path.join(OUT_DIR, `${DAY}.md`), md, "utf8");
fs.writeFileSync(path.join(OUT_DIR, "latest.md"), md, "utf8");
console.log(`wrote docs/daily-report/${DAY}.md — ${local.log ? local.log + " " : ""}regression=${today ? `${today.length} (${failed.length} failed, ${prev ? newFailures.length : "?"} new)` : "none"}`);
