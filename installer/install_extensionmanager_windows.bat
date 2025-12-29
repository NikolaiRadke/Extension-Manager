@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

echo ================================
echo Extension Manager Installer
echo ================================
echo.

set "EXTENSIONS_DIR=%USERPROFILE%\.arduinoIDE\extensions"
set "DEPLOYED_DIR=%USERPROFILE%\.arduinoIDE\deployedPlugins"
set "VSIX_FILE=%~dp0extension-manager.vsix"

REM Check if VSIX file exists
if not exist "%VSIX_FILE%" (
    echo [Error] extension-manager.vsix was not found in folder:
    echo %~dp0
    echo Please make sure the file is in the same folder as this installer.
    echo.
    pause
    exit /b 1
)

REM Create folder if it doesn't exist
if not exist "%EXTENSIONS_DIR%" (
    echo Creating extension directory...
    mkdir "%EXTENSIONS_DIR%"
)

REM Remove old version
if exist "%EXTENSIONS_DIR%\extension-manager.vsix" (
    echo Removing old extension...
    del "%EXTENSIONS_DIR%\extension-manager.vsix"
)

if exist "%DEPLOYED_DIR%\extension-manager" (
    echo Removing old installation...
    rmdir /s /q "%DEPLOYED_DIR%\extension-manager"
)

REM Copy new file
echo Installing new extension...
copy "%VSIX_FILE%" "%EXTENSIONS_DIR%\" >nul

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [Success] Extension Manager installed!
    echo.
    echo Location: %EXTENSIONS_DIR%\extension-manager.vsix
    echo.
    echo Please restart Arduino IDE to use the extension.
) else (
    echo.
    echo [Error] Installation failed
)

echo.
pause
