@echo off
echo Starting Zero Studio...
start /B node server.js
timeout /t 2 /nobreak >nul
npx neu run
