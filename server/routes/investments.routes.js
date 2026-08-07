const express = require('express');
const router = express.Router();
const investmentsService = require('../services/investments.service');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/investments
router.get('/', asyncHandler(async (req, res) => {
    const investments = await investmentsService.getAll();
    res.json(investments);
}));

// GET /api/investments/:id
router.get('/:id', asyncHandler(async (req, res) => {
    const investment = await investmentsService.getById(req.params.id);
    res.json(investment);
}));

// POST /api/investments
router.post('/', asyncHandler(async (req, res) => {
    const investment = await investmentsService.create(req.body);
    res.status(201).json(investment);
}));

// PUT /api/investments/:id
router.put('/:id', asyncHandler(async (req, res) => {
    const investment = await investmentsService.update(req.params.id, req.body);
    res.json(investment);
}));

// DELETE /api/investments/:id
router.delete('/:id', asyncHandler(async (req, res) => {
    const result = await investmentsService.delete(req.params.id);
    res.json(result);
}));

module.exports = router;
