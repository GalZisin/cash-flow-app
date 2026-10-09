const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planCashFlowWrite } = require('../db/cashFlowDiff');
const { monthToRow, monthItemRows } = require('../db/mappers');

function month(key, overrides = {}) {
    return {
        month: `${key}-01T00:00:00.000Z`,
        startingBalance: 1000, income: 20000, mortgagePayment: 6000, loanPayment: 1000,
        additionalIncomes: [], regularExpenses: [{ description: 'food', amount: 5000, category: 'FOOD' }],
        specialExpenses: [], endingBalance: 9000, rowColor: null,
        ...overrides
    };
}
const toIncoming = (months) => months.map((m, i) => ({ row: monthToRow(m, i), items: monthItemRows(m) }));

/** What the DB would return after saving `months`: rows get ids and items get month_id. */
function persisted(months) {
    const rows = [], items = [];
    toIncoming(months).forEach(({ row, items: its }, i) => {
        const id = 100 + i;
        rows.push({ id, ...row });
        its.forEach((it) => items.push({ month_id: id, ...it }));
    });
    return { rows, items };
}

test('saving identical data writes nothing', () => {
    const months = [month('2026-01'), month('2026-02')];
    const { rows, items } = persisted(months);
    const plan = planCashFlowWrite(rows, items, toIncoming(months));
    assert.deepEqual({ insert: plan.insert.length, update: plan.update.length, deleteIds: plan.deleteIds, unchanged: plan.unchanged },
        { insert: 0, update: 0, deleteIds: [], unchanged: 2 });
});

test('a changed amount updates only that month row', () => {
    const months = [month('2026-01'), month('2026-02')];
    const { rows, items } = persisted(months);
    const edited = [month('2026-01'), month('2026-02', { income: 21000 })];

    const plan = planCashFlowWrite(rows, items, toIncoming(edited));
    assert.equal(plan.unchanged, 1);
    assert.equal(plan.update.length, 1);
    assert.equal(plan.update[0].id, 101);
    assert.equal(plan.update[0].rowChanged, true);
    assert.equal(plan.update[0].itemsChanged, false);
});

test('a changed expense list replaces the items of that month only', () => {
    const months = [month('2026-01'), month('2026-02')];
    const { rows, items } = persisted(months);
    const edited = [month('2026-01', { regularExpenses: [{ description: 'food', amount: 5500, category: 'FOOD' }] }), month('2026-02')];

    const plan = planCashFlowWrite(rows, items, toIncoming(edited));
    assert.equal(plan.update.length, 1);
    assert.equal(plan.update[0].id, 100);
    assert.equal(plan.update[0].rowChanged, false);
    assert.equal(plan.update[0].itemsChanged, true);
    assert.equal(plan.update[0].items[0].amount, 5500);
});

test('appended months are inserted and removed months are deleted', () => {
    const months = [month('2026-01'), month('2026-02'), month('2026-03')];
    const { rows, items } = persisted(months);

    const longer = planCashFlowWrite(rows, items, toIncoming([...months, month('2026-04')]));
    assert.equal(longer.insert.length, 1);
    assert.equal(longer.insert[0].row.sort_order, 4);
    assert.equal(longer.unchanged, 3);

    const shorter = planCashFlowWrite(rows, items, toIncoming(months.slice(0, 2)));
    assert.deepEqual(shorter.deleteIds, [102]);
    assert.equal(shorter.unchanged, 2);
});

test('numeric strings and DB decimals compare equal; item order does not matter', () => {
    const months = [month('2026-01', { regularExpenses: [{ description: 'a', amount: 1 }, { description: 'b', amount: 2 }] })];
    const { rows, items } = persisted(months);
    rows[0].income = '20000.00';          // as a driver might return it
    const shuffled = [items[1], items[0]]; // DB rows in a different order
    const plan = planCashFlowWrite(rows, shuffled, toIncoming(months));
    assert.equal(plan.unchanged, 1);
});

test('an empty table gets every month inserted', () => {
    const plan = planCashFlowWrite([], [], toIncoming([month('2026-01'), month('2026-02')]));
    assert.equal(plan.insert.length, 2);
    assert.equal(plan.insert[1].items.length, 1);
});
