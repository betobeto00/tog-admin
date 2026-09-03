@echo off
REM build.bat — Compila TOG Admin y genera el instalador con Inno Setup.
REM
REM Flujo: npm install -> vite build -> electron-builder (dir) -> Inno Setup
REM
REM Requiere: Node.js 20+, Inno Setup 6 en PATH
REM
REM Uso:
REM     build.bat            (version por defecto 1.0.0)
REM     build.bat 1.2.0      (version especifica)
setlocal

set VERSION=%~1
if "%VERSION%"=="" set VERSION=1.0.0

echo ============================================
echo  TOG Admin v%VERSION% - Build Completo
echo ============================================
echo.

pushd "%~dp0"

REM ---- 1. Instalar dependencias + rebuild nativos ----
echo [1/5] Instalando dependencias y rebuildando nativos...
call npm install --quiet || goto :err
call npx electron-rebuild --force || goto :err

REM ---- 2. Build de Vite (renderer React) ----
echo [2/5] Compilando renderer (React + Vite)...
call npx vite build || goto :err

REM ---- 3. Build de Electron (main process) ----
echo [3/5] Compilando main process (TypeScript)...
call npx tsc -p tsconfig.main.json || goto :err

REM ---- 4. Empaquetar con electron-builder (directorio, NO nsis) ----
echo [4/5] Empaquetando app Electron...
set OG_VERSION=%npm_package_version%
call npm version %VERSION% --no-git-tag-version
call npx electron-builder --win --dir || (
  echo [ERROR] electron-builder fallo
  goto :err
)
REM Restaurar version original
call npm version %OG_VERSION% --no-git-tag-version

if not exist "dist-win\TOG Admin.exe" (
  echo [ERROR] No se genero dist-win\TOG Admin.exe
  goto :err
)

echo.
echo  App empaquetada: dist-win\TOG Admin.exe

REM ---- 5. Instalador Inno Setup ----
echo [5/5] Compilando instalador con Inno Setup...
set ISCC=
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC=C:\Program Files\Inno Setup 6\ISCC.exe"

if defined ISCC (
  "%ISCC%" packaging\installer.iss
  if exist "release\TOG-Admin-Setup.exe" (
    echo.
    echo  ============================================
    echo   BUILD COMPLETO
    echo  ============================================
    echo   App:    dist-win\TOG Admin.exe
    echo   Setup:  release\TOG-Admin-Setup.exe
    echo  ============================================
    echo.
    REM Calcular hash SHA-256
    for /f %%H in ('certutil -hashfile "release\TOG-Admin-Setup.exe" SHA256 ^| findstr /r "^[0-9a-f]"') do set SHA=%%H
    echo SHA-256 del setup: %SHA%
  ) else (
    echo [aviso] Inno Setup termino pero no se genero el setup.exe
  )
) else (
  echo [aviso] Inno Setup no esta instalado.
  echo   Descargalo en: https://jrsoftware.org/isdl.php
  echo   La app esta lista en: dist-win\TOG Admin.exe
)

popd
exit /b 0

:err
echo.
echo [ERROR] Build fallido. Revisa los errores arriba.
popd
exit /b 1
