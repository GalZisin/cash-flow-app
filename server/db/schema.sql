/* ============================================================================
   Cash Flow App - database schema for Microsoft SQL Server
   Database name : CashFlowDB
   Run it        : SSMS / Azure Data Studio (Execute), or
                   sqlcmd -S localhost -E -i schema.sql
   Re-runnable   : every object is created only if it does not exist yet.

   Notes
   - Text columns are NVARCHAR so Hebrew is stored correctly.
   - Money columns are DECIMAL(18,2).
   - Date-like strings the app uses as plain text ("2026-09-01" or "2026-09")
     are kept as NVARCHAR(30), exactly as the app writes them.
   - extra_json keeps any field the app adds in the future, so nothing is lost.
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
