const { sql, C, SEL, exec, rows, withTransaction, insertMany, updateRow, getPool } = require('../db/helpers');
const { reportToRow, assembleReport } = require('../db/mappers');
const traceMethods = require('../utils/traceMethods');

const COLUMNS = [
    C.id('id'), C.vchar('report_type', 30), C.text('content'), C.text('scenario_details_json'),
    C.ts('created_at'), C.text('extra_json')
];

const SELECT_REPORTS = `
    SELECT id, report_type, content, scenario_details_json, ${SEL.ts('created_at')}, extra_json
    FROM dbo.ai_reports`;

/**
 * Repository for AI reports data access
 */
class AiReportsRepository {
    /**
     * Read all AI reports
     * @returns {Promise<Array>}
     */
    async readAll() {
        const pool = await getPool();
        const reportRows = await rows(pool, `${SELECT_REPORTS} ORDER BY seq`);
        return reportRows.map(assembleReport);
    }

    /**
     * Replace all AI reports
     * @param {Array} reports
     * @returns {Promise<void>}
     */
    async writeAll(reports) {
        const reportRows = reports.map(reportToRow);
        await withTransaction(async (tx) => {
            await exec(tx, 'DELETE FROM dbo.ai_reports WITH (TABLOCKX)');
            await insertMany(tx, 'dbo.ai_reports', COLUMNS, reportRows);
        });
    }

    /**
     * Find report by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const pool = await getPool();
        const reportRows = await rows(pool, `${SELECT_REPORTS} WHERE id = @id`, { id: [sql.NVarChar(50), String(id)] });
        return reportRows.length ? assembleReport(reportRows[0]) : null;
    }

    /**
     * Create new report
     * @param {Object} report
     * @returns {Promise<Object>}
     */
    async create(report) {
        const pool = await getPool();
        await insertMany(pool, 'dbo.ai_reports', COLUMNS, [reportToRow(report)]);
        return report;
    }

    /**
     * Update report
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<Object|null>}
     */
    async update(id, updates) {
        const existing = await this.findById(id);
        if (!existing) {
            return null;
        }

        const pool = await getPool();
        await updateRow(pool, 'dbo.ai_reports', COLUMNS, reportToRow({ ...existing, ...updates, id: existing.id }), 'id');
        return this.findById(id);
    }

    /**
     * Delete report
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        const pool = await getPool();
        const result = await exec(pool, 'DELETE FROM dbo.ai_reports WHERE id = @id', {
            id: [sql.NVarChar(50), String(id)]
        });
        return (result.rowsAffected[0] || 0) > 0;
    }
}

module.exports = traceMethods(new AiReportsRepository(), 'aiReportsRepository');
