@echo off
title ArriendoMapa v2 - stack completo
cd /d "%~dp0"

REM Algunos Windows tienen ComSpec vacio y NODE_ENV=production:
REM eso rompe npm install (esbuild) y omite las devDependencies.
set ComSpec=C:\Windows\System32\cmd.exe
set NODE_ENV=development

echo.
echo  ============================================
echo    ARRIENDOMAPA v2 - levantando el stack
echo  ============================================
echo.

if not exist "backend\dist\main.js" (
  echo  Falta compilar. Ejecuta primero:
  echo    cd backend  ^&^& npm install --include=dev ^&^& npm run build
  echo    cd frontend ^&^& npm install --include=dev ^&^& npm run build
  pause
  exit /b
)

start "ArriendoMapa API" /min cmd /c "cd backend && node dist/main.js"
timeout /t 4 /nobreak >nul
start "ArriendoMapa Web" /min cmd /c "cd frontend && node node_modules/vite/bin/vite.js preview --port 4173 --host 127.0.0.1"
timeout /t 7 /nobreak >nul

echo    API : http://localhost:3000/api
echo    WEB : http://localhost:4173
echo.
start http://localhost:4173/
echo    Para detener: cierra las dos ventanas minimizadas.
echo.
pause
