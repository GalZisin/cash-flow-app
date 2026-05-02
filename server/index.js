const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'cash-flow-data.json');
const INVESTMENTS_FILE = path.join(__dirname, 'investments.json');

app.use(cors());
app.use(express.json());

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

// --- Investments ---
function readInvestments() {
  if (!fs.existsSync(INVESTMENTS_FILE)) return [];
  const data = JSON.parse(fs.readFileSync(INVESTMENTS_FILE, { encoding: 'utf8' }));
  // migrate old investments that lack transactions array
  return data.map(inv => ({
    transactions: [],
    snapshots: [],
    ...inv
  }));
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
  const snap = inv.snapshots.find(s => s.id === req.params.snapshotId);
  if (!snap) return res.status(404).json({ error: 'Snapshot not found' });

  snap.date = req.body.date;
  snap.value = Number(req.body.value);

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
  inv.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
  ortInvestment(inv); // 🔥 כאן
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

  inv.transactions[index] = {
    ...inv.transactions[index],
    ...req.body
  };

  sortInvestment(inv); // 🔥 כאן
  writeInvestments(investments);
  res.json(inv);
});

app.delete('/api/investments/:id/transaction/:txId', (req, res) => {
  if (!req.body.date || req.body.amount == null || !req.body.type) { //if (!req.body.date || isNaN(Number(req.body.value)))  יותר קשוח
    return res.status(400).json({ error: 'Invalid transaction' });
  }
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

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

function sortInvestment(inv) {
  if (inv.transactions) {
    inv.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  if (inv.snapshots) {
    inv.snapshots.sort((a, b) => new Date(a.date) - new Date(b.date));
  }
}
