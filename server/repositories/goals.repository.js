const fileStorage = require('../utils/fileStorage');
const path = require('path');

const GOALS_FILE = path.join(__dirname, '../data/financial-goals.json');

/**
 * Repository for financial goals data access
 */
class GoalsRepository {
    /**
     * Read all goals
     * @returns {Promise<Array>}
     */
    async read() {
        const data = await fileStorage.readJSON(GOALS_FILE, { goals: [] });
        return data.goals || [];
    }

    /**
     * Write goals
     * @param {Array} goals
     * @returns {Promise<void>}
     */
    async write(goals) {
        return await fileStorage.writeJSON(GOALS_FILE, { goals });
    }

    /**
     * Find goal by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const goals = await this.read();
        return goals.find(g => g.id === id) || null;
    }

    /**
     * Create new goal
     * @param {Object} goal
     * @returns {Promise<Object>}
     */
    async create(goal) {
        const goals = await this.read();
        goals.push(goal);
        await this.write(goals);
        return goal;
    }

    /**
     * Update goal
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<Object|null>}
     */
    async update(id, updates) {
        const goals = await this.read();
        const index = goals.findIndex(g => g.id === id);

        if (index === -1) {
            return null;
        }

        goals[index] = { ...goals[index], ...updates, updatedDate: new Date().toISOString() };
        await this.write(goals);
        return goals[index];
    }

    /**
     * Delete goal
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        const goals = await this.read();
        const filtered = goals.filter(g => g.id !== id);

        if (filtered.length === goals.length) {
            return false;
        }

        await this.write(filtered);
        return true;
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
