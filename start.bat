@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python or run a static server manually:
  echo   npx serve .
  pause
  exit /b 1
)

echo.
echo   STELLAR WARS: LAST DEFENSE
echo   Serving from %CD%
echo   Open http://127.0.0.1:8000/index.html
echo   Press Ctrl+C to stop the server.
echo.

start "" "http://127.0.0.1:8000/index.html"
python -m http.server 8000 --bind 127.0.0.1
