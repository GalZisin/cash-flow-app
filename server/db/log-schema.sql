/* ============================================================================
   Cash Flow App - API access log table (Microsoft SQL Server)
   Database name : CashFlowDB
   Run it        : SSMS / Azure Data Studio (Execute), or
                   sqlcmd -S localhost -E -i log-schema.sql
   Run order     : AFTER schema.sql (the database must already exist).
   Re-runnable   : every object is created only if it does not exist yet.

   One row per HTTP request handled by the Express server (server/app.js).
   Modelled on the [log].[...ApiAccess] table pattern, adapted to this project:
   - snake_case names, NVARCHAR for Hebrew text, DATETIME2(3) timestamps in the
     LOCAL time of the server machine (written by the Node server; added_on uses
     SYSDATETIME()).
   - inner_method_name holds the chain of service / repository methods the request
     went through, e.g. "cashFlowService.saveCashFlow > cashFlowRepository.write".
   - request_id is the uuid v4 the server generates per request.
   - entity_id replaces the domain-specific "form number": the id of the
     installment / investment / goal / conversation the request touched.
   - user_name has a default because the app has no login yet.
   ============================================================================ */

USE CashFlowDB;
GO

-- Required for the filtered index below (SSMS sets these; sqlcmd does not).
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF SCHEMA_ID(N'log') IS NULL
BEGIN
    EXEC (N'CREATE SCHEMA [log] AUTHORIZATION dbo;');
END
GO

IF OBJECT_ID(N'log.cash_flow_api_access', N'U') IS NULL
BEGIN
    CREATE TABLE [log].cash_flow_api_access (
        event_id          BIGINT IDENTITY(1000,1) NOT NULL CONSTRAINT PK_log_cash_flow_api_access PRIMARY KEY CLUSTERED,
        request_id        VARCHAR(50)    NOT NULL,                      -- uuid v4 per request
        user_name         NVARCHAR(128)  NOT NULL CONSTRAINT DF_log_cfaa_user_name DEFAULT N'local',
        start_time        DATETIME2(3)   NOT NULL,                      -- local time of the server machine
        service_name      VARCHAR(100)   NOT NULL,                      -- route module: cash-flow | installments | investments | goals | budget | ai | health
        method_name       VARCHAR(256)   NOT NULL,                      -- route handler, e.g. "GET /api/cash-flow"
        inner_method_name NVARCHAR(2000) NULL,                          -- "service.method > repository.method > ..." (utils/traceMethods.js)
        http_method       VARCHAR(10)    NOT NULL,                      -- GET | POST | PUT | PATCH | DELETE
        request_path      NVARCHAR(512)  NOT NULL,                      -- actual URL path (with route params filled in)
        request_data      NVARCHAR(MAX)  NULL,                          -- body + query as JSON (may be truncated)
        response_data     NVARCHAR(MAX)  NULL,                          -- response body as JSON (may be truncated)
        entity_id         NVARCHAR(50)   NULL,                          -- id of the installment / investment / goal / conversation involved
        is_error          BIT            NOT NULL CONSTRAINT DF_log_cfaa_is_error DEFAULT 0,
        event_message     NVARCHAR(MAX)  NULL,                          -- error name + message (+ stack in development)
        machine_name      NVARCHAR(256)  NULL,                          -- os.hostname() of the server
        ip_address        VARCHAR(128)   NULL,                          -- req.ip (IPv4 / IPv6)
        end_time          DATETIME2(3)   NULL,                          -- local time, NULL while the request is still running
        total_time        AS (DATEDIFF(MILLISECOND, start_time, ISNULL(end_time, start_time))),
        added_by          NVARCHAR(50)   NOT NULL CONSTRAINT DF_log_cfaa_added_by DEFAULT (SUSER_SNAME()),
        added_on          DATETIME2(3)   NOT NULL CONSTRAINT DF_log_cfaa_added_on DEFAULT (SYSDATETIME()),
        status            INT            NULL                           -- HTTP status code of the response
    );

    -- Newest first (the usual "show me the last N requests" query).
    CREATE INDEX IX_log_cfaa_start_time ON [log].cash_flow_api_access (start_time DESC);

    -- Find all rows of one request (start / end / nested calls).
    CREATE INDEX IX_log_cfaa_request_id ON [log].cash_flow_api_access (request_id);

    -- Errors only; filtered so it stays tiny.
    CREATE INDEX IX_log_cfaa_errors ON [log].cash_flow_api_access (start_time DESC)
        INCLUDE (service_name, method_name, status, event_message)
        WHERE is_error = 1;
END
GO
