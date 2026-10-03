const { sql, C, exec, rows, withTransaction, insertMany, updateRow, getPool } = require('../db/helpers');
const { installmentToRows, assembleInstallments } = require('../db/mappers');

const PARENT_COLUMNS = [
    C.id('id'), C.str('name', 200), C.money('total_amount'), C.money('down_payment'), C.money('monthly_payment'),
    C.int('installments_count'), C.str('start_date', 30), C.str('color', 20), C.text('notes'),
    C.int('manual_paid_count'), C.str('last_manual_payment_date', 30), C.vchar('payment_type', 20),
    C.id('linked_goal_id'), C.text('extra_json')
];

const LOAN_COLUMNS = [
    C.id('installment_id'), C.int('component_no'), C.id('component_id'), C.str('description', 200),
    C.money('total_loan_amount'), C.money('monthly_payment'), C.int('installments_count'), C.str('start_date', 30),
    C.int('paid_count'), C.str('last_paid_date', 30), C.pct('interest_rate'), C.str('payoff_date', 30),
    C.money('payoff_amount'), C.bit('payments_tracked'), C.text('extra_json')
];

const LOAN_PAYMENT_COLUMNS = [
    C.id('installment_id'), C.int('component_no'), C.int('sort_order'), C.str('payment_date', 30), C.money('amount')
];

const MILESTONE_COLUMNS = [
    C.id('installment_id'), C.int('sort_order'), C.id('milestone_id'), C.str('description', 200),
    C.pct('percentage'), C.money('amount'), C.str('milestone_date', 30)
];

const MILESTONE_PAYMENT_COLUMNS = [
    C.id('installment_id'), C.int('sort_order'), C.str('payment_date', 30), C.money('amount'),
    C.id('milestone_id'), C.str('description', 200)
];

const PAYMENT_COLUMNS = [
    C.id('installment_id'), C.int('sort_order'), C.str('payment_date', 30), C.money('amount')
];

const ID_FILTER = '(@id IS NULL OR {col} = @id)';

/** Loads installments (all, or one by id) together with all their child rows. */
async function load(executor, id = null) {
    const params = { id: [sql.NVarChar(50), id] };
    const filter = (column) => ID_FILTER.replace('{col}', column);

    const [parents, loans, loanPayments, milestones, milestonePayments, payments] = await Promise.all([
        rows(executor, `
            SELECT id, name, total_amount, down_payment, monthly_payment, installments_count, start_date, color,
                   notes, manual_paid_count, last_manual_payment_date, payment_type, linked_goal_id, extra_json
            FROM dbo.installments WHERE ${filter('id')} ORDER BY seq`, params),
        rows(executor, `
            SELECT installment_id, component_no, component_id, description, total_loan_amount, monthly_payment,
                   installments_count, start_date, paid_count, last_paid_date, interest_rate, payoff_date,
                   payoff_amount, payments_tracked, extra_json
            FROM dbo.installment_loan_components WHERE ${filter('installment_id')}
            ORDER BY installment_id, component_no`, params),
        rows(executor, `
            SELECT installment_id, component_no, sort_order, payment_date, amount
            FROM dbo.installment_loan_payments WHERE ${filter('installment_id')}
            ORDER BY installment_id, component_no, sort_order`, params),
        rows(executor, `
            SELECT installment_id, sort_order, milestone_id, description, percentage, amount, milestone_date
            FROM dbo.installment_milestones WHERE ${filter('installment_id')}
            ORDER BY installment_id, sort_order`, params),
        rows(executor, `
            SELECT installment_id, sort_order, payment_date, amount, milestone_id, description
            FROM dbo.installment_milestone_payments WHERE ${filter('installment_id')}
            ORDER BY installment_id, sort_order`, params),
        rows(executor, `
            SELECT installment_id, sort_order, payment_date, amount
            FROM dbo.installment_payments WHERE ${filter('installment_id')}
            ORDER BY installment_id, sort_order`, params)
    ]);

    return assembleInstallments({ parents, loans, loanPayments, milestones, milestonePayments, payments });
}

async function insertChildren(tx, parts) {
    await insertMany(tx, 'dbo.installment_loan_components', LOAN_COLUMNS, parts.loans);
    await insertMany(tx, 'dbo.installment_loan_payments', LOAN_PAYMENT_COLUMNS, parts.loanPayments);
    await insertMany(tx, 'dbo.installment_milestones', MILESTONE_COLUMNS, parts.milestones);
    await insertMany(tx, 'dbo.installment_milestone_payments', MILESTONE_PAYMENT_COLUMNS, parts.milestonePayments);
    await insertMany(tx, 'dbo.installment_payments', PAYMENT_COLUMNS, parts.payments);
}

// Deleting the loan components also deletes their payments (ON DELETE CASCADE).
async function deleteChildren(tx, id) {
    const params = { id: [sql.NVarChar(50), id] };
    await exec(tx, 'DELETE FROM dbo.installment_loan_components WHERE installment_id = @id', params);
    await exec(tx, 'DELETE FROM dbo.installment_milestones WHERE installment_id = @id', params);
    await exec(tx, 'DELETE FROM dbo.installment_milestone_payments WHERE installment_id = @id', params);
    await exec(tx, 'DELETE FROM dbo.installment_payments WHERE installment_id = @id', params);
}

class InstallmentsRepository {
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
        const parts = installmentToRows(data);
        await withTransaction(async (tx) => {
            await insertMany(tx, 'dbo.installments', PARENT_COLUMNS, [parts.parent]);
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
        const parts = installmentToRows(merged);

        await withTransaction(async (tx) => {
            await updateRow(tx, 'dbo.installments', PARENT_COLUMNS, parts.parent, 'id');
            await deleteChildren(tx, parts.parent.id);
            await insertChildren(tx, parts);
        });

        return this.findById(id);
    }

    async delete(id) {
        const pool = await getPool();
        const result = await exec(pool, 'DELETE FROM dbo.installments WHERE id = @id', {
            id: [sql.NVarChar(50), String(id)]
        });
        return (result.rowsAffected[0] || 0) > 0;
    }

    /**
     * Replace everything (used by the one-time JSON import).
     * @param {Array} items
     */
    async replaceAll(items) {
        const all = items.map(installmentToRows);
        await withTransaction(async (tx) => {
            await exec(tx, 'DELETE FROM dbo.installments WITH (TABLOCKX)'); // children are removed by cascade
            for (const parts of all) {
                await insertMany(tx, 'dbo.installments', PARENT_COLUMNS, [parts.parent]);
                await insertChildren(tx, parts);
            }
        });
    }
}

module.exports = new InstallmentsRepository();
