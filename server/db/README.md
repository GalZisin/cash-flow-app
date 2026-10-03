# Database (SQL Server)

The server stores everything in a Microsoft SQL Server database named **`CashFlowDB`**
(it used to write JSON files into `server/data/`). The REST API did not change, so the Angular
app works as before.

## 1. Create the database and tables

Run `db/schema.sql` on your SQL Server (SSMS / Azure Data Studio → Execute), or:

```
sqlcmd -S localhost -E -i db\schema.sql
```

It creates the database `CashFlowDB` and all tables. It is safe to run again - objects are only
created when missing.

Optional: `db/create-app-user.sql` creates a dedicated login `cashflow_app` (change the password in
the file first) so the server does not need to use `sa`.

## 2. Configure the connection

```
copy .env.example .env
```

Edit `server/.env` and set `DB_CONNECTION_STRING`, for example:

```
DB_CONNECTION_STRING=Server=localhost,1433;Database=CashFlowDB;User Id=cashflow_app;Password=YOUR_PASSWORD;Encrypt=true;TrustServerCertificate=true
```

Other forms (named instance, Windows Authentication) are in `.env.example`.
If you connect by TCP port (`localhost,1433`), TCP/IP must be enabled for the instance in
*SQL Server Configuration Manager* (it is often off on SQL Server Express).

## 3. Install and import the existing data (once)

```
npm install
npm run db:migrate
```

`db:migrate` reads the old `server/data/*.json` files (it never changes them) and fills the tables.
Tables that already contain data are skipped; use `npm run db:migrate -- --force` to replace them.
The cash flow is imported from `data/cash-flow-data-miluim.json` - the file the server used.

## 4. Run

```
npm start        # or: npm run dev
```

`GET /health` also reports the database status.

## Tables

| Table | Content |
|---|---|
| `cash_flow_months`, `cash_flow_items` | the cash flow table; items are additional incomes / regular / special expenses of a month |
| `cash_flow_defaults`, `cash_flow_default_items` | the template used for new months (single row + items) |
| `budget_settings` | monthly limit per expense category |
| `installments` + `installment_loan_components`, `installment_loan_payments`, `installment_milestones`, `installment_milestone_payments`, `installment_payments` | payment plans, loans, milestones and their payment history |
| `investments` + `investment_transactions`, `investment_snapshots`, `investment_simulation_rules` | pension / funds / stocks |
| `financial_goals` | goals (loan details, schedule and analysis are stored as JSON columns) |
| `conversations`, `conversation_messages` | AI assistant chats |
| `ai_reports` | saved AI reports |

Design notes:

- The same calendar month can appear more than once in the cash flow data, so `cash_flow_months.month_date`
  is **not** unique; `sort_order` keeps the order of the rows.
- Every table that holds app objects has an `extra_json` column that keeps any field the app adds in the
  future, so no data is lost when the app evolves.
- Money is `DECIMAL(18,2)`, so values are stored with 2 decimals (the old JSON had floating-point noise such as
  `262764.4299999998`).
- `cash_flow_months.ending_balance` is stored because the app sends it, but it is derived data
  (start + income − payments − expenses); the app recalculates it.

## Code layout

| File | Purpose |
|---|---|
| `db/connection.js` | one shared connection pool, reads `DB_CONNECTION_STRING` |
| `db/helpers.js`, `db/helpers.pure.js` | typed parameters, transactions, multi-row insert |
| `db/mappers.js` | converts app objects <-> table rows (no database access) |
| `repositories/*.js` | same method names as before, now backed by SQL |
| `db/migrate-json-to-sql.js` | one-time import of the JSON files |
| `db/test-mappers.js` | `npm run test:mappers` - checks the mapping offline against `server/data/*.json` |
