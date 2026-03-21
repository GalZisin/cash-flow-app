const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'cash-flow-data.json');

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
