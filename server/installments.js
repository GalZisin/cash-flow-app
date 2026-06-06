const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const INSTALLMENTS_FILE = path.join(__dirname, 'installments.json');

function readInstallments() {
    if (!fs.existsSync(INSTALLMENTS_FILE)) return [];
    const rawData = fs.readFileSync(INSTALLMENTS_FILE, { encoding: 'utf8' });
    const items = JSON.parse(rawData);
    return items.map(item => ({
        ...item,
        loanComponents: item.loanComponents || [] // Ensure loanComponents is always an array
    }));
}

function writeInstallments(data) {
    fs.writeFileSync(INSTALLMENTS_FILE, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}

router.get('/', (req, res) => {
    res.json(readInstallments());
});

router.post('/', (req, res) => {
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
        lastManualPaymentDate: req.body.lastManualPaymentDate || undefined,
        loanComponents: req.body.loanComponents || [],
        payments: req.body.payments || []
    };
    items.push(item);
    writeInstallments(items);
    res.json(item);
});

router.put('/:id', (req, res) => {
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
        manualPaidCount: req.body.manualPaidCount !== undefined ? Number(req.body.manualPaidCount) : items[idx].manualPaidCount,
        lastManualPaymentDate: req.body.lastManualPaymentDate ?? items[idx].lastManualPaymentDate,
        loanComponents: req.body.loanComponents ?? items[idx].loanComponents,
        payments: req.body.payments ?? items[idx].payments,
        id: req.params.id
    };
    writeInstallments(items);
    res.json(items[idx]);
});

router.delete('/:id', (req, res) => {
    const items = readInstallments().filter(i => i.id !== req.params.id);
    writeInstallments(items);
    res.json({ success: true });
});

module.exports = router;