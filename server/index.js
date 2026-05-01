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
  return JSON.parse(fs.readFileSync(INVESTMENTS_FILE, { encoding: 'utf8' }));
}

function writeInvestments(data) {
  fs.writeFileSync(INVESTMENTS_FILE, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}

app.get('/api/investments', (req, res) => {
  res.json(readInvestments());
});

app.post('/api/investments', (req, res) => {
  const investments = readInvestments();
  const investment = { id: Date.now().toString(), snapshots: [], ...req.body };
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

app.post('/api/investments/:id/snapshot', (req, res) => {
  const investments = readInvestments();
  const inv = investments.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  inv.snapshots.push(req.body);
  writeInvestments(investments);
  res.json(inv);
});

app.delete('/api/investments/:id', (req, res) => {
  let investments = readInvestments();
  investments = investments.filter(i => i.id !== req.params.id);
  writeInvestments(investments);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
