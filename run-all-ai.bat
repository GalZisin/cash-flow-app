@echo off
setlocal
cd /d "%~dp0"

REM ============================================================
REM   Cash Flow App - run EVERYTHING (Ollama + server + client) WITH AI
REM   One Node.js version (24 or newer) for both parts.
REM   Requires Ollama installed (https://ollama.com) and a model:  ollama pull qwen3:8b
REM   Without AI use: run-all.bat
REM ============================================================
call :check_node || goto :fail

if not exist "server\.env" (
    echo WARNING: server\.env not found. Copy server\.env.example to server\.env and fill in DB_CONNECTION_STRING.
    echo.
)
if not exist "node_modules\" (
    echo node_modules not found - running npm install for the client...
    call npm install || goto :fail
)
if not exist "server\node_modules\" (
    echo server\node_modules not found - running npm install for the server...
    call npm install --prefix server || goto :fail
)

echo ========================================
echo   Cash Flow App  (with local AI - Ollama)
echo ========================================
echo   Ollama  : http://localhost:11434  (model: %AI_MODEL%)
echo   Backend : http://localhost:3000
echo   Frontend: http://localhost:4300  (browser opens when ready)
echo   Press Ctrl+C to stop everything.
echo ========================================
echo.
call npm run dev:ai
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
