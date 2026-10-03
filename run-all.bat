@echo off
cd /d "%~dp0"

if not defined NVM_HOME set "NVM_HOME=%APPDATA%\nvm"
set "NODE24=%NVM_HOME%\v24.11.0"
set "NODE20=%NVM_HOME%\v20.19.0"

if not exist "%NODE24%\node.exe" (
    echo Node 24.11.0 not found in %NODE24%
    echo Run: nvm install 24.11.0
    pause
    exit /b 1
)
if not exist "%NODE20%\node.exe" (
    echo Node 20.19.0 not found in %NODE20%
    echo Run: nvm install 20.19.0
    pause
    exit /b 1
)

echo ========================================
echo   Starting Cash Flow App
echo ========================================
echo.
echo Opening 2 terminal windows:
echo   1. Backend Server (Node 24)
echo   2. Angular Client (Node 20) - browser opens automatically
echo.

REM Backend - Node 24 (only for this window)
start "Backend Server (Node 24)" /d "%~dp0server" cmd /k "set PATH=%NODE24%;%PATH%&& node -v && node index.js"

REM Wait 3 seconds for the server to start
timeout /t 3 /nobreak > nul

REM Frontend - Node 20 (only for this window), opens the browser when the build is ready
start "Angular Client (Node 20)" /d "%~dp0" cmd /k "set PATH=%NODE20%;%PATH%&& node -v && npx ng serve --port 4300 --open"

echo.
echo ========================================
echo   Both services are starting!
echo ========================================
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:4300
echo.
echo Press any key to close this window...
pause > nul