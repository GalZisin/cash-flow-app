# Setup SQL User for CashFlowDB
# This script creates a SQL login and database user

Write-Host "🔧 Setting up SQL User for CashFlowDB`n" -ForegroundColor Cyan

# Generate a strong password
$password = "CashFlow_" + (Get-Random -Minimum 1000 -Maximum 9999) + "!Secure"

Write-Host "📝 Generated password: $password" -ForegroundColor Yellow
Write-Host "   ⚠️  Save this password - you'll need it for .env file`n" -ForegroundColor Yellow

# Create SQL script with the password
$sqlScript = @"
USE master;
GO

-- Drop existing login if exists
IF SUSER_ID(N'cashflow_app') IS NOT NULL
BEGIN
    DROP LOGIN cashflow_app;
    PRINT 'Dropped existing login cashflow_app';
END
GO

-- Create new login
CREATE LOGIN cashflow_app WITH PASSWORD = N'$password', CHECK_POLICY = OFF;
PRINT 'Created login cashflow_app';
GO

-- Create database if not exists
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'CashFlowDB')
BEGIN
    CREATE DATABASE CashFlowDB;
    PRINT 'Created database CashFlowDB';
END
GO

USE CashFlowDB;
GO

-- Drop existing user if exists
IF USER_ID(N'cashflow_app') IS NOT NULL
BEGIN
    DROP USER cashflow_app;
    PRINT 'Dropped existing user cashflow_app';
END
GO

-- Create user
CREATE USER cashflow_app FOR LOGIN cashflow_app;
PRINT 'Created user cashflow_app in CashFlowDB';
GO

-- Grant permissions
ALTER ROLE db_datareader ADD MEMBER cashflow_app;
ALTER ROLE db_datawriter ADD MEMBER cashflow_app;
ALTER ROLE db_ddladmin ADD MEMBER cashflow_app;
PRINT 'Granted permissions to cashflow_app';
GO

PRINT 'Setup completed successfully!';
"@

# Save to temp file
$tempFile = "$PSScriptRoot\temp-setup.sql"
$sqlScript | Out-File -FilePath $tempFile -Encoding UTF8

Write-Host "🔌 Connecting to SQL Server..." -ForegroundColor Cyan

# Try to execute on default instance
$result = sqlcmd -S "localhost,1433" -E -i $tempFile 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ SQL User created successfully!" -ForegroundColor Green
    Write-Host "`n📋 Update your .env file with:" -ForegroundColor Cyan
    Write-Host "DB_CONNECTION_STRING=Server=localhost,1433;Database=CashFlowDB;User Id=cashflow_app;Password=$password;Encrypt=false;TrustServerCertificate=true;" -ForegroundColor Yellow
    
    # Optionally update .env automatically
    $envPath = "$PSScriptRoot\.env"
    if (Test-Path $envPath) {
        $envContent = Get-Content $envPath
        $newContent = $envContent -replace '^DB_CONNECTION_STRING=.*', "DB_CONNECTION_STRING=Server=localhost,1433;Database=CashFlowDB;User Id=cashflow_app;Password=$password;Encrypt=false;TrustServerCertificate=true;"
        $newContent | Set-Content $envPath
        Write-Host "`n✅ .env file updated automatically!" -ForegroundColor Green
    }
}
else {
    Write-Host "`n❌ Failed to create SQL user" -ForegroundColor Red
    Write-Host $result
    Write-Host "`n💡 Try running SQL Server Management Studio and execute the SQL manually" -ForegroundColor Yellow
}

# Cleanup
Remove-Item $tempFile -ErrorAction SilentlyContinue

Write-Host "`n✅ Done!" -ForegroundColor Green
