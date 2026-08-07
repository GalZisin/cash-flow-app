const express = require('express');
const router = express.Router();
const installmentsService = require('../services/installments.service');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/installments
router.get('/', asyncHandler(async (req, res) => {
    const installments = await installmentsService.getAll();
    res.json(installments);
}));

// GET /api/installments/:id
router.get('/:id', asyncHandler(async (req, res) => {
    const installment = await installmentsService.getById(req.params.id);
    res.json(installment);
}));

// POST /api/installments
router.post('/', asyncHandler(async (req, res) => {
    const installment = await installmentsService.create(req.body);
    res.status(201).json(installment);
}));

// PUT /api/installments/:id
router.put('/:id', asyncHandler(async (req, res) => {
    const installment = await installmentsService.update(req.params.id, req.body);
    res.json(installment);
}));

// DELETE /api/installments/:id
router.delete('/:id', asyncHandler(async (req, res) => {
    const result = await installmentsService.delete(req.params.id);
    res.json(result);
}));

module.exports = router;
