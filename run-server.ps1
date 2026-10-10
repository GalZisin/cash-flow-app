# PowerShell script to run the backend server.
# The server and the Angular client both run on the same Node.js (24 or newer).
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

$nodeVersion = (& node -v 2>$null)
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js was not found in PATH. Install Node.js 24 LTS from https://nodejs.org" -ForegroundColor Red
    exit 1
}
$major = [int]($nodeVersion.TrimStart('v').Split('.')[0])
if ($major -lt 24) {
    Write-Host "ERROR: Node.js 24 or newer is required, found $nodeVersion" -ForegroundColor Red
    Write-Host "If you use nvm:  nvm install 24 ; nvm use 24" -ForegroundColor Yellow
    exit 1
}
Write-Host "Using Node.js $nodeVersion" -ForegroundColor Green

if (-not (Test-Path "server\.env")) {
    Write-Host "WARNING: server\.env not found. Copy server\.env.example to server\.env and fill in DB_CONNECTION_STRING." -ForegroundColor Yellow
}

Set-Location "$scriptPath\server"
Write-Host "Starting Backend Server on http://localhost:3000 ..." -ForegroundColor Green
Write-Host "Running from: $(Get-Location)" -ForegroundColor Cyan
node index.js
