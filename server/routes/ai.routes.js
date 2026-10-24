const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError } = require('../utils/errors');
const rateLimit = require('../middleware/rateLimit');
const financialSummary = require('../services/financialSummary.service');
const { simulateScenario } = require('../services/cashflow-engine');
const aiService = require('../services/ai.service');
const insightsService = require('../services/insights.service');

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
 * GET /api/ai/usage
 * Provider quota (from the last AI response headers) and the chat context budget, for the chat tab meters.
 */
router.get('/usage', asyncHandler(async (req, res) => {
    res.json(aiService.getUsage(await financialSummary.getSummary()));
}));

const MAX_HISTORY_MESSAGES = 200;

/** { question, history?: [{ role: 'user' | 'assistant', content }], lang?: 'he' | 'en' } -> { question, options } */
function chatInput(body) {
    const question = String(body?.question ?? '').trim();
    if (!question) throw new ValidationError('question is required');
    const history = body?.history ?? [];
    if (!Array.isArray(history) || history.length > MAX_HISTORY_MESSAGES) {
        throw new ValidationError(`history must be an array of up to ${MAX_HISTORY_MESSAGES} messages`);
    }
    const messages = history.map((m) => {
        if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') {
            throw new ValidationError('history items need role "user" or "assistant" and a string content');
        }
        return { role: m.role, content: m.content };
    });
    return { question, options: { history: messages, lang: ['he', 'en'].includes(body?.lang) ? body.lang : undefined } };
}

/**
 * POST /api/ai/chat   Body: { question, history?, lang? }
 */
router.post('/chat', asyncHandler(async (req, res) => {
    const { question, options } = chatInput(req.body);
    const summary = await financialSummary.getSummary();
    res.json(await aiService.getChat(summary, question, options));
}));

/**
 * POST /api/ai/chat-stream   Body: { question, history?, lang? }
 * Streams the answer as chunked plain text. A conversation over the context budget gets 400 AI_CONTEXT_FULL.
 */
router.post('/chat-stream', asyncHandler(async (req, res) => {
    const { question, options } = chatInput(req.body);
    const summary = await financialSummary.getSummary();
    aiService.assertChatFits(summary, question, options);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.flushHeaders();

    aiService.getChatStream(summary, question,
        (token) => res.write(token),
        () => res.end(),
        (err) => {
            // Headers are already out: finish the body with a readable note instead of a second status.
            res.end(`\n[${err.message}]`);
        },
        options
    );
}));

/**
 * POST /api/ai/insights   Body: { dashboard?: { kpis, trends }, lang?: 'he' | 'en' }
 * Short typed insights from the summary + the dashboard snapshot; saved to the AI reports archive.
 */
router.post('/insights', asyncHandler(async (req, res) => {
    const { dashboard, lang } = req.body || {};
    if (dashboard !== undefined && (dashboard === null || typeof dashboard !== 'object' || Array.isArray(dashboard))) {
        throw new ValidationError('dashboard must be an object');
    }
    const summary = await financialSummary.getSummary();
    res.json(await insightsService.generate(summary, dashboard, lang === 'en' ? 'en' : 'he'));
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
