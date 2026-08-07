const fileStorage = require('../utils/fileStorage');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/ai-reports.json');

/**
 * Repository for AI reports data access
 */
class AiReportsRepository {
    /**
     * Read all AI reports
     * @returns {Promise<Array>}
     */
    async readAll() {
        return await fileStorage.readJSON(DATA_FILE, []);
    }

    /**
     * Write all AI reports
     * @param {Array} reports
     * @returns {Promise<void>}
     */
    async writeAll(reports) {
        return await fileStorage.writeJSON(DATA_FILE, reports);
    }

    /**
     * Find report by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const reports = await this.readAll();
        return reports.find(r => r.id === id) || null;
    }

    /**
     * Create new report
     * @param {Object} report
     * @returns {Promise<Object>}
     */
    async create(report) {
        const reports = await this.readAll();
        reports.push(report);
        await this.writeAll(reports);
        return report;
    }

    /**
     * Update report
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<Object|null>}
     */
    async update(id, updates) {
        const reports = await this.readAll();
        const index = reports.findIndex(r => r.id === id);

        if (index === -1) {
            return null;
        }

        reports[index] = { ...reports[index], ...updates };
        await this.writeAll(reports);
        return reports[index];
    }

    /**
     * Delete report
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        const reports = await this.readAll();
        const filtered = reports.filter(r => r.id !== id);

        if (filtered.length === reports.length) {
            return false; // Not found
        }

        await this.writeAll(filtered);
        return true;
    }
}

module.exports = new AiReportsRepository();
