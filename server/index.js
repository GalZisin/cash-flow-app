const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'cash-flow-data-miluim.json');
const INVESTMENTS_FILE = path.join(__dirname, 'investments.json');
const DEFAULTS_FILE = path.join(__dirname, 'cash-flow-defaults.json');
const INSTALLMENTS_FILE = path.join(__dirname, 'installments.json');

app.use(cors());
app.use(express.json());

// --- Installments helpers ---
function readInstallments() {
  if (!fs.existsSync(INSTALLMENTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(INSTALLMENTS_FILE, { encoding: 'utf8' }));
}

function writeInstallments(data) {
  fs.writeFileSync(INSTALLMENTS_FILE, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}

// --- Installments API ---
app.get('/api/installments', (req, res) => {
  res.json(readInstallments());
});

app.post('/api/installments', (req, res) => {
  const items = readInstallments();
  const item = {
    id: Date.now().toString(),
    name: req.body.name || '',
    totalAmount: Number(req.body.totalAmount) || 0,
    downPayment: Number(req.body.downPayment) || 0,
    monthlyPayment: Number(req.body.monthlyPayment) || 0,
    installmentsCount: Number(req.body.installmentsCount) || 0,
    startDate: req.body.startDate || new Date().toISOString().slice(0, 10),
    color: req.body.color || '#4f6ef7',
    notes: req.body.notes || '',
    manualPaidCount: Number(req.body.manualPaidCount) || 0,
    lastManualPaymentDate: req.body.lastManualPaymentDate || undefined
  };
  items.push(item);
  writeInstallments(items);
  res.json(item);
});

app.put('/api/installments/:id', (req, res) => {
  const items = readInstallments();
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  items[idx] = {
    ...items[idx],
    name: req.body.name ?? items[idx].name,
    totalAmount: req.body.totalAmount !== undefined ? Number(req.body.totalAmount) : items[idx].totalAmount,
    downPayment: req.body.downPayment !== undefined ? Number(req.body.downPayment) : items[idx].downPayment,
    monthlyPayment: req.body.monthlyPayment !== undefined ? Number(req.body.monthlyPayment) : items[idx].monthlyPayment,
    installmentsCount: req.body.installmentsCount !== undefined ? Number(req.body.installmentsCount) : items[idx].installmentsCount,
    startDate: req.body.startDate ?? items[idx].startDate,
    color: req.body.color ?? items[idx].color,
    notes: req.body.notes ?? items[idx].notes,
    manualPaidCount: req.body.manualPaidCount !== undefined ? Number(req.body.manualPaidCount) : items[idx].manualPaidCount, // Ensure it's a number
    lastManualPaymentDate: req.body.lastManualPaymentDate ?? items[idx].lastManualPaymentDate,
    id: req.params.id
  };
  writeInstallments(items);
  res.json(items[idx]);
});

app.delete('/api/installments/:id', (req, res) => {
  const items = readInstallments().filter(i => i.id !== req.params.id);
  writeInstallments(items);
  res.json({ success: true });
});

// --- Cash Flow Defaults helpers ---
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
app.get('/api/cash-flow', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json(null);
  const data = JSON.parse(fs.readFileSync(DATA_FILE, { encoding: 'utf8' }));
  data.months = data.months.map(m => ({ loanPayment: 0, ...m }));
  res.json(data);
});

app.post('/api/cash-flow', (req, res) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), { encoding: 'utf8' });
  res.json({ success: true });
});

// --- Cash Flow Defaults ---
app.get('/api/cash-flow-defaults', (req, res) => {
  res.json(readDefaults());
});

app.post('/api/cash-flow-defaults', (req, res) => {
  const defaults = {
    income: Number(req.body.income) || 0,
    mortgagePayment: Number(req.body.mortgagePayment) || 0,
    loanPayment: Number(req.body.loanPayment) || 0,
    regularExpenses: (req.body.regularExpenses || []).map(e => ({
      description: e.description ?? '',
      amount: Number(e.amount) || 0
    })),
    specialExpenses: (req.body.specialExpenses || []).map(e => ({
      description: e.description ?? '',
      amount: Number(e.amount) || 0
    }))
  };
  writeDefaults(defaults);
  res.json(defaults);
});

