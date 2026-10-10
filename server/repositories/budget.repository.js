const { C, exec, rows, withTransaction, insertMany, getPool } = require('../db/helpers');
const { budgetToRows, assembleBudget } = require('../db/mappers');
const traceMethods = require('../utils/traceMethods');

const COLUMNS = [C.vchar('category', 30), C.int('sort_order'), C.money('monthly_limit')];

/**
 * Repository for budget settings data access (monthly limit per expense category)
 */
class BudgetRepository {
    /**
     * Read budget settings
     * @returns {Promise<Object|null>} { CATEGORY: limit } or null when nothing was saved yet
     */
    async readSettings() {
        const pool = await getPool();
        const settingsRows = await rows(pool, `
            SELECT category, monthly_limit FROM dbo.budget_settings ORDER BY sort_order`);
        return settingsRows.length ? assembleBudget(settingsRows) : null;
    }

    /**
     * Write budget settings (replaces all categories)
     * @param {Object} settings
     * @returns {Promise<void>}
     */
    async writeSettings(settings) {
        const settingsRows = budgetToRows(settings);
        await withTransaction(async (tx) => {
            await exec(tx, 'DELETE FROM dbo.budget_settings WITH (TABLOCKX)');
            await insertMany(tx, 'dbo.budget_settings', COLUMNS, settingsRows);
        });
    }
}

module.exports = traceMethods(new BudgetRepository(), 'budgetRepository');
