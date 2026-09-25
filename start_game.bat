@echo off
chcp 65001 >nul
title The Backrooms: Level 0
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo 首次启动：正在创建游戏运行环境……
    python -m venv .venv
    if errorlevel 1 goto :failed
)

".venv\Scripts\python.exe" -c "import webview" >nul 2>&1
if errorlevel 1 (
    echo 首次启动：正在安装内置窗口组件……
    ".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r requirements.txt
    if errorlevel 1 goto :failed
)

".venv\Scripts\python.exe" start_game.py
if errorlevel 1 goto :failed
exit /b 0

:failed
echo 游戏启动失败。请确认已安装 Python 和 Microsoft Edge WebView2 Runtime。
pause
exit /b 1
