@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

echo ================================
echo Extension Manager Installer
echo ================================
echo.

set "EXTENSIONS_DIR=%USERPROFILE%\.arduinoIDE\extensions"
set "DEPLOYED_DIR=%USERPROFILE%\.arduinoIDE\deployedPlugins"
set "SCRIPT_DIR=%~dp0"

REM Find VSIX file (versioned or not)
set "VSIX_FILE="
if exist "%SCRIPT_DIR%extensionmanager.vsix" (
    set "VSIX_FILE=%SCRIPT_DIR%extensionmanager.vsix"
) else if exist "%SCRIPT_DIR%extension-manager.vsix" (
    set "VSIX_FILE=%SCRIPT_DIR%extension-manager.vsix"
) else (
    REM Look for versioned VSIX (e.g., extension-manager-1.0.0.vsix)
    for /f "delims=" %%i in ('dir /b /o-n "%SCRIPT_DIR%extension-manager-*.vsix" 2^>nul') do (
        set "VSIX_FILE=%SCRIPT_DIR%%%i"
        goto :found
    )
)
:found

REM Check if VSIX file exists
if not defined VSIX_FILE (
    echo [Error] No extension-manager*.vsix file found in folder:
    echo %SCRIPT_DIR%
    echo.
    echo Looking for: extension-manager.vsix or extension-manager-*.vsix
    echo Please make sure the file is in the same folder as this installer.
    echo.
    pause
    exit /b 1
)

for %%F in ("%VSIX_FILE%") do set "VSIX_FILENAME=%%~nxF"
echo Found: %VSIX_FILENAME%
echo.

REM Create folder if it doesn't exist
if not exist "%EXTENSIONS_DIR%" (
    echo Creating extension directory...
    mkdir "%EXTENSIONS_DIR%"
)

REM Remove old versions (all extension-manager*.vsix files)
echo Cleaning up old installations...
del /q "%EXTENSIONS_DIR%\extension-manager*.vsix" 2>nul
del /q "%EXTENSIONS_DIR%\extensionmanager*.vsix" 2>nul

if exist "%DEPLOYED_DIR%\extension-manager" (
    echo Removing old deployed extension...
    rmdir /s /q "%DEPLOYED_DIR%\extension-manager"
)

REM Copy new file
echo Installing new extension...
copy "%VSIX_FILE%" "%EXTENSIONS_DIR%\" >nul

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [Success] Extension installed successfully!
    echo.
    echo File: %VSIX_FILENAME%
    echo Location: %EXTENSIONS_DIR%
    echo.
    echo Restart Arduino IDE to use Extension Manager.
) else (
    echo.
    echo [Error] Installation failed
)

echo.
pause
