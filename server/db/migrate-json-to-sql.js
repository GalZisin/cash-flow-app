/**
 * One-time import of the old JSON files (server/data/*.json) into SQL Server.
 *
 *   npm run db:migrate            -> imports only tables that are still empty
 *   npm run db:migrate -- --force -> replaces the content of every table with the JSON files
 *
 * Run db/schema.sql first and set DB_CONNECTION_STRING in server/.env.
 * The JSON files are only read, never changed or deleted.
 */
const fs = require('fs');
const path = require('path');

const { getPool, closePool } = require('./connection');
const { rows } = require('./helpers');

const cashFlowRepository = require('../repositories/cashFlow.repository');
const budgetRepository = require('../repositories/budget.repository');
const installmentsRepository = require('../repositories/installments.repository');
const investmentsRepository = require('../repositories/investments.repository');
const goalsRepository = require('../repositories/goals.repository');
const conversationsRepository = require('../repositories/conversations.repository');
const aiReportsRepository = require('../repositories/aiReports.repository');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FORCE = process.argv.includes('--force');

function readJson(fileName) {
    const file = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function count(pool, table) {
    const result = await rows(pool, `SELECT COUNT(*) AS n FROM ${table}`);
    return result[0].n;
}

const steps = [
    {
        name: 'cash flow months',
        file: 'cash-flow-data-miluim.json',
        table: 'dbo.cash_flow_months',
        size: (data) => (data.months || []).length,
        run: (data) => cashFlowRepository.write(data)
    },
    {
        name: 'cash flow defaults',
        file: 'cash-flow-defaults.json',
        table: 'dbo.cash_flow_defaults',
        size: () => 1,
        run: (data) => cashFlowRepository.writeDefaults(data)
    },
    {
        name: 'budget settings',
        file: 'budget-settings.json',
        table: 'dbo.budget_settings',
        size: (data) => Object.keys(data).length,
        run: (data) => budgetRepository.writeSettings(data)
    },
    {
        name: 'installments',
        file: 'installments.json',
        table: 'dbo.installments',
        size: (data) => data.length,
        run: (data) => installmentsRepository.replaceAll(data)
    },
    {
        name: 'investments',
        file: 'investments.json',
        table: 'dbo.investments',
        size: (data) => data.length,
        run: (data) => investmentsRepository.replaceAll(data)
    },
    {
        name: 'financial goals',
        file: 'financial-goals.json',
        table: 'dbo.financial_goals',
        size: (data) => (data.goals || []).length,
        run: (data) => goalsRepository.write(data.goals || [])
    },
    {
        name: 'conversations',
        file: 'conversations.json',
        table: 'dbo.conversations',
        size: (data) => data.length,
        run: (data) => conversationsRepository.writeAll(data)
    },
    {
        name: 'AI reports',
        file: 'ai-reports.json',
        table: 'dbo.ai_reports',
        size: (data) => data.length,
        run: (data) => aiReportsRepository.writeAll(data)
    }
];

async function main() {
    const pool = await getPool();
    console.log(`Importing JSON files from ${DATA_DIR}${FORCE ? ' (--force: existing rows will be replaced)' : ''}\n`);

    for (const step of steps) {
        const data = readJson(step.file);
        if (data === null) {
            console.log(`- ${step.name}: ${step.file} not found, skipped`);
            continue;
        }

        const existing = await count(pool, step.table);
        if (existing > 0 && !FORCE) {
            console.log(`- ${step.name}: table already has data, skipped (use --force to replace)`);
            continue;
        }

        const expected = step.size(data);
        if (expected === 0) {
            console.log(`- ${step.name}: ${step.file} is empty, nothing to import`);
            continue;
        }

        await step.run(data);
        console.log(`✓ ${step.name}: imported ${expected} from ${step.file}`);
    }

    console.log('\nRow counts now in the database:');
    for (const table of [
        'cash_flow_months', 'cash_flow_items', 'cash_flow_default_items', 'budget_settings', 'installments',
        'installment_loan_components', 'installment_milestones', 'investments', 'investment_transactions',
        'investment_snapshots', 'financial_goals', 'conversations', 'conversation_messages', 'ai_reports'
    ]) {
        console.log(`  ${table.padEnd(30)} ${await count(pool, `dbo.${table}`)}`);
    }
}

main()
    .catch((err) => {
        console.error('\nImport failed:', err.message);
        process.exitCode = 1;
    })
    .finally(() => closePool());
