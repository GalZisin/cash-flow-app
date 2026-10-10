/**
 * Verifies the "analyse all goals" optimisation: one context load, one batched write.
 * The repository and analyzer singletons are stubbed, so no database is needed.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const goalsService = require('../services/goals.service');
const goalsAnalyzer = require('../services/goals-analyzer.service');
const goalsRepository = require('../repositories/goals.repository');
const { sampleCashFlow, sampleGoal, monthKey } = require('./fixtures');

test('analyzeAllGoals loads the context once and writes every goal in a single batch', async (t) => {
    const goals = [
        sampleGoal({ id: 'a', targetAmount: 10000, targetDate: monthKey(4) }),
        sampleGoal({ id: 'b', name: 'B', targetAmount: 12000, targetDate: monthKey(7) }),
        sampleGoal({ id: 'c', name: 'C', targetAmount: 90000, targetDate: monthKey(9) })
    ];
    const loadContext = t.mock.method(goalsAnalyzer, 'loadContext', async () => ({ cashFlowData: sampleCashFlow(), allGoals: goals }));
    const updateMany = t.mock.method(goalsRepository, 'updateMany', async (list) => list.length);
    const singleUpdate = t.mock.method(goalsRepository, 'update', async () => { throw new Error('per-goal update must not be used'); });

    const result = await goalsService.analyzeAllGoals();

    assert.deepEqual(result, { analyzed: 3 });
    assert.equal(loadContext.mock.callCount(), 1, 'cash flow and goals are read once');
    assert.equal(updateMany.mock.callCount(), 1, 'all goals are written in one transaction');
    assert.equal(singleUpdate.mock.callCount(), 0);

    const written = updateMany.mock.calls[0].arguments[0];
    assert.deepEqual(written.map(g => g.id), ['a', 'b', 'c']);
    for (const g of written) {
        assert.ok(g.analysis && g.analysis.status, 'each goal gets an analysis');
        assert.ok(g.lastAnalyzed);
    }
    assert.equal(written[0].analysis.status, 'ACHIEVABLE');
    assert.equal(written[2].analysis.status, 'NOT_ACHIEVABLE');
});

test('analyzeAllGoals with no active goals does not touch the database', async (t) => {
    t.mock.method(goalsAnalyzer, 'loadContext', async () => ({ cashFlowData: sampleCashFlow(), allGoals: [] }));
    const updateMany = t.mock.method(goalsRepository, 'updateMany', async (list) => list.length);

    const result = await goalsService.analyzeAllGoals();
    assert.deepEqual(result, { analyzed: 0 });
    assert.equal(updateMany.mock.callCount(), 1);
    assert.deepEqual(updateMany.mock.calls[0].arguments[0], []);
});

test('validateGoalData rejects bad input with a ValidationError', () => {
    assert.throws(() => goalsService.validateGoalData({ name: '', type: 'PURCHASE', targetAmount: 1, targetDate: '2026-01' }), /name is required/);
    assert.throws(() => goalsService.validateGoalData({ name: 'x', type: 'PURCHASE', targetAmount: 0, targetDate: '2026-01' }), /positive/);
    assert.throws(() => goalsService.validateGoalData({ name: 'x', type: 'PURCHASE', targetAmount: 5, targetDate: '01/2026' }), /YYYY-MM/);
    assert.doesNotThrow(() => goalsService.validateGoalData({ name: 'x', type: 'PURCHASE', targetAmount: 5, targetDate: '2026-01' }));
});
