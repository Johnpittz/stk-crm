@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================
echo  TESTE DE CONEXAO COM MILLENNIUM
echo ==========================================
echo.

powershell -ExecutionPolicy Bypass -File "test-millennium-local.ps1"

echo.
pause
