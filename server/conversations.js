const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'conversations.json');

function read() {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function write(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
}

// GET /api/conversations
router.get('/', (req, res) => res.json(read()));

// POST /api/conversations — create new
router.post('/', (req, res) => {
  const items = read();
  const item = {
    id: Date.now().toString(),
    title: req.body.title || 'שיחה חדשה',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: req.body.messages || []
  };
  items.unshift(item);
  write(items);
  res.json(item);
});

// PUT /api/conversations/:id — update messages + title
router.put('/:id', (req, res) => {
  const items = read();
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  items[idx] = {
    ...items[idx],
    title: req.body.title ?? items[idx].title,
    messages: req.body.messages ?? items[idx].messages,
    updatedAt: new Date().toISOString()
  };
  write(items);
  res.json(items[idx]);
});

// DELETE /api/conversations/:id
router.delete('/:id', (req, res) => {
  write(read().filter(i => i.id !== req.params.id));
  res.json({ success: true });
});

module.exports = router;
