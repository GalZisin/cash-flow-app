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

test('buildSummary: last 12 months in detail, older history by year, the plan ahead by year for up to 5 years', () => {
    // 30 past months, the current one and 80 planned months, each saving 5,000
    const months = [];
    let balance = 0;
    for (let i = -30; i <= 80; i++) {
        balance += 5000;
        months.push({
            month: `${monthKey(i)}-01T00:00:00.000Z`, startingBalance: balance - 5000, endingBalance: balance,
            income: 20000, additionalIncomes: [], mortgagePayment: 6000, loanPayment: 1000, installmentsPayment: 0,
            regularExpenses: [{ description: 'food', amount: 8000 }], specialExpenses: []
        });
    }
    const summary = buildSummary({ cashFlow: { months } });
    const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);

    assert.equal(summary.monthlySnapshots, undefined, 'no per-month list of the whole cash flow');
    assert.equal(summary.recentMonths.length, 12);
    assert.equal(summary.recentMonths[0].month, monthKey(-11));
    assert.deepEqual(summary.recentMonths[11], { month: monthKey(0), income: 20000, expenses: 15000, endingBalance: 31 * 5000 });

    assert.equal(sum(summary.pastYears, 'months'), 19, 'months -30 .. -12');
    assert.equal(sum(summary.pastYears, 'income'), 19 * 20000);
    assert.equal(summary.pastYears.at(-1).endingBalance, 19 * 5000);

    assert.equal(sum(summary.plannedYears, 'months'), 60, 'only 5 years of the 80 planned months');
    assert.equal(sum(summary.plannedYears, 'expenses'), 60 * 15000);
    assert.equal(summary.plannedYears[0].year, Number(monthKey(1).slice(0, 4)));
    assert.equal(summary.plannedYears.at(-1).endingBalance, (31 + 60) * 5000);
    assert.ok(summary.plannedYears.length <= 6, 'calendar years: a partial first and last year at most');
});

test('buildSummary lists only active loans and installments (payments count as paid by due date)', () => {
    const today = '2026-04-10';
    const installments = [
        // 4 payments due by today (Jan 10 .. Apr 10, inclusive) -> 8 remaining
        { name: 'TV', totalAmount: 6000, monthlyPayment: 500, installmentsCount: 12, startDate: '2026-01-10', manualPaidCount: 0, paymentType: 'manual' },
        { name: 'Done', totalAmount: 1200, monthlyPayment: 100, installmentsCount: 12, startDate: '2025-01-01', paymentType: 'manual' },
        // marked as fully paid manually, but only 1 payment was due -> still active
        { name: 'Early', totalAmount: 1000, monthlyPayment: 100, installmentsCount: 10, startDate: '2026-04-01', manualPaidCount: 10, paymentType: 'manual' },
        {
            name: 'Loan', totalAmount: 50000, monthlyPayment: 1000, installmentsCount: 50, manualPaidCount: 40,
            loanComponents: [{ id: 'L', monthlyPayment: 1000, installmentsCount: 50, startDate: '2025-07-01', paidCount: 0 }]
        },
        {
            name: 'Paid off', paymentType: 'loan', totalAmount: 5000, monthlyPayment: 500,
            loanComponents: [{ id: 'P', monthlyPayment: 500, installmentsCount: 10, startDate: '2026-01-01', payoffDate: '2026-03', payoffAmount: 3500 }]
        }
    ];
    const summary = buildSummary({ cashFlow: sampleCashFlow(), installments, investments: [], today });

    assert.deepEqual(summary.installments.map(i => i.name), ['TV', 'Early']);
    assert.equal(summary.installments[0].remainingPayments, 8);
    assert.equal(summary.installments[1].remainingPayments, 9);
    assert.deepEqual(summary.loans.map(l => l.name), ['Loan']);
    // Jul 2025 .. Apr 2026 = 10 payments paid
    assert.equal(summary.loans[0].remainingPayments, 40);
    assert.equal(summary.loans[0].remainingBalance, 40000);
});

