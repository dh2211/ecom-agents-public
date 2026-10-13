@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or newer from nodejs.org, then open this file again.
  pause
  exit /b 1
)
node "app\commerce\server.mjs"
if errorlevel 1 pause
