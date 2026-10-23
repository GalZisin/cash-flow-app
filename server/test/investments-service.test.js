/**
 * Investments service + child routes (snapshot / transaction / simulation-rule).
 * The repository is stubbed with an in-memory record, so no database is needed.
 */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createApp } = require('../app');
const investmentsRepository = require('../repositories/investments.repository');
const investmentsService = require('../services/investments.service');

const INV_ID = 'd9b3c7e5-1f2a-4c3b-9d4e-5f6a7b8c9d02';
let stored, server, base;

before(async () => {
    server = http.createServer(createApp());
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

beforeEach((t) => {
    stored = {
        id: INV_ID, name: 'Pension', type: 'pension',
        transactions: [{ id: 'tx1', date: '2025-01-01', amount: 1000, type: 'deposit' }],
        snapshots: [{ id: 's1', date: '2025-01-01', value: 1000 }],
        simulationRules: []
    };
    t.mock.method(investmentsRepository, 'findById', async (id) => (id === INV_ID ? structuredClone(stored) : null));
    t.mock.method(investmentsRepository, 'update', async (id, changes) => {
        stored = { ...stored, ...changes, id };
        return structuredClone(stored);
    });
});

async function call(method, path, body) {
    const res = await fetch(base + '/api/investments' + path, {
        method,
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4300' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: res.status, json: await res.json() };
}

test('POST /:id/transaction adds a transaction with an id, sorted by date', async () => {
    const res = await call('POST', `/${INV_ID}/transaction`, { date: '2024-06-01', amount: '500', type: 'withdraw' });
    assert.equal(res.status, 200);
    assert.equal(res.json.transactions.length, 2);
    assert.deepEqual(res.json.transactions[0].date, '2024-06-01');
    assert.equal(res.json.transactions[0].amount, 500);
    assert.ok(res.json.transactions[0].id);
});

test('POST /:id/transaction rejects an invalid type with 400', async () => {
    const res = await call('POST', `/${INV_ID}/transaction`, { date: '2024-06-01', amount: 5, type: 'gift' });
    assert.equal(res.status, 400);
    assert.equal(res.json.error.name, 'ValidationError');
});

test('PUT and DELETE /:id/transaction/:txId edit and remove by id; unknown id is 404', async () => {
    let res = await call('PUT', `/${INV_ID}/transaction/tx1`, { date: '2025-02-01', amount: 2000, type: 'deposit' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.transactions, [{ id: 'tx1', date: '2025-02-01', amount: 2000, type: 'deposit' }]);

    res = await call('DELETE', `/${INV_ID}/transaction/nope`);
    assert.equal(res.status, 404);

    res = await call('DELETE', `/${INV_ID}/transaction/tx1`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.transactions, []);
});

test('snapshot routes add / update / delete', async () => {
    let res = await call('POST', `/${INV_ID}/snapshot`, { date: '2025-06-01', value: 1200 });
    assert.equal(res.json.snapshots.length, 2);
    const added = res.json.snapshots[1];

    res = await call('PUT', `/${INV_ID}/snapshot/${added.id}`, { date: '2025-06-01', value: 1300 });
    assert.equal(res.json.snapshots[1].value, 1300);

    res = await call('DELETE', `/${INV_ID}/snapshot/s1`);
    assert.deepEqual(res.json.snapshots.map((s) => s.id), [added.id]);
});

test('simulation-rule routes add with defaults and keep unsent fields on update', async () => {
    let res = await call('POST', `/${INV_ID}/simulation-rule`, { fromMonth: 1, toMonth: 120, monthlyAmount: 0, oneTimeAmount: 0 });
    const rule = res.json.simulationRules[0];
    assert.equal(rule.toMonth, 120);

    res = await call('PUT', `/${INV_ID}/simulation-rule/${rule.id}`, { ...rule, monthlyAmount: 300, description: 'raise' });
    assert.equal(res.json.simulationRules[0].monthlyAmount, 300);
    assert.equal(res.json.simulationRules[0].toMonth, 120);

    res = await call('DELETE', `/${INV_ID}/simulation-rule/${rule.id}`);
    assert.deepEqual(res.json.simulationRules, []);
});

test('child route on a missing investment is 404', async () => {
    const res = await call('POST', '/missing/transaction', { date: '2025-01-01', amount: 1, type: 'deposit' });
    assert.equal(res.status, 404);
});

test('update sends only the changed fields (annualReturn kept, arrays untouched)', async (t) => {
    const update = investmentsRepository.update;
    await investmentsService.update(INV_ID, { name: ' New ', annualReturn: '6.5' });
    assert.deepEqual(update.mock.calls.at(-1).arguments[1], { name: 'New', annualReturn: 6.5 });
});

test('create uses the current model and gives children ids', async (t) => {
    const create = t.mock.method(investmentsRepository, 'create', async (data) => data);
    const inv = await investmentsService.create({ name: 'Fund', type: 'fund', transactions: [], snapshots: [{ date: '2025-01-01', value: 10 }] });
    assert.equal(create.mock.callCount(), 1);
    assert.equal(inv.type, 'fund');
    assert.ok(inv.snapshots[0].id);
    assert.deepEqual(inv.simulationRules, []);
    assert.equal('initialAmount' in inv, false);
});
