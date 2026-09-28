#!/usr/bin/env node
/**
 * Daily regression: the day-to-day `chromium` project on staging (writes
 * allowed there), with the JSON result kept per day so the daily report can
 * diff today against yesterday and spot NEW failures (bug candidates).
 *
 *   node scripts/daily_regression.js [--env staging]
 *
 * Output: logs/regression/<yyyy-mm-dd>.json (Playwright JSON report)
 *         logs/regression/<yyyy-mm-dd>.log  (list reporter output)
 * Scheduled by scripts/register_schedules.ps1 ("FuseTwo Daily Regression").
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
require("dotenv").config();

const ROOT = path.join(__dirname, "..");
const i = process.argv.indexOf("--env");
const TEST_ENV = i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : process.env.DAILY_REGRESSION_ENV || "staging";
const day = new Date().toISOString().slice(0, 10);
const dir = path.join(ROOT, "logs", "regression");
fs.mkdirSync(dir, { recursive: true });
const jsonOut = path.join(dir, `${day}.json`);
const logOut = path.join(dir, `${day}.log`);

console.log(`[daily-regression] ${day} env=${TEST_ENV}`);
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const r = spawnSync(
  npx,
  ["playwright", "test", "--project=chromium", "--reporter=list,json", "--output=test-results/daily-regression"],
  {
    cwd: ROOT,
    env: { ...process.env, TEST_ENV, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut, CI: "" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 256 * 1024 * 1024,
    shell: process.platform === "win32",
  },
);
fs.writeFileSync(logOut, (r.stdout || "") + (r.stderr || ""), "utf8");
const tail = (r.stdout || "").trim().split("\n").slice(-6).join("\n");
console.log(tail);
console.log(`[daily-regression] json=${path.relative(ROOT, jsonOut)} exit=${r.status}`);
process.exit(fs.existsSync(jsonOut) ? 0 : 1);
