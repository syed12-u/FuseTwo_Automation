#!/usr/bin/env node
/**
 * Review loop for scenarios written by the daily explorer agent.
 *
 * New scenarios carry the @pending-review tag, which keeps them out of every
 * regular run. A QA lead watches them run in a visible browser, then approves
 * (tag removed → part of the suite from the next run) or rejects them (file
 * moved out of e2e/, kept for reference).
 *
 *   npm run review:cases                     # list pending specs
 *   npm run review:cases -- show [n|file]    # run all / one pending spec headed, slowed down
 *   npm run review:cases -- approve <n|file|all> [--note "..."]
 *   npm run review:cases -- reject  <n|file> [--note "why"]
 *
 * Decisions are logged in docs/daily-explorer/decisions.md.
 * Env: TEST_ENV (default staging), REVIEW_SLOWMO (ms per action, default 400).
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const E2E = path.join(ROOT, "e2e");
const TAG = "@pending-review";
const LOG = path.join(ROOT, "docs", "daily-explorer", "decisions.md");
const REJECTED = path.join(ROOT, "docs", "daily-explorer", "rejected");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.spec\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

function pending() {
  return walk(E2E)
    .filter((f) => fs.readFileSync(f, "utf8").includes(TAG))
    .map((f) => {
      const src = fs.readFileSync(f, "utf8");
      const tests = [...src.matchAll(/\btest\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
      const describe = (src.match(/test\.describe\(\s*["'`]([^"'`]+)["'`]/) || [])[1] || "";
      return { file: f, rel: path.relative(ROOT, f).replace(/\\/g, "/"), describe, tests };
    });
}

function pick(list, sel) {
  if (!sel) return null;
  if (/^\d+$/.test(sel)) return list[Number(sel) - 1] || null;
  const norm = sel.replace(/\\/g, "/");
  return list.find((p) => p.rel === norm || p.rel.endsWith(norm) || path.basename(p.file) === path.basename(norm)) || null;
}

function logDecision(kind, item, note) {
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  if (!fs.existsSync(LOG)) fs.writeFileSync(LOG, "# Explorer scenario decisions\n\n| Date | Decision | Spec | Tests | Note |\n|---|---|---|---|---|\n");
  const when = new Date().toISOString().slice(0, 16).replace("T", " ");
  fs.appendFileSync(LOG, `| ${when} | ${kind} | ${item.rel} | ${item.tests.length} | ${(note || "").replace(/\|/g, "/")} |\n`);
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const [cmd = "list", sel] = process.argv.slice(2).filter((a, i, all) => !(a.startsWith("--") || all[i - 1] === "--note"));
const list = pending();

if (cmd === "list") {
  if (!list.length) {
    console.log("No scenarios waiting for review.");
    process.exit(0);
  }
  console.log(`${list.length} spec(s) waiting for review:\n`);
  list.forEach((p, i) => {
    console.log(`${i + 1}. ${p.rel}`);
    for (const t of p.tests) console.log(`     - ${t}`);
  });
  console.log(`\nWatch them:   npm run review:cases -- show        (or: show 1)`);
  console.log(`Approve:      npm run review:cases -- approve 1   (or: approve all)`);
  console.log(`Reject:       npm run review:cases -- reject 1 --note "why"`);
  process.exit(0);
}

if (cmd === "show") {
  const one = pick(list, sel);
  if (sel && !one) { console.error(`No pending spec matches "${sel}".`); process.exit(1); }
  const targets = one ? [one] : list;
  if (!targets.length) { console.log("No scenarios waiting for review."); process.exit(0); }
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const files = targets.map((t) => path.basename(t.file).replace(/\.spec\.ts$/, ""));
  console.log(`Running ${targets.length} spec(s) in a visible browser (slowMo ${process.env.REVIEW_SLOWMO || 400} ms)…`);
  const r = spawnSync(npx, ["playwright", "test", ...files, "--project=review", "--workers=1", "--reporter=list", "--output=test-results/review"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, TEST_ENV: process.env.TEST_ENV || "staging" },
    shell: process.platform === "win32",
  });
  console.log(`\nVideos: test-results/review/<test>/video.webm`);
  console.log(`Next: npm run review:cases -- approve ${one ? sel : "all"}   |   reject <n> --note "why"`);
  process.exit(r.status ?? 1);
}

if (cmd === "approve") {
  const targets = sel === "all" ? list : [pick(list, sel)].filter(Boolean);
  if (!targets.length) { console.error(`Nothing to approve for "${sel || ""}".`); process.exit(1); }
  for (const t of targets) {
    const src = fs.readFileSync(t.file, "utf8");
    const out = src.replace(/\s*@pending-review\b/g, "");
    fs.writeFileSync(t.file, out, "utf8");
    logDecision("approved", t, arg("note"));
    console.log(`approved: ${t.rel} (${t.tests.length} test(s)) — now part of the regular suite`);
  }
  process.exit(0);
}

if (cmd === "reject") {
  const t = pick(list, sel);
  if (!t) { console.error(`No pending spec matches "${sel || ""}".`); process.exit(1); }
  fs.mkdirSync(REJECTED, { recursive: true });
  const dest = path.join(REJECTED, `${new Date().toISOString().slice(0, 10)}-${path.basename(t.file)}.txt`);
  fs.renameSync(t.file, dest);
  logDecision("rejected", t, arg("note"));
  console.log(`rejected: ${t.rel} → ${path.relative(ROOT, dest)} (kept for reference, no longer runs)`);
  console.log("Note: page-object or constant changes the agent made alongside it are left in place.");
  process.exit(0);
}

console.error(`Unknown command "${cmd}". Use list | show | approve | reject.`);
process.exit(1);
