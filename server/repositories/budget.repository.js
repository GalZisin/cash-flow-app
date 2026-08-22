const fileStorage = require('../utils/fileStorage');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../data/budget-settings.json');

/**
 * Repository for budget settings data access
 */
class BudgetRepository {
    /**
     * Read budget settings
     * @returns {Promise<Object|null>}
     */
    async readSettings() {
        return await fileStorage.readJSON(SETTINGS_FILE, null);
    }

    /**
     * Write budget settings
     * @param {Object} settings
     * @returns {Promise<void>}
     */
    async writeSettings(settings) {
        return await fileStorage.writeJSON(SETTINGS_FILE, settings);
    }
}

module.exports = new BudgetRepository();
