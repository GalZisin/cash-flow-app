# Server Refactoring Migration Script (PowerShell)

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   Server Refactoring Migration        ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Step 1: Backup
Write-Host "Step 1: Creating backup..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "backup" | Out-Null
Get-ChildItem -Path "." -Filter "*.js" | Copy-Item -Destination "backup" -ErrorAction SilentlyContinue
Get-ChildItem -Path "." -Filter "*.json" | Copy-Item -Destination "backup" -ErrorAction SilentlyContinue
Write-Host "✓ Backup created in ./backup/" -ForegroundColor Green
Write-Host ""

# Step 2: Create data directory
Write-Host "Step 2: Creating data directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "data" | Out-Null
Write-Host "✓ data/ directory ready" -ForegroundColor Green
Write-Host ""

# Step 3: Move JSON files
Write-Host "Step 3: Moving JSON files to data/..." -ForegroundColor Yellow

function Move-IfExists {
    param($source, $dest)
    if (Test-Path $source) {
        Copy-Item $source $dest -Force
        Write-Host "✓ $(Split-Path $dest -Leaf)" -ForegroundColor Green
    }
}

Move-IfExists "cash-flow-data-miluim.json" "data/cash-flow-data.json"
Move-IfExists "cash-flow-defaults.json" "data/cash-flow-defaults.json"
Move-IfExists "installments.json" "data/installments.json"
Move-IfExists "investments.json" "data/investments.json"
Move-IfExists "conversations.json" "data/conversations.json"

if (Test-Path "data/ai-reports.json") {
    Write-Host "✓ ai-reports.json (already in data/)" -ForegroundColor Green
}

Write-Host ""

# Step 4: Backup old index.js
Write-Host "Step 4: Updating index.js..." -ForegroundColor Yellow
if (Test-Path "index.js") {
    Move-Item "index.js" "index.old.js" -Force
    Write-Host "✓ Old index.js saved as index.old.js" -ForegroundColor Green
}

if (Test-Path "index.new.js") {
    Copy-Item "index.new.js" "index.js" -Force
    Write-Host "✓ New index.js activated" -ForegroundColor Green
}
Write-Host ""

# Step 5: Verify structure
Write-Host "Step 5: Verifying directory structure..." -ForegroundColor Yellow

function Check-Dir {
    param($dir)
    if (Test-Path $dir) {
        Write-Host "✓ $dir/" -ForegroundColor Green
    } else {
        Write-Host "✗ $dir/ (missing)" -ForegroundColor Red
    }
}

Check-Dir "routes"
Check-Dir "services"
Check-Dir "repositories"
Check-Dir "utils"
Check-Dir "middleware"
Check-Dir "data"
Write-Host ""

# Step 6: List data files
Write-Host "Step 6: Data files in data/:" -ForegroundColor Yellow
Get-ChildItem -Path "data" -Filter "*.json" -ErrorAction SilentlyContinue | Format-Table Name, Length -AutoSize
Write-Host ""

# Step 7: Summary
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   Migration Complete!                  ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. " -NoNewline; Write-Host "npm start" -ForegroundColor Yellow -NoNewline; Write-Host " - Start the server"
Write-Host "2. " -NoNewline; Write-Host "curl http://localhost:3000/health" -ForegroundColor Yellow -NoNewline; Write-Host " - Test health"
Write-Host "3. " -NoNewline; Write-Host "curl http://localhost:3000/api/cash-flow" -ForegroundColor Yellow -NoNewline; Write-Host " - Test API"
Write-Host ""
Write-Host "If something goes wrong:"
Write-Host "- Restore: " -NoNewline; Write-Host "mv index.old.js index.js" -ForegroundColor Red
Write-Host "- Check logs in " -NoNewline; Write-Host "./backup/" -ForegroundColor Yellow
Write-Host ""
