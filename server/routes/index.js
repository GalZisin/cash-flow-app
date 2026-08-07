const express = require('express');
const router = express.Router();

// Import refactored route modules
const cashFlowRoutes = require('./cashFlow.routes');
const installmentsRoutes = require('./installments.routes');
const investmentsRoutes = require('./investments.routes');
const conversationsRoutes = require('./conversations.routes');
const aiReportsRoutes = require('./aiReports.routes');

// Import legacy AI routes (not refactored yet)
const aiRoutes = require('../ai.routes');

// Mount routes
router.use('/', cashFlowRoutes);
router.use('/installments', installmentsRoutes);
router.use('/investments', investmentsRoutes);
router.use('/conversations', conversationsRoutes);
router.use('/ai-reports', aiReportsRoutes);

// Legacy AI routes
router.use('/ai', aiRoutes);

module.exports = router;
