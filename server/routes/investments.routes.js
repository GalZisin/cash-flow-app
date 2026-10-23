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

// Child items: /:id/snapshot, /:id/transaction, /:id/simulation-rule (each answers with the updated investment)
const CHILD_PATHS = { snapshot: 'snapshot', transaction: 'transaction', rule: 'simulation-rule' };

for (const [kind, path] of Object.entries(CHILD_PATHS)) {
    router.post(`/:id/${path}`, asyncHandler(async (req, res) => {
        res.json(await investmentsService.addChild(kind, req.params.id, req.body));
    }));

    router.put(`/:id/${path}/:childId`, asyncHandler(async (req, res) => {
        res.json(await investmentsService.updateChild(kind, req.params.id, req.params.childId, req.body));
    }));

    router.delete(`/:id/${path}/:childId`, asyncHandler(async (req, res) => {
        res.json(await investmentsService.deleteChild(kind, req.params.id, req.params.childId));
    }));
}

module.exports = router;
