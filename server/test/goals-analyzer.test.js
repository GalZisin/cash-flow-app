const { test } = require('node:test');
const assert = require('node:assert/strict');
const analyzer = require('../services/goals-analyzer.service');
const { sampleCashFlow, sampleGoal, monthKey } = require('./fixtures');

test('analyzeGoalSync returns an empty analysis when there is no cash flow', () => {
    const result = analyzer.analyzeGoalSync(sampleGoal(), null, []);
    assert.equal(result.status, 'NOT_ACHIEVABLE');
    assert.equal(result.achievable, false);
    assert.deepEqual(result.reasons, ['אין נתוני תזרים מזומנים']);
});

test('a small goal with a healthy balance is ACHIEVABLE', () => {
    // balance now 65,000; +5,000/month for 6 months = 95,000; minus 20,000 target => 75,000 > 65,000 buffer
    const goal = sampleGoal({ targetAmount: 20000, targetDate: monthKey(6) });
    const result = analyzer.analyzeGoalSync(goal, sampleCashFlow(), [goal]);

    assert.equal(result.status, 'ACHIEVABLE');
    assert.equal(result.achievable, true);
    assert.equal(result.currentBalance, 65000);
    assert.equal(result.projectedBalance, 75000);
    assert.equal(result.monthsUntilGoal, 6);
    assert.equal(result.monthlySavingsNeeded, 0);
    assert.equal(result.suggestedDate, null);
});

test('a goal that drops the balance below the minimum buffer is NOT_ACHIEVABLE with a suggested date', () => {
    // 95,000 - 60,000 = 35,000 < 61,200 minimum buffer
    const goal = sampleGoal({ targetAmount: 60000, targetDate: monthKey(6) });
    const result = analyzer.analyzeGoalSync(goal, sampleCashFlow(), [goal]);

    assert.equal(result.status, 'NOT_ACHIEVABLE');
    assert.equal(result.projectedBalance, 35000);
    assert.ok(result.monthlySavingsNeeded > 0);
    assert.ok(result.suggestedDate, 'a later date is suggested');
    assert.ok(result.suggestedDate > goal.targetDate);
    assert.match(result.statusMessage, /לא ריאלי/);
});

test('other goals are deducted from the projection and reported as impact', () => {
    const goal = sampleGoal({ id: 'g1', targetAmount: 20000, targetDate: monthKey(6) });
    const later = sampleGoal({ id: 'g2', name: 'Trip', targetAmount: 15000, targetDate: monthKey(8) });
    const earlier = sampleGoal({ id: 'g3', name: 'Phone', targetAmount: 5000, targetDate: monthKey(3) });

    const result = analyzer.analyzeGoalSync(goal, sampleCashFlow(), [goal, later, earlier]);
    // 95,000 - 20,000 (own) - 5,000 (earlier goal, inside the window) = 70,000
    assert.equal(result.projectedBalance, 70000);
    assert.deepEqual(result.impactOnOtherGoals[0], 'עלול להשפיע על 1 יעדים נוספים');
});

test('loan goals use the down payment at target and add monthly payments afterwards', () => {
    const goal = sampleGoal({
        targetAmount: 100000,
        targetDate: monthKey(3),
        loanDetails: { loanAmount: 80000, downPayment: 20000, monthlyPayment: 2000, months: 40 }
    });
    const result = analyzer.analyzeGoalSync(goal, sampleCashFlow(), [goal]);

    assert.equal(result.requiredAtTarget, 20000);
    // 65,000 + 3 * 5,000 - 20,000 down payment - 2,000 loan payment in the target month = 58,000
    assert.equal(result.projectedBalance, 58000);
    assert.ok(result.reasons.some(r => /הלוואה/.test(r)));
});

test('month helpers', () => {
    assert.equal(analyzer.normalizeMonth('2026-03-15T00:00:00.000Z'), '2026-03');
    assert.equal(analyzer.normalizeMonth('bad'), null);
    assert.equal(analyzer.calculateMonthsDifference('2026-01', '2027-03'), 14);
    assert.equal(analyzer.addMonths('2026-11', 3), '2027-02');
});
