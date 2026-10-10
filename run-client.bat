@echo off
setlocal
cd /d "%~dp0"

REM --- Both the Angular client and the Express server run on the same Node.js (24 or newer) ---
call :check_node || goto :fail

echo Starting Angular Client on http://localhost:4300 ...
echo Running from: %CD%
echo.
npm run client
exit /b %ERRORLEVEL%

:check_node
set "NODE_MAJOR="
for /f "tokens=1 delims=." %%v in ('node -v 2^>nul') do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR (
    echo ERROR: Node.js was not found in PATH. Install Node.js 24 LTS from https://nodejs.org
    exit /b 1
)
set "NODE_MAJOR=%NODE_MAJOR:v=%"
if %NODE_MAJOR% LSS 24 (
    echo ERROR: Node.js 24 or newer is required, found:
    node -v
    echo If you use nvm:  nvm install 24  ^&^&  nvm use 24
    exit /b 1
)
echo Using Node.js:
node -v
echo.
exit /b 0

:fail
pause
exit /b 1
