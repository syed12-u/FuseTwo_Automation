<#
Registers (or replaces) the Windows scheduled tasks of the QA day
(weekdays only, no runs on Saturday / Sunday):

  FuseTwo Daily Regression   17:00  full chromium suite on staging
  FuseTwo Daily Report       18:30  docs/daily-report/<date>.md
  FuseTwo Daily Explorer     19:00  Claude Code adds + runs new scenarios for one
                                    module (@pending-review) -> docs/daily-explorer/<date>.md

If a machine-local scripts/register_local_tasks.ps1 exists (not in git), it is
run afterwards with the same -Days value to register that machine's extra tasks.

Runs as the current user while logged on (portable Node + .env in reach).

  powershell -ExecutionPolicy Bypass -File scripts\register_schedules.ps1
  powershell -ExecutionPolicy Bypass -File scripts\register_schedules.ps1 -Remove

Check:   schtasks /query /tn "FuseTwo Daily Regression" /v /fo list
Run now: schtasks /run   /tn "FuseTwo Daily Report"
#>
param(
  [string]$RegressionAt = "17:00",
  [string]$ReportAt = "18:30",
  [string]$ExplorerAt = "19:00",
  [string]$Days = "MON,TUE,WED,THU,FRI",  # no runs on Saturday / Sunday
  [switch]$Remove
)

$repo = Split-Path -Parent $PSScriptRoot
$tasks = @(
  @{ Name = "FuseTwo Daily Regression"; Cmd = Join-Path $repo "scripts\daily_regression.cmd"; At = $RegressionAt; Ps = $false },
  @{ Name = "FuseTwo Daily Report";     Cmd = Join-Path $repo "scripts\daily_report.cmd";     At = $ReportAt;     Ps = $false },
  @{ Name = "FuseTwo Daily Explorer";   Cmd = Join-Path $repo "scripts\daily_explorer.ps1";   At = $ExplorerAt;   Ps = $true }
)
$localTasks = Join-Path $PSScriptRoot "register_local_tasks.ps1"

if ($Remove) {
  foreach ($t in $tasks) { schtasks /delete /tn $t.Name /f 2>$null | Out-Null }
  if (Test-Path $localTasks) { & $localTasks -Remove }
  Write-Host "Removed the FuseTwo QA tasks."
  exit 0
}

foreach ($t in $tasks) { if (-not (Test-Path $t.Cmd)) { throw "missing $($t.Cmd)" } }

foreach ($t in $tasks) {
  $tr = if ($t.Ps) { "powershell -NoProfile -ExecutionPolicy Bypass -File `"`"$($t.Cmd)`"`"" } else { "cmd /c `"`"$($t.Cmd)`"`"" }
  schtasks /create /f /tn $t.Name /sc weekly /d $Days /st $t.At /tr $tr | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "schtasks failed for $($t.Name)" }
}

Write-Host "Registered (days: $Days):"
foreach ($t in $tasks) { Write-Host "  $($t.Name): $($t.At)" }

if (Test-Path $localTasks) { & $localTasks -Days $Days }
