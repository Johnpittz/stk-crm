@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================
echo  SINCRONIZADOR MILLENNIUM --^> CRM ROMA
echo ==========================================
echo.

powershell -ExecutionPolicy Bypass -File "sync-millennium.ps1"

echo.
pause
