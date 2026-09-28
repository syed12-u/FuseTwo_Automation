@echo off
rem Daily staging regression (chromium project) — invoked by the
rem "FuseTwo Daily Regression" scheduled task; safe to run by hand.
setlocal
set "PATH=%LOCALAPPDATA%\Programs\node\node-v24.19.0-win-x64;%PATH%"
cd /d "%~dp0.."
if not exist logs mkdir logs
echo ==== %date% %time% ==== >> logs\daily-regression.log
node scripts\daily_regression.js %* >> logs\daily-regression.log 2>&1
echo ==== exit %errorlevel% ==== >> logs\daily-regression.log
endlocal
