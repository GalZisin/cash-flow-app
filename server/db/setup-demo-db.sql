/* ============================================================================
   Cash Flow App - full local setup: database + all tables + DEMO data
   Database name : CashFlowDB
   Run it        : SSMS / Azure Data Studio (Execute the whole file), or
                   sqlcmd -S localhost -E -C -i server\db\setup-demo-db.sql

   What it does (one file, top to bottom):
     Part 1  Creates CashFlowDB and every table of the app        (= db/schema.sql)
     Part 2  Creates the API access log table log.cash_flow_api_access (= db/log-schema.sql)
     Part 3  Fills the tables with a demo household:
             - 24 months of cash flow (12 back, the current month, 11 ahead),
               with salaries, extra incomes, categorised regular expenses and
               one-off special expenses
             - template for new months and a monthly budget per category
             - installments: fixed payments (one finished), a car with two loans
               (one paid off early) and a kitchen renovation paid in milestones
             - 4 investments with deposits, a withdrawal, value snapshots and
               simulation rules
             - 5 financial goals (one completed)
             - 2 AI conversations and 2 saved AI reports
             All dates are relative to the month the script runs in, so the
             demo always shows "now" in the middle of the table and charts.

   Re-runnable:
     - Tables are created only if they do not exist yet.
     - Demo data is inserted only when the app tables are EMPTY. If they already
       hold data, Part 3 prints a message and changes nothing.
     - To wipe the app tables and load the demo again, change the 0 to 1 in the
       line below (the API access log table is never touched).

   Part 1 and Part 2 are copies of db/schema.sql and db/log-schema.sql: when a
   table changes there, change it here too.

   After running: set DB_CONNECTION_STRING in server/.env (see server/.env.example
   and db/create-app-user.sql), then "npm run dev". Goals show "pending" until
   they are analysed: press "analyze" on a goal, or
   curl -X POST http://localhost:3000/api/goals/analyze-all
   ============================================================================ */

EXEC sys.sp_set_session_context @key = N'cf_reset_demo_data', @value = 0;   -- 1 = wipe app tables and reload the demo
GO

-- Required for the filtered index of the log table (SSMS sets these; sqlcmd does not).
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ============================================================================
   PART 1 - database and app tables
   ============================================================================ */

IF DB_ID(N'CashFlowDB') IS NULL
BEGIN
    CREATE DATABASE CashFlowDB;
END
GO

USE CashFlowDB;
GO

/* ----------------------------------------------------------------------------
   Cash flow table (one row per month row in the table, in display order)
   NOTE: the same calendar month can appear more than once in the data, so
   month_date is NOT unique - sort_order keeps the order.
   ---------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.cash_flow_months', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.cash_flow_months (
        id                   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cash_flow_months PRIMARY KEY,
        sort_order           INT           NOT NULL,
        month_date           DATE          NOT NULL,
        starting_balance     DECIMAL(18,2) NOT NULL CONSTRAINT DF_cfm_starting_balance DEFAULT 0,
        income               DECIMAL(18,2) NOT NULL CONSTRAINT DF_cfm_income DEFAULT 0,
        mortgage_payment     DECIMAL(18,2) NOT NULL CONSTRAINT DF_cfm_mortgage DEFAULT 0,
        loan_payment         DECIMAL(18,2) NOT NULL CONSTRAINT DF_cfm_loan DEFAULT 0,
        manual_loan_payment  DECIMAL(18,2) NULL,
        installments_payment DECIMAL(18,2) NULL,
        ending_balance       DECIMAL(18,2) NOT NULL CONSTRAINT DF_cfm_ending_balance DEFAULT 0,
        savings              DECIMAL(18,2) NULL,
        row_color            NVARCHAR(20)  NULL,
        extra_json           NVARCHAR(MAX) NULL,
        CONSTRAINT UQ_cash_flow_months_sort_order UNIQUE (sort_order),
        CONSTRAINT CK_cash_flow_months_extra_json CHECK (extra_json IS NULL OR ISJSON(extra_json) = 1)
    );
    CREATE INDEX IX_cash_flow_months_month_date ON dbo.cash_flow_months (month_date);
END
GO

/* Items of a month: additional incomes, regular expenses, special expenses */
IF OBJECT_ID(N'dbo.cash_flow_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.cash_flow_items (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cash_flow_items PRIMARY KEY,
        month_id     INT           NOT NULL,
        kind         VARCHAR(20)   NOT NULL,
        sort_order   INT           NOT NULL,
        description  NVARCHAR(500) NOT NULL CONSTRAINT DF_cfi_description DEFAULT N'',
        amount       DECIMAL(18,2) NOT NULL CONSTRAINT DF_cfi_amount DEFAULT 0,
        category     VARCHAR(30)   NULL,
        goal_related BIT           NULL,
        goal_id      NVARCHAR(50)  NULL,
        extra_json   NVARCHAR(MAX) NULL,
        CONSTRAINT FK_cash_flow_items_month FOREIGN KEY (month_id)
            REFERENCES dbo.cash_flow_months (id) ON DELETE CASCADE,
        CONSTRAINT CK_cash_flow_items_kind CHECK (kind IN ('additionalIncome', 'regular', 'special')),
        CONSTRAINT CK_cash_flow_items_extra_json CHECK (extra_json IS NULL OR ISJSON(extra_json) = 1)
    );
    CREATE INDEX IX_cash_flow_items_month ON dbo.cash_flow_items (month_id, kind, sort_order);
    CREATE INDEX IX_cash_flow_items_category ON dbo.cash_flow_items (category) INCLUDE (amount);
END
GO

