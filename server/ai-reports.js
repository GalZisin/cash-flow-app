const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data', 'ai-reports.json');

// וודוא קיום תיקיית הנתונים והקובץ
const ensureFile = () => {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_PATH)) {
        fs.writeFileSync(DATA_PATH, JSON.stringify([], null, 2));
    }
};

// קבלת כל הדו"חות (מסודרים מהחדש לישן)
router.get('/', (req, res) => {
    ensureFile();
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    res.json(data);
});

// שמירת דו"ח חדש
router.post('/', (req, res) => {
    ensureFile();
    const reports = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

    const newReport = {
        id: Date.now().toString(),
        ...req.body
    };

    reports.unshift(newReport); // הוספה לראש המערך כדי שהדוחות החדשים יופיעו ראשונים
    fs.writeFileSync(DATA_PATH, JSON.stringify(reports, null, 2));
    res.status(201).json(newReport);
});

module.exports = router;