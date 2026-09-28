<#
Daily exploratory-testing agent: runs Claude Code headless with the brief in
scripts/daily_explorer.prompt.md. It adds new scenarios for one module, runs
them on staging and writes docs/daily-explorer/<date>.md.

  powershell -ExecutionPolicy Bypass -File scripts\daily_explorer.ps1 [-MaxScenarios 5] [-MaxTurns 150]

Scheduled by scripts/register_schedules.ps1 ("FuseTwo Daily Explorer").
Uses the claude.exe bundled with the VS Code extension (newest version found);
set CLAUDE_EXE in the environment to point at another binary.
#>
param(
  [int]$MaxScenarios = 5,
  [int]$MaxTurns = 150
)

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$env:Path = "$env:LOCALAPPDATA\Programs\node\node-v24.19.0-win-x64;$env:Path"
$env:TEST_ENV = "staging"
# The agent runs its @pending-review specs through the `review` project;
# headless and at full speed here, visible + slowed down when a person reviews.
$env:REVIEW_HEADLESS = "true"

$exe = $env:CLAUDE_EXE
if (-not $exe) {
  $exe = Get-ChildItem "$env:USERPROFILE\.vscode\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [version](($_.FullName -replace '.*claude-code-([\d.]+)-.*', '$1')) } -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $exe -or -not (Test-Path $exe)) { throw "claude.exe not found; set CLAUDE_EXE" }

New-Item -ItemType Directory -Force "$repo\logs", "$repo\docs\daily-explorer", "$repo\test-results\daily-explorer" | Out-Null
$log = "$repo\logs\daily-explorer.log"
$day = Get-Date -Format "yyyy-MM-dd"
$prompt = (Get-Content "$repo\scripts\daily_explorer.prompt.md" -Raw).Replace("{{MAX_SCENARIOS}}", "$MaxScenarios")

Add-Content $log "==== $day $(Get-Date -Format HH:mm) explorer start ($exe) ===="

# Tools the unattended agent may use without prompting. Shell access is limited
# to running tests, type-checks and node scripts; file edits are auto-accepted.
# Windows sessions use the PowerShell tool, so the same commands are listed
# for both shells (a Bash-only list blocked every command on 2026-09-27).
$cmds = @("npx playwright test *", "npm run test:*", "npx -y -p typescript@5 tsc *", "node *", "New-Item *", "Copy-Item *", "Get-ChildItem *", "Get-Content *", "Select-String *")
$allowed = (@("Read", "Glob", "Grep", "Edit", "Write") + ($cmds | ForEach-Object { "Bash($_)"; "PowerShell($_)" })) -join ","

& $exe -p $prompt --permission-mode acceptEdits --allowedTools $allowed --max-turns $MaxTurns --output-format text 2>&1 |
  Tee-Object -FilePath "$repo\logs\daily-explorer-$day.txt" | Out-Null

$report = "$repo\docs\daily-explorer\$day.md"
if (Test-Path $report) {
  Add-Content $log "==== $(Get-Date -Format HH:mm) explorer done -> docs\daily-explorer\$day.md ===="
} else {
  Add-Content $log "==== $(Get-Date -Format HH:mm) explorer finished WITHOUT a report (see logs\daily-explorer-$day.txt) ===="
}
