/**
 * Offline check of the JSON <-> table-row mapping (no SQL Server needed).
 *   npm run test:mappers
 * Takes every JSON file in server/data, flattens it into table rows, rebuilds it from those rows
 * and verifies that the result equals the original (numbers are compared at 2-decimal precision,
 * because the money columns are DECIMAL(18,2)).
 */
const fs = require('fs');
const path = require('path');
const M = require('./mappers');

const DATA = path.join(__dirname, '..', 'data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

let failures = 0;
function diff(a, b, where, out) {
    if (typeof a === 'number' && typeof b === 'number') {
        if (Math.abs(a - b) > 0.005) out.push(`${where}: ${a} != ${b}`);
        return;
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b)) return out.push(`${where}: array vs ${typeof (Array.isArray(a) ? b : a)}`);
        if (a.length !== b.length) return out.push(`${where}: length ${a.length} != ${b.length}`);
        a.forEach((x, i) => diff(x, b[i], `${where}[${i}]`, out));
        return;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const k of keys) {
            if (a[k] === undefined && b[k] === undefined) continue;
            if (!(k in a) || a[k] === undefined) { out.push(`${where}.${k}: missing in original (rebuilt=${JSON.stringify(b[k])})`); continue; }
            if (!(k in b) || b[k] === undefined) { out.push(`${where}.${k}: missing after round trip (original=${JSON.stringify(a[k])})`); continue; }
            diff(a[k], b[k], `${where}.${k}`, out);
        }
        return;
    }
    if (a !== b) out.push(`${where}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
}

function check(name, original, rebuilt) {
    const out = [];
    diff(original, rebuilt, name, out);
    if (out.length) {
        failures++;
        console.log(`✗ ${name}: ${out.length} difference(s)`);
        out.slice(0, 8).forEach((l) => console.log('    ' + l));
    } else {
        console.log(`✓ ${name}`);
    }
}

// What SQL Server hands back: ts columns come back with a trailing Z.
const withZ = (v) => (v === null ? null : `${v}Z`);

// ---------------------------------------------------------------- cash flow (all data files)
for (const file of fs.readdirSync(DATA).filter((f) => /^cash-flow-data.*\.json$/.test(f))) {
    const original = read(file);
    const monthRows = original.months.map(M.monthToRow).map((r, i) => ({ id: i + 1, ...r }));
    const itemRows = [];
    original.months.forEach((m, i) => M.monthItemRows(m).forEach((it) => itemRows.push({ month_id: i + 1, ...it })));
    // Expected result: months are stored as calendar dates (nearest day, "T00:00:00.000Z"), and a
    // missing additionalIncomes list comes back as [] (the active data file always has it).
    const DAY = 24 * 60 * 60 * 1000;
    const expected = {
        months: original.months.map((m) => ({
            additionalIncomes: [],
            ...m,
            month: new Date(Math.round(new Date(m.month).getTime() / DAY) * DAY).toISOString()
        }))
    };
    check(`${file} (${original.months.length} months, ${itemRows.length} items)`, expected, { months: M.assembleMonths(monthRows, itemRows) });
}

// ---------------------------------------------------------------- defaults + budget
{
    const original = read('cash-flow-defaults.json');
    const { header, items } = M.defaultsToRows(original);
    check('cash-flow-defaults.json', original, M.assembleDefaults(header, items));

    // with some items
    const withItems = {
        income: 18300, mortgagePayment: 5000, loanPayment: 100,
        additionalIncomes: [{ description: 'בונוס', amount: 500 }],
        regularExpenses: [{ description: 'שוטף', amount: 2000, category: 'OTHER' }],
        specialExpenses: [{ description: 'ביטוח', amount: 900, category: 'CAR' }, { description: 'x', amount: 1 }]
    };
    const r = M.defaultsToRows(withItems);
    check('defaults with items', withItems, M.assembleDefaults(r.header, r.items));

    const budget = read('budget-settings.json');
    check('budget-settings.json', budget, M.assembleBudget(M.budgetToRows(budget)));
}

// ---------------------------------------------------------------- installments
{
    const original = read('installments.json');
    const parts = { parents: [], loans: [], loanPayments: [], milestones: [], milestonePayments: [], payments: [] };
    for (const inst of original) {
        const r = M.installmentToRows(inst);
        parts.parents.push(r.parent);
        parts.loans.push(...r.loans);
        parts.loanPayments.push(...r.loanPayments);
        parts.milestones.push(...r.milestones);
        parts.milestonePayments.push(...r.milestonePayments);
        parts.payments.push(...r.payments);
    }
    // the repository normalises missing arrays to [] (same as the old findAll)
    const expected = original.map((i) => ({ loanComponents: [], milestones: [], milestonePayments: [], payments: [], ...i }));
    check('installments.json', expected, M.assembleInstallments(parts));

    // loan with payments history, "tracked but empty", extra fields
    const rich = [{
        id: '1', name: 'רכב', totalAmount: 100000, downPayment: 10000, monthlyPayment: 1500.5, installmentsCount: 60,
        startDate: '2026-01-01', color: '#fff', notes: 'הערה', manualPaidCount: 2, lastManualPaymentDate: '2026-03-01',
        paymentType: 'loan', linkedGoalId: 'g1', someFutureField: { a: 1 },
        loanComponents: [
            { id: 'L1', description: 'בנק', totalLoanAmount: 90000, monthlyPayment: 1500, installmentsCount: 60, startDate: '2026-01-01',
              paidCount: 2, lastPaidDate: '2026-02-01', interestRate: 4.25, payoffDate: '2030-12', payoffAmount: 1000,
              payments: [{ date: '2026-01-01', amount: 1500 }, { date: '2026-02-01', amount: 1500 }] },
            { id: 'L2', description: 'tracked empty', totalLoanAmount: 1, monthlyPayment: 1, installmentsCount: 1, startDate: '2026-01-01', paidCount: 0, payments: [] },
            { id: 'L3', description: 'no payments field', totalLoanAmount: 1, monthlyPayment: 1, installmentsCount: 1, startDate: '2026-01-01', paidCount: 0 }
        ],
        milestones: [{ id: 'm1', description: 'פעימה', percentage: 20, amount: 20000, date: '2026-08' }],
        milestonePayments: [{ date: '2026-08-18', amount: 20000, milestoneId: 'm1', description: 'שולם' }],
        payments: [{ date: '2026-01-01', amount: 1500 }]
    }];
    const p2 = { parents: [], loans: [], loanPayments: [], milestones: [], milestonePayments: [], payments: [] };
    for (const inst of rich) {
        const r = M.installmentToRows(inst);
        p2.parents.push(r.parent); p2.loans.push(...r.loans); p2.loanPayments.push(...r.loanPayments);
        p2.milestones.push(...r.milestones); p2.milestonePayments.push(...r.milestonePayments); p2.payments.push(...r.payments);
    }
    check('installments (rich synthetic case)', rich, M.assembleInstallments(p2));
}

// ---------------------------------------------------------------- investments
{
    const original = read('investments.json');
    const parts = { parents: [], transactions: [], snapshots: [], rules: [] };
    for (const inv of original) {
        const r = M.investmentToRows(inv);
        parts.parents.push(r.parent); parts.transactions.push(...r.transactions);
        parts.snapshots.push(...r.snapshots); parts.rules.push(...r.rules);
    }
    check('investments.json', original, M.assembleInvestments(parts));

    // shape created by investments.service.create + simulation rules
    const other = [{ id: '9', name: 'מניות', initialAmount: 100, currentAmount: 120, currency: 'ILS', type: 'stock', startDate: '2026-01-01', notes: '',
        transactions: [], snapshots: [], simulationRules: [{ id: 'r1', fromMonth: 1, toMonth: 12, monthlyAmount: 100, oneTimeAmount: 0, description: 'כלל' }],
        initialValue: 50, annualReturn: 4.5 }];
    const p = { parents: [], transactions: [], snapshots: [], rules: [] };
    for (const inv of other) { const r = M.investmentToRows(inv); p.parents.push(r.parent); p.transactions.push(...r.transactions); p.snapshots.push(...r.snapshots); p.rules.push(...r.rules); }
    check('investments (service-created shape)', other, M.assembleInvestments(p));
}

// ---------------------------------------------------------------- conversations + reports
{
    const original = read('conversations.json');
    const parentRows = []; const messageRows = [];
    for (const c of original) {
        const r = M.conversationToRows(c);
        parentRows.push({ ...r.parent, created_at: withZ(r.parent.created_at), updated_at: withZ(r.parent.updated_at) });
        r.messages.forEach((m) => messageRows.push({ ...m, sent_at: withZ(m.sent_at) }));
    }
    check('conversations.json', original, M.assembleConversations(parentRows, messageRows));

    const reports = read('ai-reports.json');
    const rebuilt = reports.map((r) => { const row = M.reportToRow(r); return M.assembleReport({ ...row, created_at: withZ(row.created_at) }); });
    check('ai-reports.json', reports, rebuilt);

    // report created by the service from arbitrary data
    const custom = { id: '5', prompt: 'שאלה', analysis: 'תשובה', createdAt: '2026-01-01T10:00:00.000Z' };
    const row = M.reportToRow(custom);
    check('ai report with prompt/analysis', custom, M.assembleReport({ ...row, created_at: withZ(row.created_at) }));
}

// ---------------------------------------------------------------- goals (file is empty today, so use a full synthetic goal)
{
    const goal = {
        id: 'uuid-1', name: 'רכב חדש', description: 'תיאור', type: 'PURCHASE', targetAmount: 185000, targetDate: '2027-10',
        loanDetails: { loanAmount: 100000, downPayment: 85000, monthlyPayment: 2000, months: 60, interestRate: 5 },
        schedule: { type: 'loan', loan: { loanAmount: 100000, downPayment: 85000, monthlyPayment: 2000, months: 60, interestRate: 5 } },
        linkedInstallmentId: 'i1', linkedToSpecialExpense: true, autoUpdateFromCashFlow: false, priority: 2,
        analysis: { achievable: true, projectedBalance: 1, currentBalance: 2, monthsUntilGoal: 3, monthlySavingsNeeded: 4, reasons: ['א'], recommendations: [], status: 'ACHIEVABLE' },
        lastAnalyzed: '2026-10-03T10:00:00.000Z', createdDate: '2026-10-01T10:00:00.000Z', updatedDate: '2026-10-02T10:00:00.000Z',
        completed: false, isFixed: true
    };
    const row = M.goalToRow(goal);
    const dbRow = { ...row, last_analyzed: withZ(row.last_analyzed), created_date: withZ(row.created_date), updated_date: withZ(row.updated_date), completed_date: withZ(row.completed_date) };
    check('financial goal (synthetic, full)', goal, M.assembleGoal(dbRow));

    const minimal = { id: 'g2', name: 'מינימלי', type: 'SAVINGS', targetAmount: 1000, targetDate: '2027-01', priority: 999, completed: false, createdDate: '2026-10-01T10:00:00.000Z', updatedDate: '2026-10-01T10:00:00.000Z' };
    const r2 = M.goalToRow(minimal);
    check('financial goal (minimal)', minimal, M.assembleGoal({ ...r2, created_date: withZ(r2.created_date), updated_date: withZ(r2.updated_date), last_analyzed: null, completed_date: null }));
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll mapping checks passed');
process.exit(failures ? 1 : 0);
