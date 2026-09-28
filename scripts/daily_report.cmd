@echo off
rem End-of-day QA report — invoked by the "FuseTwo Daily Report" scheduled task.
setlocal
set "PATH=%LOCALAPPDATA%\Programs\node\node-v24.19.0-win-x64;%PATH%"
cd /d "%~dp0.."
if not exist logs mkdir logs
echo ==== %date% %time% ==== >> logs\daily-report.log
node scripts\daily_report.js %* >> logs\daily-report.log 2>&1
echo ==== exit %errorlevel% ==== >> logs\daily-report.log
endlocal
