# PowerShell script to run Angular client
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath
Write-Host "Switching to Node.js 20 for Angular..." -ForegroundColor Yellow
cmd /c "nvm use 20.19.0"
Write-Host "Starting Angular Client..." -ForegroundColor Green
Write-Host "Running from: $(Get-Location)" -ForegroundColor Cyan
npm run client
