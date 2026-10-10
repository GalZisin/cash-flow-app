const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSummary, simulateScenario } = require('../services/cashflow-engine');
const { sampleCashFlow, monthKey } = require('./fixtures');

test('buildSummary returns an error marker when there is no cash flow', () => {
    assert.deepEqual(buildSummary({ cashFlow: null }), { error: 'No cashflow data' });
});

test('buildSummary computes averages, balance and a 6-month forecast', () => {
    const cashFlow = sampleCashFlow();
    const summary = buildSummary({ cashFlow, installments: [], investments: [], defaults: { income: 20000 } });

    assert.equal(summary.periodCovered.months, 12);
    assert.equal(summary.income.average, 20000);
    assert.equal(summary.income.defaults, 20000);
    assert.equal(summary.expenses.averageTotal, 15000);
    assert.equal(summary.monthlySavingsAvg, 5000);
    assert.equal(summary.forecast.length, 6);
    // current month ending balance: start 50,000 + 3 months * 5,000 (two past months + current)
    assert.equal(summary.currentBalance, 65000);
    assert.equal(summary.forecast[0].projectedBalance, 70000);
    assert.equal(summary.forecast[0].month, monthKey(1));
});

test('buildSummary lists only active loans and installments', () => {
    const installments = [
        { name: 'TV', totalAmount: 6000, monthlyPayment: 500, installmentsCount: 12, manualPaidCount: 3, paymentType: 'manual' },
        { name: 'Done', totalAmount: 1200, monthlyPayment: 100, installmentsCount: 12, manualPaidCount: 12, paymentType: 'manual' },
        { name: 'Loan', totalAmount: 50000, monthlyPayment: 1000, installmentsCount: 50, manualPaidCount: 10, loanComponents: [{}] }
    ];
    const summary = buildSummary({ cashFlow: sampleCashFlow(), installments, investments: [] });

    assert.deepEqual(summary.installments.map(i => i.name), ['TV']);
    assert.equal(summary.installments[0].remainingPayments, 9);
    assert.deepEqual(summary.loans.map(l => l.name), ['Loan']);
    assert.equal(summary.loans[0].remainingBalance, 40000);
});

test('simulateScenario deducts the purchase in the first forecast month on/after the date', () => {
    const summary = buildSummary({ cashFlow: sampleCashFlow(), installments: [], investments: [] });
    const date = `${monthKey(2)}-15`;
    const result = simulateScenario({ summary, description: 'Bike', amount: 10000, date });

    assert.equal(result.forecast.length, 6);
    assert.equal(result.forecast[0].note, null);
    assert.match(result.forecast[1].note, /Bike/);
    assert.equal(result.forecast[1].projectedBalance, summary.forecast[1].projectedBalance - 10000);
    assert.equal(result.forecast[2].projectedBalance, result.forecast[1].projectedBalance + summary.monthlySavingsAvg);
    assert.equal(result.balanceAfterPurchase, result.forecast[1].projectedBalance);
    assert.equal(result.forecast[0].projectedBalance, summary.forecast[0].projectedBalance, 'months before the purchase are unchanged');
});

test('simulateScenario with a purchase beyond the forecast window leaves the forecast unchanged', () => {
    const summary = buildSummary({ cashFlow: sampleCashFlow(), installments: [], investments: [] });
    const result = simulateScenario({ summary, description: 'House', amount: 500000, date: `${monthKey(24)}-01` });
    assert.deepEqual(result.forecast.map(f => f.projectedBalance), summary.forecast.map(f => f.projectedBalance));
    assert.equal(result.balanceAfterPurchase, summary.currentBalance - 500000);
});
