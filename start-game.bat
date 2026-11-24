@echo off
rem Double-click to start Touchdown PVP: database, game server and Expo app.
rem The real work is in start-game.ps1 next to this file.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-game.ps1"
if errorlevel 1 (
  echo.
  echo Something went wrong - see the message above.
  pause
) else (
  timeout /t 8
)
