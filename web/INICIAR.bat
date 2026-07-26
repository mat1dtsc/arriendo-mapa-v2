@echo off
title ArriendoMapa - servidor local
cd /d "%~dp0"

where python >nul 2>&1
if %errorlevel%==0 (
    python servidor.py
    goto :fin
)
where py >nul 2>&1
if %errorlevel%==0 (
    py servidor.py
    goto :fin
)
where python3 >nul 2>&1
if %errorlevel%==0 (
    python3 servidor.py
    goto :fin
)

echo.
echo  No se encontro Python en este PC.
echo.
echo  Opciones:
echo   1^) Instalar Python desde https://python.org/downloads ^(marcar "Add to PATH"^)
echo   2^) Copiar esta carpeta a C:\xampp\htdocs\arriendomapa y abrir
echo      http://localhost/arriendomapa/ con XAMPP encendido
echo   3^) Abrir index.html directamente con doble clic
echo.
pause
:fin
