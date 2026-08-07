const express = require('express');
const router = express.Router();
const aiReportsService = require('../services/aiReports.service');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/ai-reports
 * Get all AI reports (sorted newest first)
 */
router.get('/', asyncHandler(async (req, res) => {
    const reports = await aiReportsService.getAllReports();
    res.json(reports);
}));

/**
 * POST /api/ai-reports
 * Create new AI report
 */
router.post('/', asyncHandler(async (req, res) => {
    const report = await aiReportsService.createReport(req.body);
    res.status(201).json(report);
}));

/**
 * GET /api/ai-reports/:id
 * Get specific report by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const report = await aiReportsService.getReportById(req.params.id);
    res.json(report);
}));

/**
 * DELETE /api/ai-reports/:id
 * Delete AI report
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    await aiReportsService.deleteReport(req.params.id);
    res.json({ success: true });
}));

module.exports = router;
