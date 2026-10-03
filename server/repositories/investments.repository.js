const { sql, C, exec, rows, withTransaction, insertMany, updateRow, getPool } = require('../db/helpers');
const { investmentToRows, assembleInvestments } = require('../db/mappers');

const PARENT_COLUMNS = [
    C.id('id'), C.str('name', 200), C.vchar('investment_type', 20), C.money('initial_value'),
    C.pct('annual_return'), C.text('extra_json')
];

const TRANSACTION_COLUMNS = [
    C.id('investment_id'), C.int('sort_order'), C.id('tx_id'), C.str('tx_date', 30), C.money('amount'),
    C.vchar('tx_type', 20)
];

const SNAPSHOT_COLUMNS = [
    C.id('investment_id'), C.int('sort_order'), C.id('snapshot_id'), C.str('snapshot_date', 30),
    C.money('snapshot_value')
];

const RULE_COLUMNS = [
    C.id('investment_id'), C.int('sort_order'), C.id('rule_id'), C.int('from_month'), C.int('to_month'),
    C.money('monthly_amount'), C.money('one_time_amount'), C.str('description', 500)
];

const ID_FILTER = '(@id IS NULL OR {col} = @id)';

/** Loads investments (all, or one by id) together with transactions, snapshots and simulation rules. */
async function load(executor, id = null) {
    const params = { id: [sql.NVarChar(50), id] };
    const filter = (column) => ID_FILTER.replace('{col}', column);

    const [parents, transactions, snapshots, rules] = await Promise.all([
        rows(executor, `
            SELECT id, name, investment_type, initial_value, annual_return, extra_json
            FROM dbo.investments WHERE ${filter('id')} ORDER BY seq`, params),
        rows(executor, `
            SELECT investment_id, sort_order, tx_id, tx_date, amount, tx_type
            FROM dbo.investment_transactions WHERE ${filter('investment_id')}
            ORDER BY investment_id, sort_order`, params),
        rows(executor, `
            SELECT investment_id, sort_order, snapshot_id, snapshot_date, snapshot_value
            FROM dbo.investment_snapshots WHERE ${filter('investment_id')}
            ORDER BY investment_id, sort_order`, params),
        rows(executor, `
            SELECT investment_id, sort_order, rule_id, from_month, to_month, monthly_amount, one_time_amount, description
            FROM dbo.investment_simulation_rules WHERE ${filter('investment_id')}
            ORDER BY investment_id, sort_order`, params)
    ]);

    return assembleInvestments({ parents, transactions, snapshots, rules });
}

async function insertChildren(tx, parts) {
    await insertMany(tx, 'dbo.investment_transactions', TRANSACTION_COLUMNS, parts.transactions);
    await insertMany(tx, 'dbo.investment_snapshots', SNAPSHOT_COLUMNS, parts.snapshots);
    await insertMany(tx, 'dbo.investment_simulation_rules', RULE_COLUMNS, parts.rules);
}

async function deleteChildren(tx, id) {
    const params = { id: [sql.NVarChar(50), id] };
    await exec(tx, 'DELETE FROM dbo.investment_transactions WHERE investment_id = @id', params);
    await exec(tx, 'DELETE FROM dbo.investment_snapshots WHERE investment_id = @id', params);
    await exec(tx, 'DELETE FROM dbo.investment_simulation_rules WHERE investment_id = @id', params);
}

class InvestmentsRepository {
    async findAll() {
        const pool = await getPool();
        return load(pool);
    }

    async findById(id) {
        const pool = await getPool();
        const items = await load(pool, String(id));
        return items[0] || null;
    }

    async create(data) {
        const parts = investmentToRows(data);
        await withTransaction(async (tx) => {
            await insertMany(tx, 'dbo.investments', PARENT_COLUMNS, [parts.parent]);
            await insertChildren(tx, parts);
        });
        return data;
    }

    async update(id, data) {
        const existing = await this.findById(id);
        if (!existing) {
            return null;
        }

        const merged = { ...existing, ...data, id };
        const parts = investmentToRows(merged);

        await withTransaction(async (tx) => {
            await updateRow(tx, 'dbo.investments', PARENT_COLUMNS, parts.parent, 'id');
            await deleteChildren(tx, parts.parent.id);
            await insertChildren(tx, parts);
        });

        return this.findById(id);
    }

    async delete(id) {
        const pool = await getPool();
        const result = await exec(pool, 'DELETE FROM dbo.investments WHERE id = @id', {
            id: [sql.NVarChar(50), String(id)]
        });
        return (result.rowsAffected[0] || 0) > 0;
    }

    /**
     * Replace everything (used by the one-time JSON import).
     * @param {Array} items
     */
    async replaceAll(items) {
        const all = items.map(investmentToRows);
        await withTransaction(async (tx) => {
            await exec(tx, 'DELETE FROM dbo.investments WITH (TABLOCKX)'); // children are removed by cascade
            for (const parts of all) {
                await insertMany(tx, 'dbo.investments', PARENT_COLUMNS, [parts.parent]);
                await insertChildren(tx, parts);
            }
        });
    }
}

module.exports = new InvestmentsRepository();