// --- Investments ---
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
    inv.snapshots.forEach(s => {
      if (!s.id) { s.id = Date.now().toString() + Math.random().toString(36).slice(2, 7); dirty = true; }
    });
    inv.transactions.forEach(t => {
      if (!t.id) { t.id = Date.now().toString() + Math.random().toString(36).slice(2, 7); dirty = true; }
    });
  });

  if (dirty) writeInvestments(investments);
  return investments;
}

function writeInvestments(data) {
  fs.writeFileSync(INVESTMENTS_FILE, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}

app.get('/api/investments', (req, res) => {
  const investments = readInvestments();
  investments.forEach(inv => sortInvestment(inv)); // 🔥
  res.json(investments);
});

app.post('/api/investments', (req, res) => {
  const investments = readInvestments();
  const investment = { id: Date.now().toString(), snapshots: [], transactions: [], ...req.body };
  investments.push(investment);
  writeInvestments(investments);
  res.json(investment);
});

app.put('/api/investments/:id', (req, res) => {
  const investments = readInvestments();
  const idx = investments.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  investments[idx] = { ...investments[idx], ...req.body, id: req.params.id };
  writeInvestments(investments);
  res.json(investments[idx]);
});

// Snapshot routes
app.post('/api/investments/:id/snapshot', (req, res) => {
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

  sortInvestment(inv); // 🔥 כאן
  writeInvestments(investments);
  res.json(inv);
});

app.put('/api/investments/:id/snapshot/:snapshotId', (req, res) => {
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

app.delete('/api/investments/:id/snapshot/:snapshotId', (req, res) => {
  const investments = readInvestments();
  const inv = investments.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  inv.snapshots = inv.snapshots.filter(s => s.id !== req.params.snapshotId);
  writeInvestments(investments);
  res.json(inv);
});

// Transaction routes
app.post('/api/investments/:id/transaction', (req, res) => {
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
  sortInvestment(inv); // 🔥 כאן
  writeInvestments(investments);
  res.json(inv);
});

app.put('/api/investments/:id/transaction/:txId', (req, res) => {
  if (!req.body.date || req.body.amount == null || !req.body.type) { //if (!req.body.date || isNaN(Number(req.body.value)))  יותר קשוח
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

  sortInvestment(inv); // 🔥 כאן
  writeInvestments(investments);
  res.json(inv);
});

app.delete('/api/investments/:id/transaction/:txId', (req, res) => {
  const investments = readInvestments();
  const inv = investments.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });

  inv.transactions = inv.transactions.filter(t => t.id !== req.params.txId);

  sortInvestment(inv);
  writeInvestments(investments);
  res.json(inv);
});

app.delete('/api/investments/:id', (req, res) => {
  let investments = readInvestments();
  investments = investments.filter(i => i.id !== req.params.id);
  writeInvestments(investments);
  res.json(investments); // 🔥 תחזיר את הרשימה המעודכנת
});

// --- Simulation Rules Routes ---
app.post('/api/investments/:id/simulation-rule', (req, res) => {
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

app.put('/api/investments/:id/simulation-rule/:ruleId', (req, res) => {
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

app.delete('/api/investments/:id/simulation-rule/:ruleId', (req, res) => {
  const investments = readInvestments();
  const inv = investments.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });

  inv.simulationRules = inv.simulationRules.filter(r => r.id !== req.params.ruleId);
  writeInvestments(investments);
  res.json(inv);
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

function sortInvestment(inv) {
  if (inv.transactions) {
    inv.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  if (inv.snapshots) {
    inv.snapshots.sort((a, b) => new Date(a.date) - new Date(b.date));
  }
}
