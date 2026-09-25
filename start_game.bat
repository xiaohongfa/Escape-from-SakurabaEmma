@echo off
title The Backrooms: Level 0
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo First launch: creating the Python environment...
    python -m venv .venv
    if errorlevel 1 goto :failed
)

".venv\Scripts\python.exe" -c "import webview" >nul 2>&1
if errorlevel 1 (
    echo First launch: installing the desktop window component...
    ".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r requirements.txt
    if errorlevel 1 goto :failed
)

".venv\Scripts\python.exe" start_game.py
if errorlevel 1 goto :failed
exit /b 0

:failed
echo Game launch failed. Check that Python and Microsoft Edge WebView2 Runtime are installed.
pause
exit /b 1
