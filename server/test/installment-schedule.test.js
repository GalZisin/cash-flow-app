const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSchedule, getPaymentProgress, addMonthsClamped, resolvePaymentType, toDateStr } = require('../utils/installmentSchedule');
const M = require('../db/mappers');

const manual = (extra = {}) => ({
    name: 'TV', paymentType: 'manual', totalAmount: 1200, downPayment: 0, monthlyPayment: 100,
    installmentsCount: 12, startDate: '2026-01-31', loanComponents: [], ...extra
});

test('due day is clamped to the last day of shorter months', () => {
    const dates = buildSchedule(manual({ installmentsCount: 4 })).map(e => e.dueDate);
    assert.deepEqual(dates, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    assert.deepEqual(addMonthsClamped({ y: 2028, m: 1, d: 31 }, 1), { y: 2028, m: 2, d: 29 }, 'leap year');
    assert.deepEqual(addMonthsClamped({ y: 2026, m: 11, d: 15 }, 3), { y: 2027, m: 2, d: 15 }, 'year roll-over');
});

test('YYYY-MM start date means day 1', () => {
    const s = buildSchedule(manual({ startDate: '2026-03', installmentsCount: 2 }));
    assert.deepEqual(s.map(e => [e.key, e.dueDate]), [['m:1', '2026-03-01'], ['m:2', '2026-04-01']]);
});

test('payments count as paid once the due date arrives (inclusive)', () => {
    const p = getPaymentProgress(manual(), '2026-03-31');
    assert.equal(p.paidCount, 3);
    assert.equal(p.paidAmount, 300);
    assert.equal(p.remainingCount, 9);
    assert.equal(p.remainingAmount, 900);
    assert.equal(p.scheduledTotal, 1200);
    assert.equal(p.nextPayment.key, 'm:4');
    assert.equal(p.nextPayment.dueDate, '2026-04-30');
    assert.equal(getPaymentProgress(manual(), '2026-03-30').paidCount, 2, 'the day before the due date');
});

test('a plan that starts in the future has nothing paid', () => {
    const p = getPaymentProgress(manual({ startDate: '2027-05-10', downPayment: 500 }), '2026-10-16');
    assert.equal(p.paidCount, 0);
    assert.equal(p.paidAmount, 0);
    assert.equal(p.remainingAmount, 1700);
    assert.equal(p.nextPayment.key, 'down');
    assert.equal(p.isCompleted, false);
});

test('down payment counts only from the start date', () => {
    const inst = manual({ startDate: '2026-05-01', downPayment: 500 });
    assert.equal(getPaymentProgress(inst, '2026-04-30').entries.find(e => e.key === 'down').paid, false);
    const p = getPaymentProgress(inst, '2026-05-01');
    assert.equal(p.entries.find(e => e.key === 'down').paid, true);
    assert.equal(p.paidAmount, 600, 'down payment + first monthly payment');
});

test('override: paid early with a different amount, skipped after the due date', () => {
    const inst = manual({
        paymentOverrides: [
            { key: 'm:5', status: 'paid', date: '2026-03-01', amount: 150 },
            { key: 'm:2', status: 'skipped' }
        ]
    });
    const p = getPaymentProgress(inst, '2026-03-31');
    const byKey = Object.fromEntries(p.entries.map(e => [e.key, e]));
    assert.equal(byKey['m:5'].paid, true);
    assert.equal(byKey['m:5'].paidAmount, 150);
    assert.equal(byKey['m:5'].paidDate, '2026-03-01');
    assert.equal(byKey['m:2'].paid, false);
    assert.equal(byKey['m:2'].status, 'skipped');
    assert.equal(p.paidCount, 3); // m:1, m:3, m:5
    assert.equal(p.paidAmount, 350);
    assert.equal(p.nextPayment.key, 'm:2', 'a skipped payment is still owed');
});

test('paid override without amount uses the scheduled amount; x: overrides are extra payments', () => {
    const inst = manual({
        paymentOverrides: [
            { key: 'm:12', status: 'paid' },
            { key: 'x:1', status: 'paid', date: '2026-02-10', amount: 250, description: 'bonus' },
            { key: 'x:2', status: 'skipped', amount: 999 }
        ]
    });
    const p = getPaymentProgress(inst, '2026-01-01');
    assert.equal(p.entries.find(e => e.key === 'm:12').paidAmount, 100);
    assert.deepEqual(p.extraPayments, [{ key: 'x:1', date: '2026-02-10', amount: 250, description: 'bonus' }]);
    assert.equal(p.paidCount, 1);
    assert.equal(p.paidAmount, 350);
    assert.equal(p.remainingAmount, 850);
});

test('loan components: own schedule per loan, payoff replaces payments from the payoff month', () => {
    const inst = {
        name: 'Car', paymentType: 'loan', downPayment: 0, startDate: '2026-01-15',
        loanComponents: [
            { id: 'A', monthlyPayment: 1000, installmentsCount: 12, startDate: '2026-01-15', payoffDate: '2026-04', payoffAmount: 8000 },
            { id: 'B', monthlyPayment: 200, installmentsCount: 3, startDate: '2026-02-01' }
        ]
    };
    const s = buildSchedule(inst);
    assert.deepEqual(s.filter(e => e.loanId === 'A').map(e => e.key), ['l:A:1', 'l:A:2', 'l:A:3', 'l:A:payoff']);
    assert.equal(s.find(e => e.key === 'l:A:payoff').dueDate, '2026-04-01');
    assert.equal(s.find(e => e.key === 'l:A:payoff').amount, 8000);
    assert.deepEqual(s.filter(e => e.loanId === 'B').map(e => e.dueDate), ['2026-02-01', '2026-03-01', '2026-04-01']);

    const p = getPaymentProgress(inst, '2026-03-20');
    assert.equal(p.scheduledTotal, 3000 + 8000 + 600);
    assert.equal(p.paidAmount, 3000 + 400);
    assert.equal(p.remainingCount, 2);
    assert.equal(p.nextPayment.key, 'l:A:payoff');

    const done = getPaymentProgress(inst, '2026-04-01');
    assert.equal(done.isCompleted, true);
    assert.equal(done.remainingAmount, 0);
});

test('payoff date with a day: payments of the payoff month are replaced too', () => {
    const inst = { paymentType: 'loan', loanComponents: [{ id: 'A', monthlyPayment: 100, installmentsCount: 6, startDate: '2026-01-20', payoffDate: '2026-03-25', payoffAmount: 300 }] };
    assert.deepEqual(buildSchedule(inst).map(e => [e.key, e.dueDate]),
        [['l:A:1', '2026-01-20'], ['l:A:2', '2026-02-20'], ['l:A:payoff', '2026-03-25']]);
});

test('milestones: due on their date; legacy milestonePayments count as paid overrides', () => {
    const inst = {
        name: 'Flat', paymentType: 'milestone', downPayment: 0,
        milestones: [
            { id: 'm1', amount: 100000, date: '2026-01' },
            { id: 'm2', amount: 200000, date: '2026-12' },
            { id: 'm3', amount: 300000, date: '2027-06-15' }
        ],
        milestonePayments: [
            { milestoneId: 'm2', date: '2026-09-01', amount: 190000 },
            { milestoneId: 'gone', date: '2026-02-01', amount: 5000, description: 'old' }
        ]
    };
    const p = getPaymentProgress(inst, '2026-10-16');
    assert.deepEqual(p.paidMilestoneIds, ['m1', 'm2']);
    assert.equal(p.entries.find(e => e.key === 'ms:m2').paidAmount, 190000);
    assert.equal(p.entries.find(e => e.key === 'ms:m3').dueDate, '2027-06-15');
    assert.deepEqual(p.extraPayments.map(x => x.amount), [5000], 'unknown milestone id -> extra payment');
    assert.equal(p.paidAmount, 100000 + 190000 + 5000);
    assert.equal(p.nextPayment.key, 'ms:m3');

    // an explicit override wins over the legacy payment
    const withOverride = { ...inst, paymentOverrides: [{ key: 'ms:m2', status: 'skipped' }] };
    assert.deepEqual(getPaymentProgress(withOverride, '2026-10-16').paidMilestoneIds, ['m1']);
});

test('legacy manualPaidCount / payments / loan paidCount are ignored', () => {
    const p = getPaymentProgress(manual({ manualPaidCount: 12, payments: [{ date: '2026-01-01', amount: 1200 }] }), '2025-12-01');
    assert.equal(p.paidCount, 0);
    assert.equal(p.paidAmount, 0);
    const loan = { paymentType: 'loan', loanComponents: [{ id: 'A', monthlyPayment: 100, installmentsCount: 3, startDate: '2027-01-01', paidCount: 3 }] };
    assert.equal(getPaymentProgress(loan, '2026-10-16').paidCount, 0);
});

test('payment type falls back like the client for old records; Date today uses the local date', () => {
    assert.equal(resolvePaymentType({ loanComponents: [{}] }), 'loan');
    assert.equal(resolvePaymentType({ milestones: [{}] }), 'milestone');
    assert.equal(resolvePaymentType({}), 'manual');
    assert.equal(toDateStr(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
    assert.equal(getPaymentProgress(manual(), new Date(2026, 1, 28, 0, 1)).paidCount, 2);
});

test('paymentOverrides and linkedGoalId survive the table-row round trip (extra_json / column)', () => {
    const inst = {
        id: 'i1', name: 'TV', totalAmount: 1200, downPayment: 0, monthlyPayment: 100, installmentsCount: 12,
        startDate: '2026-01-31', color: '#fff', notes: '', manualPaidCount: 0, paymentType: 'manual', linkedGoalId: 'g1',
        loanComponents: [], milestones: [], milestonePayments: [], payments: [],
        paymentOverrides: [
            { key: 'm:2', status: 'skipped' },
            { key: 'x:a', status: 'paid', date: '2026-02-01', amount: 50, description: 'extra' }
        ]
    };
    const r = M.installmentToRows(inst);
    assert.equal(r.parent.linked_goal_id, 'g1');
    assert.deepEqual(JSON.parse(r.parent.extra_json), { paymentOverrides: inst.paymentOverrides });
    const [back] = M.assembleInstallments({
        parents: [r.parent], loans: r.loans, loanPayments: r.loanPayments, milestones: r.milestones,
        milestonePayments: r.milestonePayments, payments: r.payments
    });
    assert.deepEqual(back.paymentOverrides, inst.paymentOverrides);
    assert.equal(back.linkedGoalId, 'g1');
});
