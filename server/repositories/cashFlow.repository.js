const {
    sql, C, SEL, exec, rows, withTransaction, insertMany, getPool
} = require('../db/helpers');
const {
    monthToRow, monthItemRows, assembleMonths, defaultsToRows, assembleDefaults
} = require('../db/mappers');

const MONTH_COLUMNS = [
    C.int('sort_order'), C.date('month_date'), C.money('starting_balance'), C.money('income'),
    C.money('mortgage_payment'), C.money('loan_payment'), C.money('manual_loan_payment'),
    C.money('installments_payment'), C.money('ending_balance'), C.money('savings'),
    C.str('row_color', 20), C.text('extra_json')
];

const ITEM_COLUMNS = [
    C.int('month_id'), C.vchar('kind', 20), C.int('sort_order'), C.str('description', 500), C.money('amount'),
    C.vchar('category', 30), C.bit('goal_related'), C.id('goal_id'), C.text('extra_json')
];

const DEFAULT_HEADER_COLUMNS = [
    { name: 'id', type: sql.TinyInt }, // single-row table (id is always 1)
    C.money('income'), C.money('mortgage_payment'), C.money('loan_payment')
];

const DEFAULT_ITEM_COLUMNS = [
    C.vchar('kind', 20), C.int('sort_order'), C.str('description', 500), C.money('amount'), C.vchar('category', 30)
];

class CashFlowRepository {
    /**
     * Whole cash flow table as { months: [...] } (null when nothing has been saved yet).
     */
    async read() {
        const pool = await getPool();

        const monthRows = await rows(pool, `
            SELECT id, sort_order, ${SEL.date('month_date')}, starting_balance, income, mortgage_payment,
                   loan_payment, manual_loan_payment, installments_payment, ending_balance, savings,
                   row_color, extra_json
            FROM dbo.cash_flow_months
            ORDER BY sort_order`);

        if (!monthRows.length) return null;

        const itemRows = await rows(pool, `
            SELECT month_id, kind, sort_order, description, amount, category, goal_related, goal_id, extra_json
            FROM dbo.cash_flow_items
            ORDER BY month_id, kind, sort_order`);

        return { months: assembleMonths(monthRows, itemRows) };
    }

    /**
     * Replaces the whole cash flow table (same behaviour as overwriting the old JSON file).
     */
    async write(data) {
        const months = Array.isArray(data.months) ? data.months : [];
        const monthRows = months.map(monthToRow); // validates month values before touching the DB

        await withTransaction(async (tx) => {
            // TABLOCKX makes two concurrent saves queue up instead of colliding.
            await exec(tx, 'DELETE FROM dbo.cash_flow_items WITH (TABLOCKX)');
            await exec(tx, 'DELETE FROM dbo.cash_flow_months WITH (TABLOCKX)');

            await insertMany(tx, 'dbo.cash_flow_months', MONTH_COLUMNS, monthRows);

            const ids = await rows(tx, 'SELECT id, sort_order FROM dbo.cash_flow_months');
            const idBySortOrder = new Map(ids.map((r) => [r.sort_order, r.id]));

            const itemRows = [];
            months.forEach((m, index) => {
                const monthId = idBySortOrder.get(index + 1);
                for (const item of monthItemRows(m)) itemRows.push({ ...item, month_id: monthId });
            });
            await insertMany(tx, 'dbo.cash_flow_items', ITEM_COLUMNS, itemRows);
        });
    }

    async readDefaults() {
        const defaultStructure = {
            income: 0,
            mortgagePayment: 0,
            loanPayment: 0,
            additionalIncomes: [],
            regularExpenses: [],
            specialExpenses: []
        };

        const pool = await getPool();
        const header = await rows(pool, `
            SELECT income, mortgage_payment, loan_payment FROM dbo.cash_flow_defaults WHERE id = 1`);
        if (!header.length) return defaultStructure;

        const items = await rows(pool, `
            SELECT kind, sort_order, description, amount, category
            FROM dbo.cash_flow_default_items
            ORDER BY kind, sort_order`);

        return assembleDefaults(header[0], items);
    }

    async writeDefaults(data) {
        const { header, items } = defaultsToRows(data);

        await withTransaction(async (tx) => {
            await exec(tx, 'DELETE FROM dbo.cash_flow_default_items WITH (TABLOCKX)');
            await exec(tx, 'DELETE FROM dbo.cash_flow_defaults WITH (TABLOCKX)');
            await insertMany(tx, 'dbo.cash_flow_defaults', DEFAULT_HEADER_COLUMNS, [header]);
            await insertMany(tx, 'dbo.cash_flow_default_items', DEFAULT_ITEM_COLUMNS, items);
        });
    }
}

module.exports = new CashFlowRepository();
