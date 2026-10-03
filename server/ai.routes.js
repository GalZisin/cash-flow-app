const express = require('express');
const router = express.Router();

const { buildSummary, simulateScenario } = require('./cashflow-engine');
const { getAnalysis, getChat, getScenario, getChatStream } = require('./ai.service');

const cashFlowRepository = require('./repositories/cashFlow.repository');
const installmentsRepository = require('./repositories/installments.repository');
const investmentsRepository = require('./repositories/investments.repository');

// Loads everything the AI summary needs from the database.
async function loadAllData() {
  const [cashFlow, defaults, installments, investments] = await Promise.all([
    cashFlowRepository.read(),
    cashFlowRepository.readDefaults(),
    installmentsRepository.findAll(),
    investmentsRepository.findAll()
  ]);
  return { cashFlow, defaults, installments, investments };
}

/**
 * GET /api/ai/summary
 * Returns the computed financial summary snapshot (no AI).
 */
router.get('/summary', async (req, res) => {
  try {
    const data = await loadAllData();
    const summary = buildSummary(data);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/analysis
 * Returns full AI-generated financial analysis.
 */
router.post('/analysis', async (req, res) => {
  try {
    const data = await loadAllData();
    const summary = buildSummary(data);
    const result = await getAnalysis(summary);
    res.json({ summary, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/chat
 * Body: { question: string }
 * Answers a user's financial question using AI + current data context.
 */
router.post('/chat', async (req, res) => {
  const { question } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'question is required' });

  try {
    const data = await loadAllData();
    const summary = buildSummary(data);
    const result = await getChat(summary, question);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/chat-stream
 * Streaming version of the chat.
 */
router.post('/chat-stream', async (req, res) => {
  const { question } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'question is required' });

  try {
    const data = await loadAllData();
    const summary = buildSummary(data);

    // הגדרת Headers ל-Streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    getChatStream(summary, question,
      (token) => res.write(token),
      () => res.end(),
      (err) => { console.error(err); res.status(500).end(); }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/scenario
 * Body: { description: string, amount: number, date: string (YYYY-MM-DD) }
 * Simulates a future purchase and asks AI to analyze it.
 */
router.post('/scenario', async (req, res) => {
  const { description, amount, date } = req.body;
  if (!description || !amount || !date)
    return res.status(400).json({ error: 'description, amount, and date are required' });

  try {
    const data = await loadAllData();
    const summary = buildSummary(data);
    const simulationResult = simulateScenario({ summary, description, amount: Number(amount), date });
    const aiResult = await getScenario(summary, { description, amount: Number(amount), date }, simulationResult);
    res.json({ simulation: simulationResult, ...aiResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
