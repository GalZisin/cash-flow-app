const cashflowService = require('../cashflow/cashflow.service');
const aiService = require('./ai.service');
const installmentRepo = require('../installments/installments.repository');
const investmentRepo = require('../investments/investments.repository');
const cashflowRepo = require('../cashflow/cashflow.repository');

async function getFullSummary() {
    const [cashFlow, installments, investments] = await Promise.all([
        cashflowRepo.getCashFlow(),
        installmentRepo.getAll(),
        investmentRepo.getAll()
    ]);
    return cashflowService.buildFinancialSummary({ cashFlow, installments, investments });
}

exports.getSummary = async (req, res) => {
    try {
        const summary = await getFullSummary();
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: 'Failed to build summary' });
    }
};

exports.chat = async (req, res) => {
    try {
        const summary = await getFullSummary();
        const result = await aiService.getChat(summary, req.body.question);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getInsights = async (req, res) => {
    try {
        const summary = await getFullSummary();
        const prompt = "Analyze the provided financial summary and give 3-4 proactive, short, and actionable insights or warnings. Focus on balance drops, high expense trends, or savings opportunities. Respond in bullet points.";
        const result = await aiService.getChat(summary, prompt);
        const insights = result.answer.split('\n').filter(line => line.trim().length > 0);
        res.json({ insights });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};