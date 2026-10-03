@echo off
cd /d "%~dp0"
echo Switching to Node.js 20 for Angular...
call nvm use 20.19.0
echo.

REM Refresh PATH to include Node.js
for /f "tokens=*" %%i in ('nvm current') do set NODE_VERSION=%%i
set "NODE_PATH=%NVM_HOME%\%NODE_VERSION%"
set "PATH=%NODE_PATH%;%PATH%"

echo Starting Angular Client...
echo Running from: %CD%
echo Node Path: %NODE_PATH%
echo.
npm run client
