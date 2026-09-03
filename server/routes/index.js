const express = require('express');
const router = express.Router();

// Import refactored route modules
const cashFlowRoutes = require('./cashFlow.routes');
const installmentsRoutes = require('./installments.routes');
const investmentsRoutes = require('./investments.routes');
const conversationsRoutes = require('./conversations.routes');
const aiReportsRoutes = require('./aiReports.routes');
const budgetRoutes = require('./budget.routes');
const goalsRoutes = require('./goals.routes');

console.log('📌 Mounting goals routes on /goals');

// Import legacy AI routes (not refactored yet)
const aiRoutes = require('../ai.routes');

// Mount routes
router.use((req, res, next) => {
    console.log(`🔍 Router handling: ${req.method} ${req.path}`);
    next();
});

router.use('/goals', goalsRoutes);
router.use('/budget', budgetRoutes);
router.use('/installments', installmentsRoutes);
router.use('/investments', investmentsRoutes);
router.use('/conversations', conversationsRoutes);
router.use('/ai-reports', aiReportsRoutes);
router.use('/', cashFlowRoutes);

console.log('✅ All routes mounted');

// Legacy AI routes
router.use('/ai', aiRoutes);

module.exports = router;
