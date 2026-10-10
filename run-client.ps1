# PowerShell script to run the Angular client.
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

Write-Host "Starting Angular Client on http://localhost:4300 ..." -ForegroundColor Green
Write-Host "Running from: $(Get-Location)" -ForegroundColor Cyan
npm run client
