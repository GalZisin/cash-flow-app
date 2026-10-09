-- Create CashFlowDB database and user
-- Run this with: sqlcmd -S localhost,1433 -E -i tools/create-db-and-user.sql

USE master;
GO

-- Create database if not exists
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'CashFlowDB')
BEGIN
    CREATE DATABASE CashFlowDB;
    PRINT 'Created database CashFlowDB';
END
ELSE
BEGIN
    PRINT 'Database CashFlowDB already exists';
END
GO

-- Drop and recreate login
IF SUSER_ID(N'cashflow_app') IS NOT NULL
BEGIN
    DROP LOGIN cashflow_app;
    PRINT 'Dropped existing login cashflow_app';
END
GO

-- Create login with password
CREATE LOGIN cashflow_app WITH PASSWORD = N'CashFlow2024!Secure', CHECK_POLICY = OFF;
PRINT 'Created login cashflow_app with password: CashFlow2024!Secure';
GO

USE CashFlowDB;
GO

-- Drop and recreate user
IF USER_ID(N'cashflow_app') IS NOT NULL
BEGIN
    DROP USER cashflow_app;
    PRINT 'Dropped existing user cashflow_app';
END
GO

CREATE USER cashflow_app FOR LOGIN cashflow_app;
PRINT 'Created user cashflow_app in CashFlowDB';
GO

-- Grant full permissions
ALTER ROLE db_datareader ADD MEMBER cashflow_app;
ALTER ROLE db_datawriter ADD MEMBER cashflow_app;
ALTER ROLE db_ddladmin ADD MEMBER cashflow_app;
PRINT 'Granted full permissions to cashflow_app';
GO

PRINT '';
PRINT '========================================';
PRINT 'Setup completed successfully!';
PRINT 'Use this connection string:';
PRINT 'Server=localhost,1433;Database=CashFlowDB;User Id=cashflow_app;Password=CashFlow2024!Secure;Encrypt=false;TrustServerCertificate=true;';
PRINT '========================================';
GO
