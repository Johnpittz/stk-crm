@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================
echo  TESTE DE SINCRONIZACAO - RESUMO
echo ==========================================
echo.

powershell -ExecutionPolicy Bypass -File "test-sync-resumo.ps1"

echo.
pause
