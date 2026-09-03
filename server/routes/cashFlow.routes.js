const express = require('express');
const router = express.Router();
const cashFlowService = require('../services/cashFlow.service');
const goalsService = require('../services/goals.service');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/cash-flow
router.get('/cash-flow', asyncHandler(async (req, res) => {
    const data = await cashFlowService.getCashFlow();
    res.json(data);
}));

// POST /api/cash-flow
router.post('/cash-flow', asyncHandler(async (req, res) => {
    const result = await cashFlowService.saveCashFlow(req.body);
    await goalsService.analyzeAllGoals();
    res.json(result);
}));

// GET /api/cash-flow-defaults
router.get('/cash-flow-defaults', asyncHandler(async (req, res) => {
    const defaults = await cashFlowService.getDefaults();
    res.json(defaults);
}));

// POST /api/cash-flow-defaults
router.post('/cash-flow-defaults', asyncHandler(async (req, res) => {
    const defaults = await cashFlowService.saveDefaults(req.body);
    res.json(defaults);
}));

module.exports = router;
