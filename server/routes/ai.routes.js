const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError } = require('../utils/errors');
const rateLimit = require('../middleware/rateLimit');
const financialSummary = require('../services/financialSummary.service');
const { simulateScenario } = require('../services/cashflow-engine');
const aiService = require('../services/ai.service');

// AI calls are the expensive ones (CPU on the model server / paid tokens on a hosted API).
router.use(rateLimit({
    windowMs: 60_000,
    max: Number(process.env.AI_RATE_LIMIT_PER_MINUTE ?? 30),
    message: 'Too many AI requests, please wait a minute.'
}));

/**
 * GET /api/ai/summary
 * Computed financial summary snapshot (no AI involved).
 */
router.get('/summary', asyncHandler(async (req, res) => {
    res.json(await financialSummary.getSummary());
}));

/**
 * POST /api/ai/analysis
 * Full AI-generated financial analysis.
 */
router.post('/analysis', asyncHandler(async (req, res) => {
    const summary = await financialSummary.getSummary();
    const result = await aiService.getAnalysis(summary);
    res.json({ summary, ...result });
}));

/**
 * POST /api/ai/chat   Body: { question }
 */
router.post('/chat', asyncHandler(async (req, res) => {
    const question = String(req.body?.question ?? '').trim();
    if (!question) throw new ValidationError('question is required');

    const summary = await financialSummary.getSummary();
    res.json(await aiService.getChat(summary, question));
}));

/**
 * POST /api/ai/chat-stream   Body: { question }
 * Streams the answer as chunked plain text.
 */
router.post('/chat-stream', asyncHandler(async (req, res) => {
    const question = String(req.body?.question ?? '').trim();
    if (!question) throw new ValidationError('question is required');

    const summary = await financialSummary.getSummary();

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.flushHeaders();

    aiService.getChatStream(summary, question,
        (token) => res.write(token),
        () => res.end(),
        (err) => {
            // Headers are already out: finish the body with a readable note instead of a second status.
            res.end(`\n[${err.message}]`);
        }
    );
}));

/**
 * POST /api/ai/scenario   Body: { description, amount, date: 'YYYY-MM-DD' }
 * Simulates a future purchase and asks the AI to analyse it.
 */
router.post('/scenario', asyncHandler(async (req, res) => {
    const { description, amount, date } = req.body || {};
    if (!description || !amount || !date) throw new ValidationError('description, amount, and date are required');
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(String(date))) throw new ValidationError('date must be YYYY-MM-DD');

    const summary = await financialSummary.getSummary();
    const scenario = { description: String(description), amount: Number(amount), date: String(date) };
    const simulation = simulateScenario({ summary, ...scenario });
    const aiResult = await aiService.getScenario(summary, scenario, simulation);
    res.json({ simulation, ...aiResult });
}));

module.exports = router;
