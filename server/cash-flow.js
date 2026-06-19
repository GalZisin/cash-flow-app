const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'cash-flow-data-miluim.json');
const DEFAULTS_FILE = path.join(__dirname, 'cash-flow-defaults.json');

function readDefaults() {
    if (!fs.existsSync(DEFAULTS_FILE)) {
        return { income: 0, mortgagePayment: 0, loanPayment: 0, regularExpenses: [], specialExpenses: [] };
    }
    return JSON.parse(fs.readFileSync(DEFAULTS_FILE, { encoding: 'utf8' }));
}

function writeDefaults(data) {
    fs.writeFileSync(DEFAULTS_FILE, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}

// --- Cash Flow ---
router.get('/cash-flow', (req, res) => {
    if (!fs.existsSync(DATA_FILE)) return res.json(null);
    const data = JSON.parse(fs.readFileSync(DATA_FILE, { encoding: 'utf8' }));
    data.months = data.months.map(m => ({ loanPayment: 0, ...m }));
    res.json(data);
});

router.post('/cash-flow', (req, res) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), { encoding: 'utf8' });
    res.json({ success: true });
});

// --- Cash Flow Defaults ---
router.get('/cash-flow-defaults', (req, res) => {
    res.json(readDefaults());
});

router.post('/cash-flow-defaults', (req, res) => {
    const defaults = {
        income: Number(req.body.income) || 0,
        mortgagePayment: Number(req.body.mortgagePayment) || 0,
        loanPayment: Number(req.body.loanPayment) || 0,
        additionalIncomes: (req.body.additionalIncomes || []).map(e => ({
            description: e.description ?? '',
            amount: Number(e.amount) || 0
        })),
        regularExpenses: (req.body.regularExpenses || []).map(e => ({
            description: e.description ?? '',
            amount: Number(e.amount) || 0,
            ...(e.category ? { category: e.category } : {})
        })),
        specialExpenses: (req.body.specialExpenses || []).map(e => ({
            description: e.description ?? '',
            amount: Number(e.amount) || 0,
            ...(e.category ? { category: e.category } : {})
        }))
    };
    writeDefaults(defaults);
    res.json(defaults);
});

module.exports = router;