/* ----------------------------------------------------------------------------
   Cash flow defaults (template used when adding new months) - a single row
   ---------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.cash_flow_defaults', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.cash_flow_defaults (
        id               TINYINT       NOT NULL CONSTRAINT PK_cash_flow_defaults PRIMARY KEY,
        income           DECIMAL(18,2) NOT NULL CONSTRAINT DF_cfd_income DEFAULT 0,
        mortgage_payment DECIMAL(18,2) NOT NULL CONSTRAINT DF_cfd_mortgage DEFAULT 0,
        loan_payment     DECIMAL(18,2) NOT NULL CONSTRAINT DF_cfd_loan DEFAULT 0,
        CONSTRAINT CK_cash_flow_defaults_single_row CHECK (id = 1)
    );
END
GO

IF OBJECT_ID(N'dbo.cash_flow_default_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.cash_flow_default_items (
        id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cash_flow_default_items PRIMARY KEY,
        kind        VARCHAR(20)   NOT NULL,
        sort_order  INT           NOT NULL,
        description NVARCHAR(500) NOT NULL CONSTRAINT DF_cfdi_description DEFAULT N'',
        amount      DECIMAL(18,2) NOT NULL CONSTRAINT DF_cfdi_amount DEFAULT 0,
        category    VARCHAR(30)   NULL,
        CONSTRAINT CK_cash_flow_default_items_kind CHECK (kind IN ('additionalIncome', 'regular', 'special'))
    );
END
GO

/* ----------------------------------------------------------------------------
   Monthly budget limit per expense category
   ---------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.budget_settings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.budget_settings (
        category      VARCHAR(30)   NOT NULL CONSTRAINT PK_budget_settings PRIMARY KEY,
        sort_order    INT           NOT NULL,
        monthly_limit DECIMAL(18,2) NOT NULL CONSTRAINT DF_bs_limit DEFAULT 0
    );
END
GO

/* ----------------------------------------------------------------------------
   Installments (payment plans / loans / milestone payments)
   ---------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.installments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.installments (
        id                       NVARCHAR(50)  NOT NULL CONSTRAINT PK_installments PRIMARY KEY,
        seq                      INT IDENTITY(1,1) NOT NULL,
        name                     NVARCHAR(200) NOT NULL,
        total_amount             DECIMAL(18,2) NOT NULL CONSTRAINT DF_inst_total DEFAULT 0,
        down_payment             DECIMAL(18,2) NOT NULL CONSTRAINT DF_inst_down DEFAULT 0,
        monthly_payment          DECIMAL(18,2) NOT NULL CONSTRAINT DF_inst_monthly DEFAULT 0,
        installments_count       INT           NOT NULL CONSTRAINT DF_inst_count DEFAULT 0,
        start_date               NVARCHAR(30)  NULL,
        color                    NVARCHAR(20)  NOT NULL CONSTRAINT DF_inst_color DEFAULT N'#4f6ef7',
        notes                    NVARCHAR(MAX) NOT NULL CONSTRAINT DF_inst_notes DEFAULT N'',
        manual_paid_count        INT           NOT NULL CONSTRAINT DF_inst_paid DEFAULT 0,
        last_manual_payment_date NVARCHAR(30)  NULL,
        payment_type             VARCHAR(20)   NOT NULL CONSTRAINT DF_inst_ptype DEFAULT 'manual',
        linked_goal_id           NVARCHAR(50)  NULL,
        extra_json               NVARCHAR(MAX) NULL,
        CONSTRAINT UQ_installments_seq UNIQUE (seq),
        CONSTRAINT CK_installments_extra_json CHECK (extra_json IS NULL OR ISJSON(extra_json) = 1)
    );
END
GO

/* Loans that belong to an installment plan */
IF OBJECT_ID(N'dbo.installment_loan_components', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.installment_loan_components (
        installment_id     NVARCHAR(50)  NOT NULL,
        component_no       INT           NOT NULL,
        component_id       NVARCHAR(50)  NULL,
        description        NVARCHAR(200) NOT NULL CONSTRAINT DF_ilc_description DEFAULT N'',
        total_loan_amount  DECIMAL(18,2) NOT NULL CONSTRAINT DF_ilc_total DEFAULT 0,
        monthly_payment    DECIMAL(18,2) NOT NULL CONSTRAINT DF_ilc_monthly DEFAULT 0,
        installments_count INT           NOT NULL CONSTRAINT DF_ilc_count DEFAULT 0,
        start_date         NVARCHAR(30)  NULL,
        paid_count         INT           NOT NULL CONSTRAINT DF_ilc_paid DEFAULT 0,
        last_paid_date     NVARCHAR(30)  NULL,
        interest_rate      DECIMAL(9,4)  NULL,
        payoff_date        NVARCHAR(30)  NULL,
        payoff_amount      DECIMAL(18,2) NULL,
        payments_tracked   BIT           NOT NULL CONSTRAINT DF_ilc_tracked DEFAULT 0,
        extra_json         NVARCHAR(MAX) NULL,
        CONSTRAINT PK_installment_loan_components PRIMARY KEY (installment_id, component_no),
        CONSTRAINT FK_ilc_installment FOREIGN KEY (installment_id)
            REFERENCES dbo.installments (id) ON DELETE CASCADE,
        CONSTRAINT CK_ilc_extra_json CHECK (extra_json IS NULL OR ISJSON(extra_json) = 1)
    );
END
GO

/* Payments made on a specific loan */
IF OBJECT_ID(N'dbo.installment_loan_payments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.installment_loan_payments (
        id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_installment_loan_payments PRIMARY KEY,
        installment_id NVARCHAR(50)  NOT NULL,
        component_no   INT           NOT NULL,
        sort_order     INT           NOT NULL,
        payment_date   NVARCHAR(30)  NULL,
        amount         DECIMAL(18,2) NOT NULL CONSTRAINT DF_ilp_amount DEFAULT 0,
        CONSTRAINT FK_ilp_component FOREIGN KEY (installment_id, component_no)
            REFERENCES dbo.installment_loan_components (installment_id, component_no) ON DELETE CASCADE
    );
    CREATE INDEX IX_ilp_component ON dbo.installment_loan_payments (installment_id, component_no, sort_order);
END
GO

/* Milestones ("pulses") of a milestone-type installment */
IF OBJECT_ID(N'dbo.installment_milestones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.installment_milestones (
        id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_installment_milestones PRIMARY KEY,
        installment_id NVARCHAR(50)  NOT NULL,
        sort_order     INT           NOT NULL,
        milestone_id   NVARCHAR(50)  NULL,
        description    NVARCHAR(200) NOT NULL CONSTRAINT DF_im_description DEFAULT N'',
        percentage     DECIMAL(9,4)  NOT NULL CONSTRAINT DF_im_percentage DEFAULT 0,
        amount         DECIMAL(18,2) NOT NULL CONSTRAINT DF_im_amount DEFAULT 0,
        milestone_date NVARCHAR(30)  NULL,
        CONSTRAINT FK_im_installment FOREIGN KEY (installment_id)
            REFERENCES dbo.installments (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_im_installment ON dbo.installment_milestones (installment_id, sort_order);
END
GO

/* Payments that were made for milestones */
IF OBJECT_ID(N'dbo.installment_milestone_payments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.installment_milestone_payments (
        id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_installment_milestone_payments PRIMARY KEY,
        installment_id NVARCHAR(50)  NOT NULL,
        sort_order     INT           NOT NULL,
        payment_date   NVARCHAR(30)  NULL,
        amount         DECIMAL(18,2) NOT NULL CONSTRAINT DF_imp_amount DEFAULT 0,
        milestone_id   NVARCHAR(50)  NULL,
        description    NVARCHAR(200) NULL,
        CONSTRAINT FK_imp_installment FOREIGN KEY (installment_id)
            REFERENCES dbo.installments (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_imp_installment ON dbo.installment_milestone_payments (installment_id, sort_order);
END
GO

/* Payments recorded on the installment itself (manual payment history) */
IF OBJECT_ID(N'dbo.installment_payments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.installment_payments (
        id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_installment_payments PRIMARY KEY,
        installment_id NVARCHAR(50)  NOT NULL,
        sort_order     INT           NOT NULL,
        payment_date   NVARCHAR(30)  NULL,
        amount         DECIMAL(18,2) NOT NULL CONSTRAINT DF_ip_amount DEFAULT 0,
        CONSTRAINT FK_ip_installment FOREIGN KEY (installment_id)
            REFERENCES dbo.installments (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_ip_installment ON dbo.installment_payments (installment_id, sort_order);
END
GO

/* ----------------------------------------------------------------------------
   Investments (pension / funds / stocks)
   ---------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.investments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.investments (
        id              NVARCHAR(50)  NOT NULL CONSTRAINT PK_investments PRIMARY KEY,
        seq             INT IDENTITY(1,1) NOT NULL,
        name            NVARCHAR(200) NOT NULL,
        investment_type VARCHAR(20)   NOT NULL CONSTRAINT DF_inv_type DEFAULT 'other',
        initial_value   DECIMAL(18,2) NULL,
        annual_return   DECIMAL(9,4)  NULL,
        extra_json      NVARCHAR(MAX) NULL,
        CONSTRAINT UQ_investments_seq UNIQUE (seq),
        CONSTRAINT CK_investments_extra_json CHECK (extra_json IS NULL OR ISJSON(extra_json) = 1)
    );
END
GO

IF OBJECT_ID(N'dbo.investment_transactions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.investment_transactions (
        id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_investment_transactions PRIMARY KEY,
        investment_id NVARCHAR(50)  NOT NULL,
        sort_order    INT           NOT NULL,
        tx_id         NVARCHAR(50)  NULL,
        tx_date       NVARCHAR(30)  NOT NULL,
        amount        DECIMAL(18,2) NOT NULL CONSTRAINT DF_itx_amount DEFAULT 0,
        tx_type       VARCHAR(20)   NOT NULL CONSTRAINT DF_itx_type DEFAULT 'deposit',
        CONSTRAINT FK_itx_investment FOREIGN KEY (investment_id)
            REFERENCES dbo.investments (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_itx_investment ON dbo.investment_transactions (investment_id, sort_order);
END
GO

IF OBJECT_ID(N'dbo.investment_snapshots', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.investment_snapshots (
        id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_investment_snapshots PRIMARY KEY,
        investment_id  NVARCHAR(50)  NOT NULL,
        sort_order     INT           NOT NULL,
        snapshot_id    NVARCHAR(50)  NULL,
        snapshot_date  NVARCHAR(30)  NOT NULL,
        snapshot_value DECIMAL(18,2) NOT NULL CONSTRAINT DF_isn_value DEFAULT 0,
        CONSTRAINT FK_isn_investment FOREIGN KEY (investment_id)
            REFERENCES dbo.investments (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_isn_investment ON dbo.investment_snapshots (investment_id, sort_order);
END
GO

IF OBJECT_ID(N'dbo.investment_simulation_rules', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.investment_simulation_rules (
        id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_investment_simulation_rules PRIMARY KEY,
        investment_id   NVARCHAR(50)  NOT NULL,
        sort_order      INT           NOT NULL,
        rule_id         NVARCHAR(50)  NULL,
        from_month      INT           NOT NULL CONSTRAINT DF_isr_from DEFAULT 0,
        to_month        INT           NOT NULL CONSTRAINT DF_isr_to DEFAULT 0,
        monthly_amount  DECIMAL(18,2) NOT NULL CONSTRAINT DF_isr_monthly DEFAULT 0,
        one_time_amount DECIMAL(18,2) NOT NULL CONSTRAINT DF_isr_once DEFAULT 0,
        description     NVARCHAR(500) NULL,
        CONSTRAINT FK_isr_investment FOREIGN KEY (investment_id)
            REFERENCES dbo.investments (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_isr_investment ON dbo.investment_simulation_rules (investment_id, sort_order);
END
GO

/* ----------------------------------------------------------------------------
   Financial goals
   loan_details / schedule / analysis are deeply nested and change shape often,
   so they are stored as JSON documents inside the row.
   ---------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.financial_goals', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.financial_goals (
        id                          NVARCHAR(50)  NOT NULL CONSTRAINT PK_financial_goals PRIMARY KEY,
        seq                         INT IDENTITY(1,1) NOT NULL,
        name                        NVARCHAR(200) NOT NULL,
        description                 NVARCHAR(MAX) NULL,
        goal_type                   VARCHAR(20)   NOT NULL,
        target_amount               DECIMAL(18,2) NOT NULL CONSTRAINT DF_goal_amount DEFAULT 0,
        target_date                 NVARCHAR(30)  NULL,
        priority                    INT           NOT NULL CONSTRAINT DF_goal_priority DEFAULT 999,
        completed                   BIT           NOT NULL CONSTRAINT DF_goal_completed DEFAULT 0,
        is_fixed                    BIT           NULL,
        linked_installment_id       NVARCHAR(50)  NULL,
        linked_to_special_expense   BIT           NULL,
        auto_update_from_cash_flow  BIT           NULL,
        loan_details_json           NVARCHAR(MAX) NULL,
        schedule_json               NVARCHAR(MAX) NULL,
        analysis_json               NVARCHAR(MAX) NULL,
        last_analyzed               DATETIME2(3)  NULL,
        created_date                DATETIME2(3)  NULL,
        updated_date                DATETIME2(3)  NULL,
        completed_date              DATETIME2(3)  NULL,
        extra_json                  NVARCHAR(MAX) NULL,
        CONSTRAINT UQ_financial_goals_seq UNIQUE (seq),
        CONSTRAINT CK_goals_loan_json CHECK (loan_details_json IS NULL OR ISJSON(loan_details_json) = 1),
        CONSTRAINT CK_goals_schedule_json CHECK (schedule_json IS NULL OR ISJSON(schedule_json) = 1),
        CONSTRAINT CK_goals_analysis_json CHECK (analysis_json IS NULL OR ISJSON(analysis_json) = 1),
        CONSTRAINT CK_goals_extra_json CHECK (extra_json IS NULL OR ISJSON(extra_json) = 1)
    );
END
GO

/* ----------------------------------------------------------------------------
   AI assistant: conversations and saved reports
   ---------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.conversations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.conversations (
        id         NVARCHAR(50)  NOT NULL CONSTRAINT PK_conversations PRIMARY KEY,
        seq        INT IDENTITY(1,1) NOT NULL,
        title      NVARCHAR(500) NOT NULL,
        created_at DATETIME2(3)  NULL,
        updated_at DATETIME2(3)  NULL,
        extra_json NVARCHAR(MAX) NULL,
        CONSTRAINT UQ_conversations_seq UNIQUE (seq),
        CONSTRAINT CK_conversations_extra_json CHECK (extra_json IS NULL OR ISJSON(extra_json) = 1)
    );
END
GO

IF OBJECT_ID(N'dbo.conversation_messages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.conversation_messages (
        id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_conversation_messages PRIMARY KEY,
        conversation_id NVARCHAR(50)  NOT NULL,
        sort_order      INT           NOT NULL,
        role            VARCHAR(20)   NOT NULL,
        content         NVARCHAR(MAX) NOT NULL,
        sent_at         DATETIME2(3)  NULL,
        extra_json      NVARCHAR(MAX) NULL,
        CONSTRAINT FK_cm_conversation FOREIGN KEY (conversation_id)
            REFERENCES dbo.conversations (id) ON DELETE CASCADE,
        CONSTRAINT CK_cm_extra_json CHECK (extra_json IS NULL OR ISJSON(extra_json) = 1)
    );
    CREATE INDEX IX_cm_conversation ON dbo.conversation_messages (conversation_id, sort_order);
END
GO

IF OBJECT_ID(N'dbo.ai_reports', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ai_reports (
        id                    NVARCHAR(50)  NOT NULL CONSTRAINT PK_ai_reports PRIMARY KEY,
        seq                   INT IDENTITY(1,1) NOT NULL,
        report_type           VARCHAR(30)   NULL,
        content               NVARCHAR(MAX) NULL,
        scenario_details_json NVARCHAR(MAX) NULL,
        created_at            DATETIME2(3)  NULL,
        extra_json            NVARCHAR(MAX) NULL,
        CONSTRAINT UQ_ai_reports_seq UNIQUE (seq),
        CONSTRAINT CK_ai_reports_scenario_json CHECK (scenario_details_json IS NULL OR ISJSON(scenario_details_json) = 1),
        CONSTRAINT CK_ai_reports_extra_json CHECK (extra_json IS NULL OR ISJSON(extra_json) = 1)
    );
END
GO

/* ============================================================================
   PART 2 - API access log table (one row per /api request, written by the server)
   ============================================================================ */

USE CashFlowDB;
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

/* ============================================================================
   PART 3 - demo data
   One batch, one transaction: either everything is inserted or nothing is.
   Month k = months from the current month (k = 0 is this month).
   ============================================================================ */

USE CashFlowDB;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @reset BIT = ISNULL(CONVERT(BIT, SESSION_CONTEXT(N'cf_reset_demo_data')), 0);

IF EXISTS (SELECT 1 FROM dbo.cash_flow_months) OR EXISTS (SELECT 1 FROM dbo.installments)
   OR EXISTS (SELECT 1 FROM dbo.investments) OR EXISTS (SELECT 1 FROM dbo.financial_goals)
   OR EXISTS (SELECT 1 FROM dbo.conversations) OR EXISTS (SELECT 1 FROM dbo.ai_reports)
   OR EXISTS (SELECT 1 FROM dbo.budget_settings) OR EXISTS (SELECT 1 FROM dbo.cash_flow_defaults)
BEGIN
    IF @reset = 0
    BEGIN
        PRINT N'The app tables already contain data - demo data was NOT inserted.';
        PRINT N'To replace everything with the demo, set cf_reset_demo_data to 1 at the top of the script and run it again.';
        RETURN;
    END
END

BEGIN TRANSACTION;

IF @reset = 1
BEGIN
    -- child tables first (most of them cascade anyway)
    DELETE FROM dbo.conversation_messages;
    DELETE FROM dbo.conversations;
    DELETE FROM dbo.ai_reports;
    DELETE FROM dbo.financial_goals;
    DELETE FROM dbo.investment_simulation_rules;
    DELETE FROM dbo.investment_snapshots;
    DELETE FROM dbo.investment_transactions;
    DELETE FROM dbo.investments;
    DELETE FROM dbo.installment_payments;
    DELETE FROM dbo.installment_milestone_payments;
    DELETE FROM dbo.installment_milestones;
    DELETE FROM dbo.installment_loan_payments;
    DELETE FROM dbo.installment_loan_components;
    DELETE FROM dbo.installments;
    DELETE FROM dbo.cash_flow_items;
    DELETE FROM dbo.cash_flow_months;
    DELETE FROM dbo.cash_flow_default_items;
    DELETE FROM dbo.cash_flow_defaults;
    DELETE FROM dbo.budget_settings;
    PRINT N'Existing app data deleted (reset).';
END

/* ---------------------------------------------------------------- calendar */
DECLARE @m0  DATE         = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);  -- first day of the current month
DECLARE @now DATETIME2(3) = SYSDATETIME();

-- k = -36 .. +36 (used for payment histories that start before the cash flow window)
DECLARE @n TABLE (k INT PRIMARY KEY, month_date DATE NOT NULL, ym CHAR(7) NOT NULL);
INSERT INTO @n (k, month_date, ym)
SELECT x.k, DATEADD(MONTH, x.k, @m0), CONVERT(CHAR(7), DATEADD(MONTH, x.k, @m0), 126)
FROM (SELECT TOP (73) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 37 AS k FROM sys.all_objects) AS x;

-- the cash flow table: 12 months back, the current month and 11 ahead
DECLARE @months TABLE (k INT PRIMARY KEY, month_date DATE NOT NULL, ym CHAR(7) NOT NULL, mon INT NOT NULL);
INSERT INTO @months (k, month_date, ym, mon)
SELECT k, month_date, ym, MONTH(month_date) FROM @n WHERE k BETWEEN -12 AND 11;

/* ---------------------------------------------------------------- fixed ids (uuid v4) */
DECLARE @instWasher  NVARCHAR(50) = N'a3e1c9d2-7b4f-4e8a-9c1d-2f3b4a5c6d01';
DECLARE @instTv      NVARCHAR(50) = N'a3e1c9d2-7b4f-4e8a-9c1d-2f3b4a5c6d02';
DECLARE @instSofa    NVARCHAR(50) = N'a3e1c9d2-7b4f-4e8a-9c1d-2f3b4a5c6d03';
DECLARE @instCar     NVARCHAR(50) = N'a3e1c9d2-7b4f-4e8a-9c1d-2f3b4a5c6d04';
DECLARE @instKitchen NVARCHAR(50) = N'a3e1c9d2-7b4f-4e8a-9c1d-2f3b4a5c6d05';
DECLARE @loanBank    NVARCHAR(50) = N'b7d2e4f1-3c5a-4b6d-8e7f-9a0b1c2d3e01';
DECLARE @loanFund    NVARCHAR(50) = N'b7d2e4f1-3c5a-4b6d-8e7f-9a0b1c2d3e02';
DECLARE @msSign      NVARCHAR(50) = N'c4f8a2b6-5d7e-4f9a-a1b2-c3d4e5f6a701';
DECLARE @msFrame     NVARCHAR(50) = N'c4f8a2b6-5d7e-4f9a-a1b2-c3d4e5f6a702';
DECLARE @msDelivery  NVARCHAR(50) = N'c4f8a2b6-5d7e-4f9a-a1b2-c3d4e5f6a703';
DECLARE @invPension  NVARCHAR(50) = N'd9b3c7e5-1f2a-4c3b-9d4e-5f6a7b8c9d01';
DECLARE @invStudy    NVARCHAR(50) = N'd9b3c7e5-1f2a-4c3b-9d4e-5f6a7b8c9d02';
DECLARE @invStocks   NVARCHAR(50) = N'd9b3c7e5-1f2a-4c3b-9d4e-5f6a7b8c9d03';
DECLARE @invDeposit  NVARCHAR(50) = N'd9b3c7e5-1f2a-4c3b-9d4e-5f6a7b8c9d04';
DECLARE @goalLaptop  NVARCHAR(50) = N'e2a6d8c4-9b1f-4a3e-b5c7-d9e1f3a5b701';
DECLARE @goalSki     NVARCHAR(50) = N'e2a6d8c4-9b1f-4a3e-b5c7-d9e1f3a5b702';
DECLARE @goalCar     NVARCHAR(50) = N'e2a6d8c4-9b1f-4a3e-b5c7-d9e1f3a5b703';
DECLARE @goalDegree  NVARCHAR(50) = N'e2a6d8c4-9b1f-4a3e-b5c7-d9e1f3a5b704';
DECLARE @goalFridge  NVARCHAR(50) = N'e2a6d8c4-9b1f-4a3e-b5c7-d9e1f3a5b705';
DECLARE @convBudget  NVARCHAR(50) = N'f5c9e3a7-2d4b-4e6f-8a1c-3e5a7c9e1b01';
DECLARE @convCar     NVARCHAR(50) = N'f5c9e3a7-2d4b-4e6f-8a1c-3e5a7c9e1b02';
DECLARE @repInsights NVARCHAR(50) = N'1b8f4d6a-7e9c-4b2d-9f4a-6c8e0a2c4e01';
DECLARE @repScenario NVARCHAR(50) = N'1b8f4d6a-7e9c-4b2d-9f4a-6c8e0a2c4e02';

/* month strings used below */
DECLARE @ymM20 CHAR(7) = (SELECT ym FROM @n WHERE k = -20);
DECLARE @ymM14 CHAR(7) = (SELECT ym FROM @n WHERE k = -14);
DECLARE @ymM10 CHAR(7) = (SELECT ym FROM @n WHERE k = -10);
DECLARE @ymM8  CHAR(7) = (SELECT ym FROM @n WHERE k = -8);
DECLARE @ymM7  CHAR(7) = (SELECT ym FROM @n WHERE k = -7);
DECLARE @ymM4  CHAR(7) = (SELECT ym FROM @n WHERE k = -4);
DECLARE @ymM3  CHAR(7) = (SELECT ym FROM @n WHERE k = -3);
DECLARE @ymM1  CHAR(7) = (SELECT ym FROM @n WHERE k = -1);
DECLARE @ymP2  CHAR(7) = (SELECT ym FROM @n WHERE k = 2);
DECLARE @ymP4  CHAR(7) = (SELECT ym FROM @n WHERE k = 4);
DECLARE @ymP5  CHAR(7) = (SELECT ym FROM @n WHERE k = 5);
DECLARE @ymP6  CHAR(7) = (SELECT ym FROM @n WHERE k = 6);
DECLARE @ymP7  CHAR(7) = (SELECT ym FROM @n WHERE k = 7);
DECLARE @ymP9  CHAR(7) = (SELECT ym FROM @n WHERE k = 9);
DECLARE @ymP11 CHAR(7) = (SELECT ym FROM @n WHERE k = 11);

/* ============================================================================
   Installments
   ============================================================================ */
INSERT INTO dbo.installments
    (id, name, total_amount, down_payment, monthly_payment, installments_count, start_date, color, notes,
     manual_paid_count, last_manual_payment_date, payment_type, linked_goal_id)
VALUES
    (@instWasher, N'מכונת כביסה ומייבש', 4320, 0, 360, 12, @ymM14 + '-01', N'#06b6d4',
     N'12 תשלומים ללא ריבית בכרטיס האשראי - הסתיים', 12, @ymM3 + '-10', 'manual', NULL),
    (@instTv, N'טלוויזיה 65 אינץ ומערכת קולנוע', 5400, 0, 450, 12, @ymM7 + '-01', N'#f59e0b',
     N'פריסה בכרטיס אשראי, ללא ריבית', 7, @ymM1 + '-10', 'manual', NULL),
    (@instSofa, N'ספה ופינת אוכל', 9600, 0, 800, 12, @ymM4 + '-01', N'#8b5cf6',
     N'12 תשלומים דרך חנות הרהיטים', 4, @ymM1 + '-10', 'manual', NULL),
    (@instCar, N'רכב משפחתי - טויוטה קורולה היברידית', 143000, 38000, 2173, 60, @ymM20 + '-01', N'#3b82f6',
     N'מקדמה מחיסכון, יתרה בשתי הלוואות. הלוואת הקרן תיסגר מוקדם.', 0, NULL, 'loan', NULL),
    (@instKitchen, N'שיפוץ מטבח', 72000, 0, 0, 0, @ymM1 + '-01', N'#ec4899',
     N'קבלן שיפוצים - תשלום לפי שלבי עבודה', 0, NULL, 'milestone', NULL);

-- manual payment history (one payment a month, on the 10th)
INSERT INTO dbo.installment_payments (installment_id, sort_order, payment_date, amount)
SELECT i.id, ROW_NUMBER() OVER (PARTITION BY i.id ORDER BY n.k), CONVERT(CHAR(10), DATEADD(DAY, 9, n.month_date), 126), i.amount
FROM (VALUES (@instWasher, -14, -3, 360), (@instTv, -7, -1, 450), (@instSofa, -4, -1, 800)) AS i(id, from_k, to_k, amount)
JOIN @n AS n ON n.k BETWEEN i.from_k AND i.to_k;

-- the car loans
INSERT INTO dbo.installment_loan_components
    (installment_id, component_no, component_id, description, total_loan_amount, monthly_payment, installments_count,
     start_date, paid_count, last_paid_date, interest_rate, payoff_date, payoff_amount, payments_tracked)
VALUES
    (@instCar, 1, @loanBank, N'הלוואת רכב מהבנק', 90000, 1736, 60, @ymM20 + '-01', 20, @ymM1 + '-01', 5.9, NULL, NULL, 1),
    (@instCar, 2, @loanFund, N'הלוואה מקרן ההשתלמות', 15000, 437, 36, @ymM10 + '-01', 10, @ymM1 + '-01', 3.2, @ymP6, 6950, 1);

INSERT INTO dbo.installment_loan_payments (installment_id, component_no, sort_order, payment_date, amount)
SELECT @instCar, l.component_no, ROW_NUMBER() OVER (PARTITION BY l.component_no ORDER BY n.k), CONVERT(CHAR(10), n.month_date, 126), l.amount
FROM (VALUES (1, -20, 1736), (2, -10, 437)) AS l(component_no, from_k, amount)
JOIN @n AS n ON n.k BETWEEN l.from_k AND -1;

-- the kitchen: 20% on signing (paid), 40% after the frame, 40% on delivery
INSERT INTO dbo.installment_milestones (installment_id, sort_order, milestone_id, description, percentage, amount, milestone_date)
VALUES
    (@instKitchen, 1, @msSign,     N'חתימה על חוזה - מקדמה',          20, 14400, @ymM1),
    (@instKitchen, 2, @msFrame,    N'סיום שלד, חשמל ואינסטלציה',      40, 28800, @ymP2),
    (@instKitchen, 3, @msDelivery, N'התקנת ארונות, משטח ומסירה',      40, 28800, @ymP5);

INSERT INTO dbo.installment_milestone_payments (installment_id, sort_order, payment_date, amount, milestone_id, description)
VALUES (@instKitchen, 1, @ymM1 + '-15', 14400, @msSign, N'חתימה על חוזה - מקדמה');

/* ============================================================================
   Cash flow items (built per month, numbered when inserted)
   ============================================================================ */
CREATE TABLE #items (
    k            INT           NOT NULL,
    kind         VARCHAR(20)   NOT NULL,
    seq          INT           NOT NULL,
    description  NVARCHAR(500) NOT NULL,
    amount       DECIMAL(18,2) NOT NULL,
    category     VARCHAR(30)   NULL,
    goal_related BIT           NULL,
    goal_id      NVARCHAR(50)  NULL
);

-- additional incomes
INSERT INTO #items (k, kind, seq, description, amount, category)
SELECT m.k, 'additionalIncome', v.seq, v.description, v.amount, NULL
FROM @months AS m
CROSS APPLY (VALUES
    (1, N'קצבת ילדים',             382),
    (2, N'פרויקט פרילנס - עיצוב אתר', CASE WHEN (m.k + 13) % 3 = 0 THEN 1800 + ((m.k + 13) % 4) * 600 ELSE 0 END),
    (3, N'בונוס שנתי',              CASE WHEN m.mon = 3 THEN 11500 ELSE 0 END),
    (4, N'החזר מס הכנסה',           CASE WHEN m.mon = 6 AND m.k < 0 THEN 3900 ELSE 0 END),
    (5, N'מכירת אופניים ביד שנייה', CASE WHEN m.k = -5 THEN 1200 ELSE 0 END)
) AS v(seq, description, amount)
WHERE v.amount > 0;

-- regular (monthly) expenses; the small modulo terms make every month a bit different
INSERT INTO #items (k, kind, seq, description, amount, category)
SELECT m.k, 'regular', v.seq, v.description, v.amount, v.category
FROM @months AS m
CROSS APPLY (VALUES
    ( 1, N'סופרמרקט',                 'FOOD',          2950 + ((m.k + 13) * 7 % 9) * 85),
    ( 2, N'שוק, ירקות ומאפייה',        'FOOD',           380 + ((m.k + 13) * 5 % 7) * 25),
    ( 3, N'מסעדות ובתי קפה',           'DINING_OUT',     520 + ((m.k + 13) * 3 % 8) * 55),
    ( 4, N'דלק',                       'CAR',            760 + ((m.k + 13) * 4 % 6) * 40),
    ( 5, N'חניה וכבישי אגרה',          'CAR',            140 + ((m.k + 13) % 3) * 30),
    ( 6, N'ארנונה',                    'HOME',           790),
    ( 7, N'חשמל',                      'HOME',           CASE WHEN m.mon % 2 = 1 THEN 480 + ((m.k + 13) % 4) * 70 ELSE 0 END),
    ( 8, N'מים',                       'HOME',           CASE WHEN m.mon % 2 = 0 THEN 210 ELSE 0 END),
    ( 9, N'אינטרנט וסלולר',            'HOME',           265),
    (10, N'גן ילדים',                  'EDUCATION',      CASE WHEN m.mon IN (7, 8) THEN 0 ELSE 3150 END),
    (11, N'קייטנת קיץ',                'EDUCATION',      CASE WHEN m.mon IN (7, 8) THEN 2400 ELSE 0 END),
    (12, N'חוג שחייה',                 'EDUCATION',      320),
    (13, N'ביטוח בריאות משלים',        'HEALTH',         410),
    (14, N'חדר כושר',                  'HEALTH',         249),
    (15, N'נטפליקס וספוטיפיי',          'ENTERTAINMENT',   95),
    (16, N'בילויים וסרטים',             'ENTERTAINMENT',  250 + ((m.k + 13) * 2 % 7) * 45),
    (17, N'ביגוד והנעלה',              'SHOPPING',       380 + ((m.k + 13) * 6 % 9) * 70),
    (18, N'הפקדה חודשית לתיק מניות',   'INVESTMENTS',   1000)
) AS v(seq, description, category, amount)
WHERE v.amount > 0;

-- special (one-off) expenses
INSERT INTO #items (k, kind, seq, description, amount, category)
SELECT v.k, 'special', v.seq, v.description, v.amount, v.category
FROM (VALUES
    (-11, 1, N'ביטוח רכב שנתי (חובה ומקיף)',  'CAR',              4650),
    (-10, 1, N'טיפול שיניים',                 'HEALTH',           2800),
    ( -9, 1, N'מתנה לחתונה של חברים',         'GIFTS',            1200),
    ( -8, 1, N'מקרר חדש',                     'APPLIANCES',       5900),
    ( -6, 1, N'חופשה משפחתית באילת',          'VACATION',         6400),
    ( -5, 1, N'טיפול 30,000 ק"מ ברכב',        'CAR',              1850),
    ( -4, 1, N'מתנות ליום הולדת',              'GIFTS',             650),
    ( -3, 1, N'קורס מקצועי - ניהול מוצר',      'EDUCATION',        2900),
    ( -2, 1, N'חופשה משפחתית ביוון',          'VACATION',        11800),
    ( -2, 2, N'ארוחות וטיולים בחופשה',         'DINING_OUT',       1350),
    ( -1, 1, N'ייעוץ משכנתא ומיחזור',          'PROFESSIONAL',     1500),
    (  0, 1, N'מזגן לחדר הילדים',              'APPLIANCES',       3400),
    (  1, 1, N'ביטוח רכב שנתי (חובה ומקיף)',  'CAR',              4800),
    (  3, 1, N'מסיבת יום הולדת 40',            'ENTERTAINMENT',    7500),
    (  4, 1, N'טסט ורישוי שנתי',               'CAR',              1450),
    (  7, 1, N'דוד שמש חדש',                  'HOME_IMPROVEMENT', 4200),
    (  8, 1, N'מתנות לחגים למשפחה',            'GIFTS',            1100),
    (  9, 1, N'שולחן וכיסא לחדר עבודה',        'FURNITURE',        3800),
    ( 10, 1, N'טיפול שיניים',                 'HEALTH',           3100)
) AS v(k, seq, description, category, amount);

/* ============================================================================
   Monthly totals - same rules as the client (cash-flow-table + installment.service):
     loanPayment         = manual loan part + car loans (payoff month = payoff amount, nothing after it)
     installmentsPayment = fixed-payment installments in their months + unpaid milestones of the month
     ending              = starting + income + additional incomes - all expenses; next starting = this ending
   ============================================================================ */
DECLARE @openingBalance DECIMAL(18,2) = 72000;

CREATE TABLE #m (
    k                    INT PRIMARY KEY,
    month_date           DATE          NOT NULL,
    income               DECIMAL(18,2) NOT NULL,
    mortgage_payment     DECIMAL(18,2) NOT NULL,
    manual_loan_payment  DECIMAL(18,2) NOT NULL,
    loans                DECIMAL(18,2) NOT NULL,
    installments_payment DECIMAL(18,2) NOT NULL,
    items_net            DECIMAL(18,2) NOT NULL,
    net                  DECIMAL(18,2) NULL,
    starting_balance     DECIMAL(18,2) NULL,
    ending_balance       DECIMAL(18,2) NULL
);

INSERT INTO #m (k, month_date, income, mortgage_payment, manual_loan_payment, loans, installments_payment, items_net)
SELECT
    m.k,
    m.month_date,
    CASE WHEN m.k < -3 THEN 26400 ELSE 27600 END,          -- two salaries, a raise 3 months ago
    5380 + (m.k + 12) * 6,                                  -- CPI-linked mortgage creeping up
    CASE WHEN m.k <= 2 THEN 600 ELSE 0 END,                 -- paying back a loan from the parents (manual)
    ISNULL((
        SELECT SUM(x.amount)
        FROM dbo.installment_loan_components AS c
        JOIN dbo.installments AS i ON i.id = c.installment_id AND i.payment_type = 'loan'
        CROSS APPLY (SELECT
            CASE
                WHEN c.payoff_date IS NOT NULL AND m.month_date = DATEFROMPARTS(LEFT(c.payoff_date, 4), SUBSTRING(c.payoff_date, 6, 2), 1)
                    THEN ISNULL(c.payoff_amount, 0)
                WHEN c.payoff_date IS NOT NULL AND m.month_date > DATEFROMPARTS(LEFT(c.payoff_date, 4), SUBSTRING(c.payoff_date, 6, 2), 1)
                    THEN 0
                WHEN m.month_date >= DATEFROMPARTS(LEFT(c.start_date, 4), SUBSTRING(c.start_date, 6, 2), 1)
                 AND m.month_date <  DATEADD(MONTH, c.installments_count, DATEFROMPARTS(LEFT(c.start_date, 4), SUBSTRING(c.start_date, 6, 2), 1))
                    THEN c.monthly_payment
                ELSE 0
            END AS amount) AS x
    ), 0),
    ISNULL((
        SELECT SUM(i.monthly_payment)
        FROM dbo.installments AS i
        WHERE i.payment_type <> 'loan'
          AND NOT EXISTS (SELECT 1 FROM dbo.installment_loan_components AS c WHERE c.installment_id = i.id)
          AND m.month_date >= DATEFROMPARTS(LEFT(i.start_date, 4), SUBSTRING(i.start_date, 6, 2), 1)
          AND m.month_date <  DATEADD(MONTH, i.installments_count, DATEFROMPARTS(LEFT(i.start_date, 4), SUBSTRING(i.start_date, 6, 2), 1))
    ), 0)
    + ISNULL((
        SELECT SUM(ms.amount)
        FROM dbo.installment_milestones AS ms
        JOIN dbo.installments AS i ON i.id = ms.installment_id AND i.payment_type = 'milestone'
        WHERE ms.milestone_date = m.ym
          AND NOT EXISTS (SELECT 1 FROM dbo.installment_milestone_payments AS p
                          WHERE p.installment_id = ms.installment_id AND p.milestone_id = ms.milestone_id
                            AND CONVERT(DATE, CASE WHEN LEN(p.payment_date) = 7 THEN p.payment_date + '-01' ELSE p.payment_date END) <= m.month_date)
    ), 0),
    ISNULL((SELECT SUM(CASE WHEN it.kind = 'additionalIncome' THEN it.amount ELSE -it.amount END) FROM #items AS it WHERE it.k = m.k), 0)
FROM @months AS m;

UPDATE #m SET net = income + items_net - mortgage_payment - manual_loan_payment - loans - installments_payment;

WITH running AS (
    SELECT k, net, @openingBalance + SUM(net) OVER (ORDER BY k ROWS UNBOUNDED PRECEDING) AS ending
    FROM #m
)
UPDATE t SET ending_balance = r.ending, starting_balance = r.ending - r.net
FROM #m AS t JOIN running AS r ON r.k = t.k;

/* ---------------------------------------------------------------- cash flow months + items */
INSERT INTO dbo.cash_flow_months
    (sort_order, month_date, starting_balance, income, mortgage_payment, loan_payment, manual_loan_payment,
     installments_payment, ending_balance, savings, row_color)
SELECT
    k + 13,
    month_date,
    starting_balance,
    income,
    mortgage_payment,
    manual_loan_payment + loans,
    manual_loan_payment,
    installments_payment,
    ending_balance,
    NULL,
    CASE
        WHEN k < 0 THEN N'#dcfce7'                    -- past months: closed (green)
        WHEN net < -10000 THEN N'#fee2e2'              -- a heavy month (balance drops by more than 10,000): red
        WHEN net < 0 THEN N'#fef9c3'                   -- the month ends in deficit: yellow
        ELSE NULL
    END
FROM #m;

INSERT INTO dbo.cash_flow_items (month_id, kind, sort_order, description, amount, category, goal_related, goal_id)
SELECT cfm.id, it.kind, ROW_NUMBER() OVER (PARTITION BY it.k, it.kind ORDER BY it.seq),
       it.description, it.amount, it.category, it.goal_related, it.goal_id
FROM #items AS it
JOIN dbo.cash_flow_months AS cfm ON cfm.sort_order = it.k + 13;

/* ---------------------------------------------------------------- template for new months */
INSERT INTO dbo.cash_flow_defaults (id, income, mortgage_payment, loan_payment)
VALUES (1, 27600, 5450, 0);

INSERT INTO dbo.cash_flow_default_items (kind, sort_order, description, amount, category)
VALUES
    ('additionalIncome', 1, N'קצבת ילדים',               382, NULL),
    ('regular',  1, N'סופרמרקט',                   3200, 'FOOD'),
    ('regular',  2, N'שוק, ירקות ומאפייה',          450, 'FOOD'),
    ('regular',  3, N'מסעדות ובתי קפה',             700, 'DINING_OUT'),
    ('regular',  4, N'דלק',                          850, 'CAR'),
    ('regular',  5, N'ארנונה',                       790, 'HOME'),
    ('regular',  6, N'חשמל ומים',                    400, 'HOME'),
    ('regular',  7, N'אינטרנט וסלולר',              265, 'HOME'),
    ('regular',  8, N'גן ילדים',                    3150, 'EDUCATION'),
    ('regular',  9, N'חוג שחייה',                    320, 'EDUCATION'),
    ('regular', 10, N'ביטוח בריאות משלים',          410, 'HEALTH'),
    ('regular', 11, N'חדר כושר',                     249, 'HEALTH'),
    ('regular', 12, N'נטפליקס וספוטיפיי',             95, 'ENTERTAINMENT'),
    ('regular', 13, N'ביגוד והנעלה',                 600, 'SHOPPING'),
    ('regular', 14, N'הפקדה חודשית לתיק מניות',     1000, 'INVESTMENTS');

/* ---------------------------------------------------------------- monthly budget per category */
INSERT INTO dbo.budget_settings (category, sort_order, monthly_limit)
VALUES
    ('FOOD',              1, 3900),
    ('DINING_OUT',        2,  750),
    ('CAR',               3, 1200),
    ('HOME',              4, 1900),
    ('HOME_IMPROVEMENT',  5,  500),
    ('FURNITURE',         6,  300),
    ('APPLIANCES',        7,  300),
    ('VACATION',          8, 1500),
    ('ENTERTAINMENT',     9,  600),
    ('GIFTS',            10,  400),
    ('HEALTH',           11,  800),
    ('PROFESSIONAL',     12,  200),
    ('INVESTMENTS',      13, 1000),
    ('EDUCATION',        14, 3800),
    ('SHOPPING',         15,  900),
    ('OTHER',            16,  300);

/* ============================================================================
   Investments
   ============================================================================ */
INSERT INTO dbo.investments (id, name, investment_type, initial_value, annual_return)
VALUES
    (@invPension, N'קרן פנסיה מקיפה',               'pension', 186500, 5.2),
    (@invStudy,   N'קרן השתלמות - מסלול מניות',      'fund',     64200, 6.1),
    (@invStocks,  N'תיק מניות - מחקה S&P 500',       'stock',    42000, 9.0),
    (@invDeposit, N'פיקדון שקלי בבנק ל-12 חודשים',   'other',     NULL, 4.1);

-- monthly deposits for the last 12 months (+ one withdrawal and a one-time deposit)
INSERT INTO dbo.investment_transactions (investment_id, sort_order, tx_id, tx_date, amount, tx_type)
SELECT t.investment_id, ROW_NUMBER() OVER (PARTITION BY t.investment_id ORDER BY t.tx_date, t.tx_type),
       LOWER(CONVERT(NVARCHAR(50), NEWID())), t.tx_date, t.amount, t.tx_type
FROM (
    SELECT d.investment_id, CONVERT(NVARCHAR(30), CONVERT(CHAR(10), DATEADD(DAY, d.day_no - 1, n.month_date), 126)) AS tx_date,
           CONVERT(DECIMAL(18,2), d.amount) AS amount, CONVERT(VARCHAR(20), 'deposit') AS tx_type
    FROM (VALUES (@invPension, 15, 2380), (@invStudy, 15, 1590), (@invStocks, 2, 1000)) AS d(investment_id, day_no, amount)
    JOIN @n AS n ON n.k BETWEEN -12 AND -1
    UNION ALL
    SELECT @invStocks,  (SELECT ym FROM @n WHERE k = -2) + '-20', 5000,  'withdraw'   -- money for the Greece vacation
    UNION ALL
    SELECT @invDeposit, @ymM8 + '-05',                            30000, 'deposit'
) AS t;

INSERT INTO dbo.investment_snapshots (investment_id, sort_order, snapshot_id, snapshot_date, snapshot_value)
SELECT s.investment_id, ROW_NUMBER() OVER (PARTITION BY s.investment_id ORDER BY s.k),
       LOWER(CONVERT(NVARCHAR(50), NEWID())), CONVERT(CHAR(10), DATEADD(DAY, 27, n.month_date), 126), s.value
FROM (VALUES
    (@invPension, -12, 186500), (@invPension, -9, 194800), (@invPension, -6, 199300),
    (@invPension,  -3, 210600), (@invPension,  0, 218900),
    (@invStudy,   -12,  64200), (@invStudy,   -9,  69400), (@invStudy,   -6,  71800),
    (@invStudy,    -3,  78500), (@invStudy,    0,  83700),
    (@invStocks,  -12,  42000), (@invStocks, -11,  44100), (@invStocks, -10,  45800),
    (@invStocks,   -9,  44300), (@invStocks,  -8,  47900), (@invStocks,  -7,  50600),
    (@invStocks,   -6,  48700), (@invStocks,  -5,  45900), (@invStocks,  -4,  51300),
    (@invStocks,   -3,  54800), (@invStocks,  -2,  50200), (@invStocks,  -1,  52900),
    (@invStocks,    0,  55400),
    (@invDeposit,  -8,  30000), (@invDeposit, -4,  30410), (@invDeposit,  0,  30820)
) AS s(investment_id, k, value)
JOIN @n AS n ON n.k = s.k;

INSERT INTO dbo.investment_simulation_rules
    (investment_id, sort_order, rule_id, from_month, to_month, monthly_amount, one_time_amount, description)
SELECT r.investment_id, r.sort_order, LOWER(CONVERT(NVARCHAR(50), NEWID())), r.from_month, r.to_month, r.monthly_amount, r.one_time_amount, r.description
FROM (VALUES
    (@invPension, 1,  1, 360, 2380,     0, N'הפקדות שוטפות מהמשכורת'),
    (@invStudy,   1,  1,  72, 1590,     0, N'הפקדות שוטפות עד משיכה'),
    (@invStocks,  1,  1, 120, 1000,     0, N'הוראת קבע חודשית'),
    (@invStocks,  2, 12,  12,    0, 10000, N'חצי מהבונוס השנתי'),
    (@invDeposit, 1,  1,  12,    0,     0, N'ללא הפקדות נוספות עד סוף הפיקדון')
) AS r(investment_id, sort_order, from_month, to_month, monthly_amount, one_time_amount, description);

/* ============================================================================
   Financial goals (not part of the cash flow: the goals analyser deducts them on top of it)
   analysis_json stays NULL - "analyze" in the app (or POST /api/goals/analyze-all) fills it.
   ============================================================================ */
INSERT INTO dbo.financial_goals
    (id, name, description, goal_type, target_amount, target_date, priority, completed, is_fixed,
     linked_installment_id, linked_to_special_expense, auto_update_from_cash_flow,
     loan_details_json, schedule_json, analysis_json, last_analyzed, created_date, updated_date, completed_date)
VALUES
    (@goalLaptop, N'מחשב נייד לעבודה', N'מחשב חזק לעבודה מהבית ולפרויקטי הפרילנס', 'PURCHASE', 7500, @ymP2, 1, 0, NULL,
     NULL, NULL, 1, NULL,
     CONCAT(N'{"type":"single","amount":7500,"date":"', @ymP2, N'"}'),
     NULL, NULL, DATEADD(DAY, -40, @now), DATEADD(DAY, -40, @now), NULL),
    (@goalSki, N'חופשת סקי משפחתית', N'שבוע סקי באיטליה לארבעה, כולל טיסות וציוד', 'SAVINGS', 16500, @ymP4, 2, 0, 1,
     NULL, NULL, 1, NULL,
     CONCAT(N'{"type":"single","amount":16500,"date":"', @ymP4, N'"}'),
     NULL, NULL, DATEADD(DAY, -75, @now), DATEADD(DAY, -12, @now), NULL),
    (@goalCar, N'החלפת הרכב השני', N'רכב חשמלי במקום הרכב הישן: מקדמה מהחיסכון והשאר בהלוואה', 'PURCHASE', 145000, @ymP7, 3, 0, NULL,
     NULL, NULL, 1,
     N'{"loanAmount":110000,"downPayment":35000,"monthlyPayment":2150,"months":60,"interestRate":5.5}',
     CONCAT(N'{"type":"loan","date":"', @ymP7, N'","loan":{"loanAmount":110000,"downPayment":35000,"monthlyPayment":2150,"months":60,"interestRate":5.5}}'),
     NULL, NULL, DATEADD(DAY, -30, @now), DATEADD(DAY, -5, @now), NULL),
    (@goalDegree, N'תואר שני במנהל עסקים', N'שכר לימוד בשלושה תשלומים', 'PROJECT', 42000, @ymP11, 4, 0, NULL,
     NULL, NULL, 1, NULL,
     CONCAT(N'{"type":"milestone","milestones":[',
            N'{"id":"', LOWER(CONVERT(NVARCHAR(50), NEWID())), N'","description":"הרשמה וסמסטר ראשון","percentage":40,"amount":16800,"date":"', @ymP6, N'"},',
            N'{"id":"', LOWER(CONVERT(NVARCHAR(50), NEWID())), N'","description":"סמסטר שני","percentage":30,"amount":12600,"date":"', @ymP9, N'"},',
            N'{"id":"', LOWER(CONVERT(NVARCHAR(50), NEWID())), N'","description":"סמסטר שלישי","percentage":30,"amount":12600,"date":"', @ymP11, N'"}]}'),
     NULL, NULL, DATEADD(DAY, -20, @now), DATEADD(DAY, -20, @now), NULL),
    (@goalFridge, N'מקרר חדש', N'החלפת המקרר הישן', 'PURCHASE', 5900, @ymM8, 5, 1, NULL,
     NULL, 1, NULL, NULL,
     CONCAT(N'{"type":"single","amount":5900,"date":"', @ymM8, N'"}'),
     NULL, NULL, DATEADD(MONTH, -11, @now), DATEADD(MONTH, -8, @now), DATEADD(MONTH, -8, @now));

/* ============================================================================
   AI assistant: conversations and saved reports
   ============================================================================ */
DECLARE @nl NCHAR(1) = NCHAR(10);

INSERT INTO dbo.conversations (id, title, created_at, updated_at)
VALUES
    (@convBudget, N'איפה אפשר לחסוך בהוצאות השוטפות?', DATEADD(DAY, -9, @now), DATEADD(DAY, -9, @now)),
    (@convCar,    N'האם לסגור את הלוואת הקרן מוקדם?',  DATEADD(DAY, -3, @now), DATEADD(DAY, -3, @now));

INSERT INTO dbo.conversation_messages (conversation_id, sort_order, role, content, sent_at)
VALUES
    (@convBudget, 1, 'user', N'איפה אני יכול לחסוך בהוצאות השוטפות שלי?', DATEADD(MINUTE, -12960, @now)),
    (@convBudget, 2, 'assistant', CONCAT(
        N'לפי התזרים שלך, שלושה תחומים בולטים:', @nl, @nl,
        N'1. **מזון** - סופרמרקט ושוק יחד עוברים לעתים קרובות את תקציב ה-3,900 ₪. רשימת קניות קבועה והזמנה אונליין פעם בשבוע חוסכות בדרך כלל 300-400 ₪ בחודש.', @nl,
        N'2. **מסעדות ובתי קפה** - חלק מהחודשים מעל 750 ₪. תקרה שבועית קבועה עוזרת לשמור על המסגרת.', @nl,
        N'3. **מנויים** - כדאי לעבור על נטפליקס, ספוטיפיי וחדר הכושר ולוודא שכולם בשימוש.', @nl, @nl,
        N'חיסכון של כ-600 ₪ בחודש מצטבר לכ-7,200 ₪ בשנה - כמעט כל העלות של המחשב הנייד שתכננת.'), DATEADD(MINUTE, -12959, @now)),
    (@convCar, 1, 'user', N'יש לי הלוואה מקרן ההשתלמות בריבית 3.2%. כדאי לסגור אותה מוקדם?', DATEADD(MINUTE, -4320, @now)),
    (@convCar, 2, 'assistant', CONCAT(
        N'סגירה מוקדמת של ההלוואה מהקרן מורידה כ-437 ₪ מההוצאה החודשית, אבל דורשת תשלום חד-פעמי של כ-6,950 ₪.', @nl, @nl,
        N'**לטובת הסגירה:** אחרי החודש הזה ההוצאה החודשית יורדת, וזה מקל על התקופה של תשלומי שיפוץ המטבח.', @nl,
        N'**נגד:** הריבית נמוכה יחסית, ובאותה תקופה מתוכננים גם חופשת הסקי ותשלום התואר. היתרה בחשבון תתקרב לרף הביטחון.', @nl, @nl,
        N'המלצה: לסגור רק אם היתרה אחרי הסגירה נשארת מעל 60,000 ₪, אחרת לדחות בחודשיים-שלושה.'), DATEADD(MINUTE, -4319, @now));

INSERT INTO dbo.ai_reports (id, report_type, content, scenario_details_json, created_at)
VALUES
    (@repInsights, 'insights', CONCAT(N'[',
        N'"**הוצאות מיוחדות** — בשנה האחרונה הוצאות חד-פעמיות (חופשות, מוצרי חשמל, רכב) אכלו את רוב העודף החודשי",',
        N'"**שיפוץ המטבח** — שני תשלומים של 28,800 ₪ בחודשים הקרובים יורידו את היתרה בצורה חדה",',
        N'"**מזון ומסעדות** — חריגה חוזרת מהתקציב, בממוצע כמה מאות שקלים בחודש",',
        N'"**השקעות** — הפקדה קבועה של 1,000 ₪ לתיק המניות נשמרת גם בחודשים עמוסים, וזה יתרון"',
        N']'), NULL, DATEADD(DAY, -6, @now)),
    (@repScenario, 'scenario', CONCAT(
        N'**תרחיש: רכישת רכב שני במקדמה של 35,000 ₪**', @nl, @nl,
        N'אם המקדמה תשולם בחודש היעד, היתרה בחשבון תרד אל מתחת לרף הביטחון לכמה חודשים, בעיקר בגלל החפיפה עם תשלומי השיפוץ ושכר הלימוד.', @nl, @nl,
        N'כדי לשמור על מרווח ביטחון כדאי לדחות את הרכישה בשלושה חודשים, או להקטין את המקדמה ל-20,000 ₪ ולהגדיל מעט את ההלוואה.'),
     CONCAT(N'{"description":"רכישת רכב שני","amount":35000,"date":"', @ymP7, N'"}'), DATEADD(DAY, -2, @now));

DROP TABLE #items;
DROP TABLE #m;

COMMIT TRANSACTION;

PRINT N'Demo data inserted.';
GO

/* ---------------------------------------------------------------- what is in the database now */
SELECT t.table_name, t.row_count
FROM (VALUES
    (N'cash_flow_months',               (SELECT COUNT(*) FROM dbo.cash_flow_months)),
    (N'cash_flow_items',                (SELECT COUNT(*) FROM dbo.cash_flow_items)),
    (N'cash_flow_defaults',             (SELECT COUNT(*) FROM dbo.cash_flow_defaults)),
    (N'cash_flow_default_items',        (SELECT COUNT(*) FROM dbo.cash_flow_default_items)),
    (N'budget_settings',                (SELECT COUNT(*) FROM dbo.budget_settings)),
    (N'installments',                   (SELECT COUNT(*) FROM dbo.installments)),
    (N'installment_loan_components',    (SELECT COUNT(*) FROM dbo.installment_loan_components)),
    (N'installment_loan_payments',      (SELECT COUNT(*) FROM dbo.installment_loan_payments)),
    (N'installment_milestones',         (SELECT COUNT(*) FROM dbo.installment_milestones)),
    (N'installment_milestone_payments', (SELECT COUNT(*) FROM dbo.installment_milestone_payments)),
    (N'installment_payments',           (SELECT COUNT(*) FROM dbo.installment_payments)),
    (N'investments',                    (SELECT COUNT(*) FROM dbo.investments)),
    (N'investment_transactions',        (SELECT COUNT(*) FROM dbo.investment_transactions)),
    (N'investment_snapshots',           (SELECT COUNT(*) FROM dbo.investment_snapshots)),
    (N'investment_simulation_rules',    (SELECT COUNT(*) FROM dbo.investment_simulation_rules)),
    (N'financial_goals',                (SELECT COUNT(*) FROM dbo.financial_goals)),
    (N'conversations',                  (SELECT COUNT(*) FROM dbo.conversations)),
    (N'conversation_messages',          (SELECT COUNT(*) FROM dbo.conversation_messages)),
    (N'ai_reports',                     (SELECT COUNT(*) FROM dbo.ai_reports))
) AS t(table_name, row_count);

SELECT CONVERT(CHAR(7), month_date, 126) AS month, starting_balance, income, mortgage_payment, loan_payment,
       installments_payment, ending_balance, row_color
FROM dbo.cash_flow_months
ORDER BY sort_order;
GO
