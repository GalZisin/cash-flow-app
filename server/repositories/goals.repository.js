const { sql, C, SEL, exec, rows, withTransaction, insertMany, updateRow, getPool } = require('../db/helpers');
const { goalToRow, assembleGoal } = require('../db/mappers');

const COLUMNS = [
    C.id('id'), C.str('name', 200), C.text('description'), C.vchar('goal_type', 20), C.money('target_amount'),
    C.str('target_date', 30), C.int('priority'), C.bit('completed'), C.bit('is_fixed'),
    C.id('linked_installment_id'), C.bit('linked_to_special_expense'), C.bit('auto_update_from_cash_flow'),
    C.text('loan_details_json'), C.text('schedule_json'), C.text('analysis_json'),
    C.ts('last_analyzed'), C.ts('created_date'), C.ts('updated_date'), C.ts('completed_date'), C.text('extra_json')
];

const SELECT_GOALS = `
    SELECT id, name, description, goal_type, target_amount, target_date, priority, completed, is_fixed,
           linked_installment_id, linked_to_special_expense, auto_update_from_cash_flow,
           loan_details_json, schedule_json, analysis_json,
           ${SEL.ts('last_analyzed')}, ${SEL.ts('created_date')}, ${SEL.ts('updated_date')},
           ${SEL.ts('completed_date')}, extra_json
    FROM dbo.financial_goals`;

/**
 * Repository for financial goals data access
 */
class GoalsRepository {
    /**
     * Read all goals
     * @returns {Promise<Array>}
     */
    async read() {
        const pool = await getPool();
        const goalRows = await rows(pool, `${SELECT_GOALS} ORDER BY seq`);
        return goalRows.map(assembleGoal);
    }

    /**
     * Replace all goals
     * @param {Array} goals
     * @returns {Promise<void>}
     */
    async write(goals) {
        const goalRows = goals.map(goalToRow);
        await withTransaction(async (tx) => {
            await exec(tx, 'DELETE FROM dbo.financial_goals WITH (TABLOCKX)');
            await insertMany(tx, 'dbo.financial_goals', COLUMNS, goalRows);
        });
    }

    /**
     * Find goal by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const pool = await getPool();
        const goalRows = await rows(pool, `${SELECT_GOALS} WHERE id = @id`, { id: [sql.NVarChar(50), String(id)] });
        return goalRows.length ? assembleGoal(goalRows[0]) : null;
    }

    /**
     * Create new goal
     * @param {Object} goal
     * @returns {Promise<Object>}
     */
    async create(goal) {
        const pool = await getPool();
        await insertMany(pool, 'dbo.financial_goals', COLUMNS, [goalToRow(goal)]);
        return goal;
    }

    /**
     * Update goal
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<Object|null>}
     */
    async update(id, updates) {
        const existing = await this.findById(id);
        if (!existing) {
            return null;
        }

        const merged = { ...existing, ...updates, id: existing.id, updatedDate: new Date().toISOString() };
        const pool = await getPool();
        await updateRow(pool, 'dbo.financial_goals', COLUMNS, goalToRow(merged), 'id');
        return this.findById(id);
    }

    /**
     * Update several goals in ONE transaction (used after re-analysing all goals).
     * Each entry is a full goal object (already merged with its new fields).
     * @param {Array<Object>} goals
     * @returns {Promise<number>} rows updated
     */
    async updateMany(goals) {
        if (!goals.length) return 0;
        const stamp = new Date().toISOString();
        return withTransaction(async (tx) => {
            let updated = 0;
            for (const goal of goals) {
                updated += await updateRow(tx, 'dbo.financial_goals', COLUMNS, goalToRow({ ...goal, updatedDate: stamp }), 'id');
            }
            return updated;
        });
    }

    /**
     * Delete goal
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        const pool = await getPool();
        const result = await exec(pool, 'DELETE FROM dbo.financial_goals WHERE id = @id', {
            id: [sql.NVarChar(50), String(id)]
        });
        return (result.rowsAffected[0] || 0) > 0;
    }

    /**
     * Get active goals (not completed)
     * @returns {Promise<Array>}
     */
    async getActive() {
        const goals = await this.read();
        return goals.filter(g => !g.completed);
    }

    /**
     * Get goals sorted by priority
     * @returns {Promise<Array>}
     */
    async getSortedByPriority() {
        const goals = await this.read();
        return goals.sort((a, b) => a.priority - b.priority);
    }
}

module.exports = new GoalsRepository();
