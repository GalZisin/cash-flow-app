const aiReportsRepository = require('../repositories/aiReports.repository');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');
const traceMethods = require('../utils/traceMethods');

const REPORT_TYPES = ['analysis', 'insights', 'scenario'];

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
        // Newest first (createdAt is an ISO string, so a string compare is a correct time order)
        return reports.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
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
        // The client sends { type, content, scenarioDetails? }; content is a string, or string[] for insights.
        // prompt / analysis are the older shape and still accepted.
        const body = data && typeof data === 'object' ? data : {};
        const content = body.content;
        const hasContent = (typeof content === 'string' && content.trim() !== '')
            || (Array.isArray(content) && content.some((c) => typeof c === 'string' && c.trim() !== ''));
        if (!hasContent && !body.prompt && !body.analysis) {
            throw new ValidationError('content is required');
        }
        if (body.type !== undefined && !REPORT_TYPES.includes(body.type)) {
            throw new ValidationError(`type must be one of: ${REPORT_TYPES.join(', ')}`);
        }

        const report = {
            ...body,
            id: uuidv4(),
            createdAt: body.createdAt || new Date().toISOString()
        };

        // One INSERT; reading and rewriting the whole table for every new report is not needed.
        return aiReportsRepository.create(report);
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

module.exports = traceMethods(new AiReportsService(), 'aiReportsService');
