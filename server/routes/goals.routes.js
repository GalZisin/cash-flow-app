const express = require('express');
const router = express.Router();
const goalsService = require('../services/goals.service');
const asyncHandler = require('../utils/asyncHandler');

console.log('✅ Goals routes loaded');

// Test route
router.get('/test', (req, res) => {
    res.json({ message: 'Goals route is working!' });
});

/**
 * GET /api/goals
 * קבלת כל היעדים
 */
router.get('/', asyncHandler(async (req, res) => {
    const goals = await goalsService.getAllGoals();
    res.json(goals);
}));

/**
 * GET /api/goals/overview
 * קבלת סקירה כללית
 */
router.get('/overview', asyncHandler(async (req, res) => {
    const overview = await goalsService.getOverview();
    res.json(overview);
}));

/**
 * GET /api/goals/timeline
 * קבלת ציר זמן
 */
router.get('/timeline', asyncHandler(async (req, res) => {
    const timeline = await goalsService.getTimeline();
    res.json(timeline);
}));

/**
 * POST /api/goals/analyze-all
 * ניתוח כל היעדים מחדש
 */
router.post('/analyze-all', asyncHandler(async (req, res) => {
    const result = await goalsService.analyzeAllGoals();
    res.json(result);
}));

/**
 * GET /api/goals/:id
 * קבלת יעד ספציפי
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const goal = await goalsService.getGoalById(req.params.id);
    res.json(goal);
}));

/**
 * POST /api/goals
 * יצירת יעד חדש
 */
router.post('/', asyncHandler(async (req, res) => {
    const goal = await goalsService.createGoal(req.body);
    res.status(201).json(goal);
}));

/**
 * PUT /api/goals/:id
 * עדכון יעד
 */
router.put('/:id', asyncHandler(async (req, res) => {
    const goal = await goalsService.updateGoal(req.params.id, req.body);
    res.json(goal);
}));

/**
 * DELETE /api/goals/:id
 * מחיקת יעד
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const result = await goalsService.deleteGoal(req.params.id);
    res.json(result);
}));

/**
 * POST /api/goals/:id/analyze
 * ניתוח יעד מחדש
 */
router.post('/:id/analyze', asyncHandler(async (req, res) => {
    const analysis = await goalsService.analyzeGoal(req.params.id);
    res.json(analysis);
}));

/**
 * GET /api/goals/:id/integration
 * קבלת מידע משולב על קישורים לתזרים ופריסות
 */
router.get('/:id/integration', asyncHandler(async (req, res) => {
    const goalsIntegrationService = require('../services/goals-integration.service');
    const goal = await goalsService.getGoalById(req.params.id);

    const [cashFlowExpenses, installments, commitments] = await Promise.all([
        goalsIntegrationService.getRelatedCashFlowExpenses(goal),
        goalsIntegrationService.getRelatedInstallments(goal),
        goalsIntegrationService.getFutureCommitments(goal)
    ]);

    res.json({
        goalId: goal.id,
        goalName: goal.name,
        relatedCashFlowExpenses: cashFlowExpenses,
        relatedInstallments: installments,
        futureCommitments: commitments
    });
}));

module.exports = router;
