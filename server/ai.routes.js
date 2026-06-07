const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const { buildSummary, simulateScenario } = require('./cashflow-engine');
const { getAnalysis, getChat, getScenario } = require('./ai.service');

// --- File paths ---
const CASHFLOW_FILE = path.join(__dirname, 'cash-flow-data-miluim.json');
const DEFAULTS_FILE = path.join(__dirname, 'cash-flow-defaults.json');
const INSTALLMENTS_FILE = path.join(__dirname, 'installments.json');
const INVESTMENTS_FILE = path.join(__dirname, 'investments.json');

function loadAllData() {
  const readJson = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  return {
    cashFlow: readJson(CASHFLOW_FILE),
    defaults: readJson(DEFAULTS_FILE),
    installments: readJson(INSTALLMENTS_FILE) || [],
    investments: readJson(INVESTMENTS_FILE) || []
  };
}

/**
 * GET /api/ai/summary
 * Returns the computed financial summary snapshot (no AI).
 */
router.get('/summary', (req, res) => {
  try {
    const data = loadAllData();
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
    const data = loadAllData();
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
    const data = loadAllData();
    const summary = buildSummary(data);
    const result = await getChat(summary, question);
    res.json(result);
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
    const data = loadAllData();
    const summary = buildSummary(data);
    const simulationResult = simulateScenario({ summary, description, amount: Number(amount), date });
    const aiResult = await getScenario(summary, { description, amount: Number(amount), date }, simulationResult);
    res.json({ simulation: simulationResult, ...aiResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
