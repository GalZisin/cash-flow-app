const express = require('express');
const router = express.Router();
const budgetService = require('../services/budget.service');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/budget/settings
 * קבלת הגדרות תקציב
 */
router.get('/settings', asyncHandler(async (req, res) => {
    const settings = await budgetService.getBudgetSettings();
    res.json(settings);
}));

/**
 * POST /api/budget/settings
 * שמירת הגדרות תקציב
 */
router.post('/settings', asyncHandler(async (req, res) => {
    const settings = await budgetService.saveBudgetSettings(req.body);
    res.json(settings);
}));

/**
 * GET /api/budget/monthly/:month
 * קבלת תקציב חודשי מחושב (YYYY-MM)
 */
router.get('/monthly/:month', asyncHandler(async (req, res) => {
    const { month } = req.params;
    const monthlyBudget = await budgetService.getMonthlyBudget(month);
    res.json(monthlyBudget);
}));

/**
 * GET /api/budget/alerts/:month
 * קבלת התראות לחודש
 */
router.get('/alerts/:month', asyncHandler(async (req, res) => {
    const { month } = req.params;
    const alerts = await budgetService.getAlerts(month);
    res.json(alerts);
}));

module.exports = router;