test('buildSummary milestone installments: remaining milestones, amount and next milestone by date and overrides', () => {
    const installments = [{
        name: 'Flat', paymentType: 'milestone', totalAmount: 600, downPayment: 0, startDate: '2026-01-01',
        milestones: [
            { id: 'a', description: 'A', amount: 100, date: '2026-01' },
            { id: 'b', description: 'B', amount: 200, date: '2026-06' },
            { id: 'c', description: 'C', amount: 300, date: '2026-09' }
        ],
        milestonePayments: [],
        paymentOverrides: [{ key: 'ms:b', status: 'paid', date: '2026-03-01' }]
    }, {
        name: 'All due', paymentType: 'milestone', totalAmount: 100,
        milestones: [{ id: 'z', amount: 100, date: '2026-02' }]
    }];
    const summary = buildSummary({ cashFlow: sampleCashFlow(), installments, investments: [], today: '2026-04-10' });

    assert.deepEqual(summary.installments.map(i => i.name), ['Flat']);
    const flat = summary.installments[0];
    assert.equal(flat.paymentType, 'milestone');
    assert.equal(flat.remainingMilestones, 1);
    assert.equal(flat.remainingAmount, 300);
    assert.equal(flat.nextMilestone.id, 'c');
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

test('buildSummary loans carry components, interest, dates and the next payment', () => {
    const installments = [{
        name: 'Car', paymentType: 'loan', totalAmount: 30000, startDate: '2026-01-01',
        loanComponents: [
            { id: 'A', description: 'Bank', totalLoanAmount: 20000, monthlyPayment: 1000, installmentsCount: 20, startDate: '2026-01-01', interestRate: 5.5 },
            { id: 'B', description: 'Fund', totalLoanAmount: 5000, monthlyPayment: 500, installmentsCount: 10, startDate: '2026-02-01', payoffDate: '2026-06', payoffAmount: 2000 }
        ]
    }];
    const [loan] = buildSummary({ cashFlow: sampleCashFlow(), installments, today: '2026-04-10' }).loans;

    assert.equal(loan.startDate, '2026-01-01');
    assert.equal(loan.endDate, '2027-08-01');
    assert.deepEqual(loan.nextPayment, { date: '2026-05-01', amount: 1000 });
    // A: Jan..Apr paid (4); B: Feb..Apr paid (3)
    assert.equal(loan.paidPayments, 7);
    assert.deepEqual(loan.components, [
        { description: 'Bank', amount: 20000, monthlyPayment: 1000, interestRate: 5.5, startDate: '2026-01-01', endDate: '2027-08-01', remainingPayments: 16, payoffDate: undefined, payoffAmount: undefined },
        { description: 'Fund', amount: 5000, monthlyPayment: 500, interestRate: undefined, startDate: '2026-02-01', endDate: '2026-06-01', remainingPayments: 2, payoffDate: '2026-06', payoffAmount: 2000 }
    ]);
});

test('buildSummary installments: manual end date / next payment, milestone remaining schedule', () => {
    const installments = [
        { name: 'TV', paymentType: 'manual', totalAmount: 6000, monthlyPayment: 500, installmentsCount: 12, startDate: '2026-01-10' },
        {
            name: 'Kitchen', paymentType: 'milestone', totalAmount: 600,
            milestones: [
                { id: 'a', description: 'A', amount: 100, date: '2026-01' },
                { id: 'b', description: 'B', amount: 200, date: '2026-06' },
                { id: 'c', amount: 300, date: '2026-09' }
            ]
        }
    ];
    const [tv, kitchen] = buildSummary({ cashFlow: sampleCashFlow(), installments, today: '2026-04-10' }).installments;

    assert.equal(tv.endDate, '2026-12-10');
    assert.deepEqual(tv.nextPayment, { date: '2026-05-10', amount: 500 });
    assert.equal(tv.remainingAmount, 4000);
    assert.deepEqual(kitchen.remainingSchedule, [
        { date: '2026-06-01', amount: 200, description: 'B' },
        { date: '2026-09-01', amount: 300, description: undefined }
    ]);
});

test('buildSummary averages expenses per category (past months) and lists upcoming special expenses', () => {
    const cashFlow = sampleCashFlow();
    cashFlow.months.forEach(m => {
        m.regularExpenses = [{ description: 'food', amount: 3000, category: 'FOOD' }, { description: 'misc', amount: 600 }];
    });
    cashFlow.months[0].specialExpenses = [{ description: 'Flight', amount: 3600, category: 'VACATION' }];
    cashFlow.months[4].specialExpenses = [{ description: 'Insurance', amount: 4800, category: 'CAR' }];
    const summary = buildSummary({ cashFlow });

    // 3 months up to the current one: 2 past + current
    assert.deepEqual(summary.expensesByCategory, {
        from: monthKey(-2), to: monthKey(0), months: 3,
        avgMonthly: { FOOD: 3000, VACATION: 1200, OTHER: 600 }
    });
    assert.deepEqual(summary.upcomingSpecialExpenses, [
        { month: monthKey(2), description: 'Insurance', category: 'CAR', amount: 4800 }
    ]);
    assert.equal(summary.asOf.length, 10);
});

test('buildSummary investments: latest value by date, 12-month change and net deposits', () => {
    const investments = [{
        name: 'Fund', type: 'fund', initialValue: 80000, annualReturn: 6,
        snapshots: [
            { date: '2026-06-30', value: 110000 },
            { date: '2025-01-31', value: 90000 },
            { date: '2025-06-30', value: 100000 }
        ],
        transactions: [{ date: '2025-03-01', amount: 5000, type: 'deposit' }, { date: '2025-09-01', amount: 1000, type: 'withdraw' }]
    }, { name: 'Empty', type: 'other' }];
    const [fund, empty] = buildSummary({ cashFlow: sampleCashFlow(), investments }).investments;

    assert.equal(fund.currentValue, 110000);
    assert.equal(fund.lastUpdated, '2026-06-30');
    assert.equal(fund.expectedAnnualReturn, 6);
    assert.deepEqual(fund.change, { since: '2025-06-30', amount: 10000, percent: 10 });
    assert.equal(fund.deposits, 5000);
    assert.equal(fund.withdrawals, 1000);
    assert.equal(empty.currentValue, null);
    assert.equal(empty.change, undefined);
});
