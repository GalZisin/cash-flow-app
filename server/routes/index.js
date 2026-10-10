const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Import refactored route modules
const cashFlowRoutes = require('./cashFlow.routes');
const installmentsRoutes = require('./installments.routes');
const investmentsRoutes = require('./investments.routes');
const conversationsRoutes = require('./conversations.routes');
const aiReportsRoutes = require('./aiReports.routes');
const budgetRoutes = require('./budget.routes');
const goalsRoutes = require('./goals.routes');

const aiRoutes = require('./ai.routes');

router.use('/goals', goalsRoutes);
router.use('/budget', budgetRoutes);
router.use('/installments', installmentsRoutes);
router.use('/investments', investmentsRoutes);
router.use('/conversations', conversationsRoutes);
router.use('/ai-reports', aiReportsRoutes);
router.use('/', cashFlowRoutes);

router.use('/ai', aiRoutes);

logger.debug('All /api routes mounted');

module.exports = router;
