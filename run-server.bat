@echo off
cd /d "%~dp0"
echo Switching to Node.js 24 for Backend...
call nvm use 24.11.0
echo.

REM Refresh PATH to include Node.js
for /f "tokens=*" %%i in ('nvm current') do set NODE_VERSION=%%i
set "NODE_PATH=%NVM_HOME%\%NODE_VERSION%"
set "PATH=%NODE_PATH%;%PATH%"

cd server
echo Starting Backend Server...
echo Running from: %CD%
echo Node Path: %NODE_PATH%
echo.
node index.js
