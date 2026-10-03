/* ============================================================================
   OPTIONAL - dedicated SQL login for the Node.js server (instead of "sa").
   1. Replace the password below with your own strong password.
   2. Run once on the SQL Server instance, AFTER schema.sql.
   3. Put the same password in server/.env (DB_CONNECTION_STRING).
   SQL Server must allow "SQL Server and Windows Authentication mode".
   ============================================================================ */

USE master;
GO

IF SUSER_ID(N'cashflow_app') IS NULL
BEGIN
    CREATE LOGIN cashflow_app WITH PASSWORD = N'CHANGE_ME_to_a_strong_password!1', CHECK_POLICY = ON;
END
GO

USE CashFlowDB;
GO

IF USER_ID(N'cashflow_app') IS NULL
BEGIN
    CREATE USER cashflow_app FOR LOGIN cashflow_app;
END
GO

ALTER ROLE db_datareader ADD MEMBER cashflow_app;
ALTER ROLE db_datawriter ADD MEMBER cashflow_app;
GO
