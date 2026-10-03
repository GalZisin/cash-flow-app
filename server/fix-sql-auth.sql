-- Enable SQL Server Authentication Mode and fix login
-- Run with: sqlcmd -S . -E -i fix-sql-auth.sql

USE master;
GO

-- Enable SQL Server and Windows Authentication mode (Mixed Mode)
EXEC xp_instance_regwrite 
    N'HKEY_LOCAL_MACHINE', 
    N'Software\Microsoft\MSSQLServer\MSSQLServer',
    N'LoginMode', 
    REG_DWORD, 
    2;  -- 2 = Mixed Mode (SQL + Windows), 1 = Windows Only
GO

PRINT 'Enabled Mixed Mode Authentication';
PRINT 'NOTE: SQL Server restart is required for this change to take effect!';
PRINT '';

-- Make sure the login exists and is enabled
IF SUSER_ID(N'cashflow_app') IS NULL
BEGIN
    CREATE LOGIN cashflow_app WITH PASSWORD = N'CashFlow2024!Secure', CHECK_POLICY = OFF;
    PRINT 'Created login cashflow_app';
END
ELSE
BEGIN
    ALTER LOGIN cashflow_app ENABLE;
    ALTER LOGIN cashflow_app WITH PASSWORD = N'CashFlow2024!Secure', CHECK_POLICY = OFF;
    PRINT 'Login cashflow_app already exists - enabled and password reset';
END
GO

-- Grant necessary permissions
ALTER SERVER ROLE sysadmin ADD MEMBER cashflow_app;
PRINT 'Granted sysadmin role to cashflow_app';
GO

USE CashFlowDB;
GO

-- Make sure user exists in database
IF USER_ID(N'cashflow_app') IS NULL
BEGIN
    CREATE USER cashflow_app FOR LOGIN cashflow_app;
    PRINT 'Created user in CashFlowDB';
END
GO

-- Grant all permissions
ALTER ROLE db_owner ADD MEMBER cashflow_app;
PRINT 'Granted db_owner role in CashFlowDB';
GO

PRINT '';
PRINT '========================================';
PRINT 'Setup completed!';
PRINT 'IMPORTANT: Restart SQL Server for authentication mode change to take effect';
PRINT 'Then test with: node test-connection.js';
PRINT '========================================';
