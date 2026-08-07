const aiReportsRepository = require('../repositories/aiReports.repository');
const { ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Service for AI reports business logic
 */
class AiReportsService {
    /**
     * Get all AI reports (sorted newest first)
     * @returns {Promise<Array>}
     */
    async getAllReports() {
        const reports = await aiReportsRepository.readAll();
        // Sort by ID (timestamp) descending - newest first
        return reports.sort((a, b) => {
            const idA = parseInt(a.id) || 0;
            const idB = parseInt(b.id) || 0;
            return idB - idA;
        });
    }

    /**
     * Get report by ID
     * @param {string} id
     * @returns {Promise<Object>}
     */
    async getReportById(id) {
        const report = await aiReportsRepository.findById(id);

        if (!report) {
            throw new NotFoundError(`Report with id ${id} not found`);
        }

        return report;
    }

    /**
     * Create new AI report
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async createReport(data) {
        // Validate required fields
        if (!data.prompt && !data.analysis) {
            throw new ValidationError('Either prompt or analysis is required');
        }

        const report = {
            id: Date.now().toString(),
            ...data,
            createdAt: data.createdAt || new Date().toISOString()
        };

        const reports = await aiReportsRepository.readAll();
        reports.unshift(report); // Add to beginning (newest first)
        await aiReportsRepository.writeAll(reports);

        return report;
    }

    /**
     * Update report
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async updateReport(id, updates) {
        const updated = await aiReportsRepository.update(id, updates);

        if (!updated) {
            throw new NotFoundError(`Report with id ${id} not found`);
        }

        return updated;
    }

    /**
     * Delete report
     * @param {string} id
     * @returns {Promise<void>}
     */
    async deleteReport(id) {
        const deleted = await aiReportsRepository.delete(id);

        if (!deleted) {
            throw new NotFoundError(`Report with id ${id} not found`);
        }
    }
}

module.exports = new AiReportsService();
