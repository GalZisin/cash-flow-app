# PowerShell script to run backend server
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath
Write-Host "Switching to Node.js 24 for Backend..." -ForegroundColor Yellow
cmd /c "nvm use 24.11.0"
Set-Location "$scriptPath\server"
Write-Host "Starting Backend Server..." -ForegroundColor Green
Write-Host "Running from: $(Get-Location)" -ForegroundColor Cyan
node index.js
