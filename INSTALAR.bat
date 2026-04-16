@echo off
echo ==========================================
echo  CRM ROMA - Instalador de Dependencias
echo ==========================================
echo.
echo Instalando dependencias...
call npm install
echo.
if %errorlevel% == 0 (
    echo.
    echo ==========================================
    echo  Instalacao concluida com sucesso!
    echo ==========================================
    echo.
    echo Para iniciar o servidor:
    echo   npm run dev
    echo.
    echo Ou execute: INICIAR.bat
    echo.
    pause
) else (
    echo.
    echo ==========================================
    echo  ERRO na instalacao!
    echo ==========================================
    echo.
    echo Verifique se o Node.js esta instalado:
    echo   node --version
    echo   npm --version
    echo.
    pause
)
