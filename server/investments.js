const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const INVESTMENTS_FILE = path.join(__dirname, 'investments.json');

// --- Helper functions for Investments ---
function readInvestments() {
    if (!fs.existsSync(INVESTMENTS_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(INVESTMENTS_FILE, { encoding: 'utf8' }));
    let dirty = false;

    const investments = data.map(inv => ({
        transactions: [],
        snapshots: [],
        simulationRules: [],
        ...inv
    }));

    // Migrate: assign IDs to any snapshot or transaction that is missing one
    investments.forEach(inv => {
        if (inv.snapshots) {
            inv.snapshots.forEach(s => {
                if (!s.id) { s.id = Date.now().toString() + Math.random().toString(36).slice(2, 7); dirty = true; }
            });
        }
        if (inv.transactions) {
            inv.transactions.forEach(t => {
                if (!t.id) { t.id = Date.now().toString() + Math.random().toString(36).slice(2, 7); dirty = true; }
            });
        }
    });

    if (dirty) writeInvestments(investments);
    return investments;
}

function writeInvestments(data) {
    fs.writeFileSync(INVESTMENTS_FILE, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}

function sortInvestment(inv) {
    if (inv.transactions) {
        inv.transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    if (inv.snapshots) {
        inv.snapshots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
}

// --- Investment API Routes ---
router.get('/', (req, res) => {
    const investments = readInvestments();
    investments.forEach(inv => sortInvestment(inv));
    res.json(investments);
});

router.post('/', (req, res) => {
    const investments = readInvestments();
    const investment = { id: Date.now().toString(), snapshots: [], transactions: [], simulationRules: [], ...req.body };
    investments.push(investment);
    writeInvestments(investments);
    res.json(investment);
});

router.put('/:id', (req, res) => {
    const investments = readInvestments();
    const idx = investments.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    investments[idx] = { ...investments[idx], ...req.body, id: req.params.id };
    writeInvestments(investments);
    res.json(investments[idx]);
});

router.delete('/:id', (req, res) => {
    let investments = readInvestments();
    investments = investments.filter(i => i.id !== req.params.id);
    writeInvestments(investments);
    res.json(investments);
});

// --- Snapshot Routes ---
router.post('/:id/snapshot', (req, res) => {
    if (!req.body.date || req.body.value == null) {
        return res.status(400).json({ error: 'Invalid snapshot' });
    }
    const investments = readInvestments();
    const inv = investments.find(i => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    if (!inv.snapshots) inv.snapshots = [];

    const newSnapshot = {
        id: Date.now().toString(),
        date: req.body.date,
        value: Number(req.body.value)
    };

    inv.snapshots.push(newSnapshot);

    sortInvestment(inv);
    writeInvestments(investments);
    res.json(inv);
});

router.put('/:id/snapshot/:snapshotId', (req, res) => {
    if (!req.body.date || req.body.value == null) {
        return res.status(400).json({ error: 'Invalid snapshot' });
    }
    const investments = readInvestments();
    const inv = investments.find(i => i.id === req.params.id);

    if (!inv) return res.status(404).json({ error: 'Not found' });

    const snapIndex = inv.snapshots.findIndex(s => s.id === req.params.snapshotId);
    if (snapIndex === -1) return res.status(404).json({ error: 'Snapshot not found' });

    inv.snapshots[snapIndex] = {
        ...inv.snapshots[snapIndex],
        ...req.body,
        value: Number(req.body.value),
        id: req.params.snapshotId
    };

    sortInvestment(inv);
    writeInvestments(investments);
    res.json(inv);
});

router.delete('/:id/snapshot/:snapshotId', (req, res) => {
    const investments = readInvestments();
    const inv = investments.find(i => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    inv.snapshots = inv.snapshots.filter(s => s.id !== req.params.snapshotId);
    writeInvestments(investments);
    res.json(inv);
});

// --- Transaction Routes ---
router.post('/:id/transaction', (req, res) => {
    if (!req.body.date || req.body.amount == null || !req.body.type) {
        return res.status(400).json({ error: 'Invalid transaction' });
    }
    const investments = readInvestments();
    const inv = investments.find(i => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });

    const newTx = {
        id: Date.now().toString(),
        date: req.body.date,
        amount: Number(req.body.amount),
        type: req.body.type
    };

    inv.transactions.push(newTx);
    sortInvestment(inv);
    writeInvestments(investments);
    res.json(inv);
});

router.put('/:id/transaction/:txId', (req, res) => {
    if (!req.body.date || req.body.amount == null || !req.body.type) {
        return res.status(400).json({ error: 'Invalid transaction' });
    }
    const investments = readInvestments();
    const inv = investments.find(i => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });

    const txIndex = inv.transactions.findIndex(t => t.id === req.params.txId);
    if (txIndex === -1) return res.status(404).json({ error: 'Transaction not found' });

    inv.transactions[txIndex] = {
        ...inv.transactions[txIndex],
        ...req.body,
        amount: Number(req.body.amount),
        id: req.params.txId
    };

    sortInvestment(inv);
    writeInvestments(investments);
    res.json(inv);
});

router.delete('/:id/transaction/:txId', (req, res) => {
    const investments = readInvestments();
    const inv = investments.find(i => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });

    inv.transactions = inv.transactions.filter(t => t.id !== req.params.txId);

    sortInvestment(inv);
    writeInvestments(investments);
    res.json(inv);
});

// --- Simulation Rules Routes ---
router.post('/:id/simulation-rule', (req, res) => {
    const investments = readInvestments();
    const inv = investments.find(i => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });

    const newRule = {
        id: Date.now().toString(),
        fromMonth: Number(req.body.fromMonth) || 1,
        toMonth: Number(req.body.toMonth) || 12,
        monthlyAmount: Number(req.body.monthlyAmount) || 0,
        oneTimeAmount: Number(req.body.oneTimeAmount) || 0,
        description: req.body.description || ''
    };

    if (!inv.simulationRules) inv.simulationRules = [];
    inv.simulationRules.push(newRule);
    inv.simulationRules.sort((a, b) => a.fromMonth - b.fromMonth);

    writeInvestments(investments);
    res.json(inv);
});

router.put('/:id/simulation-rule/:ruleId', (req, res) => {
    const investments = readInvestments();
    const inv = investments.find(i => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });

    const ruleIndex = inv.simulationRules.findIndex(r => r.id === req.params.ruleId);
    if (ruleIndex === -1) return res.status(404).json({ error: 'Rule not found' });

    inv.simulationRules[ruleIndex] = {
        ...inv.simulationRules[ruleIndex],
        ...req.body,
        fromMonth: Number(req.body.fromMonth),
        toMonth: Number(req.body.toMonth),
        monthlyAmount: Number(req.body.monthlyAmount),
        oneTimeAmount: Number(req.body.oneTimeAmount),
        id: req.params.ruleId
    };

    inv.simulationRules.sort((a, b) => a.fromMonth - b.fromMonth);
    writeInvestments(investments);
    res.json(inv);
});

router.delete('/:id/simulation-rule/:ruleId', (req, res) => {
    const investments = readInvestments();
    const inv = investments.find(i => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });

    inv.simulationRules = inv.simulationRules.filter(r => r.id !== req.params.ruleId);
    writeInvestments(investments);
    res.json(inv);
});

module.exports = router;