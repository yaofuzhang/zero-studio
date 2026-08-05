@echo off
cd /d "%~dp0"
echo Zero Studio — 启动中...
start "" http://localhost:8765
node server.js
pause
