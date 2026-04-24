@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================
echo  DIAGNOSTICO MILLENNIUM
echo ==========================================
echo.

powershell -ExecutionPolicy Bypass -File "diagnostico-millennium.ps1"

echo.
pause
