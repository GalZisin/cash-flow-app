# PowerShell script to start the Cash Flow server
Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Starting Cash Flow Server...       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if node is installed
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js version: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "✗ Node.js is not installed!" -ForegroundColor Red
    Write-Host "  Please install Node.js from https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# Check if we're in the server directory
if (-not (Test-Path "index.js")) {
    Write-Host "✗ index.js not found!" -ForegroundColor Red
    Write-Host "  Please run this script from the server/ directory" -ForegroundColor Yellow
    exit 1
}

# Check if port 3000 is already in use
$port3000 = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($port3000) {
    Write-Host "⚠ Port 3000 is already in use!" -ForegroundColor Yellow
    Write-Host "  Would you like to stop the existing process? (Y/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq "Y" -or $response -eq "y") {
        $pid = $port3000.OwningProcess
        Stop-Process -Id $pid -Force
        Write-Host "✓ Stopped process $pid" -ForegroundColor Green
        Start-Sleep -Seconds 1
    }
    else {
        Write-Host "✗ Cannot start server - port 3000 is in use" -ForegroundColor Red
        exit 1
    }
}

# Start the server
Write-Host ""
Write-Host "Starting server..." -ForegroundColor Cyan
Write-Host ""
node index.js
