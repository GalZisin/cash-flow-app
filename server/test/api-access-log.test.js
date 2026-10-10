/**
 * API access log: request context + traced methods, the middleware (through the real app)
 * and the local-time formatter. The log repository is stubbed, so no database is needed.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');

process.env.AI_RATE_LIMIT_PER_MINUTE = '1000';
process.env.AI_SUMMARY_CACHE_MS = '0';
process.env.API_ACCESS_LOG = '1';

const { createApp } = require('../app');
const requestContext = require('../utils/requestContext');
const traceMethods = require('../utils/traceMethods');
const { describePath } = require('../middleware/apiAccessLog');
const apiAccessLogRepository = require('../repositories/apiAccessLog.repository');
const financialSummary = require('../services/financialSummary.service');
const installmentsRepository = require('../repositories/installments.repository');
const { localDateTimeToDb } = require('../db/helpers.pure');
const { buildSummary } = require('../services/cashflow-engine');
const { sampleCashFlow } = require('./fixtures');

const UUID = '3f2a1c6e-7b1d-4e0b-9c1a-0d2b5f7e8a91';
const LOCAL_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/;
const sampleSummary = buildSummary({ cashFlow: sampleCashFlow(), installments: [], investments: [], defaults: { income: 20000 } });

let server, base;
before(async () => {
    server = http.createServer(createApp());
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

async function call(method, path, body) {
    const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4300' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, text, json };
}

/** The row is written after the response is flushed, so give the finish handler a moment. */
async function waitFor(predicate, timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
        if (Date.now() > deadline) throw new Error('timed out waiting for the log row');
        await new Promise((r) => setTimeout(r, 5));
    }
}

function captureRows(t) {
    const rows = [];
    t.mock.method(apiAccessLogRepository, 'insert', async (entry) => { rows.push(entry); return 1000 + rows.length; });
    return rows;
}

// ------------------------------------------------------------------ traceMethods + requestContext

test('traceMethods records the chain of methods, including _private helpers called through this', async () => {
    class Demo {
        async run(x) { return this._step(x) + this.helper(); }
        _step(x) { return x * 2; }
        helper() { return 1; }
    }
    const demo = traceMethods(new Demo(), 'demoService');

    const store = { calls: [] };
    const result = await requestContext.run(store, () => demo.run(5));

    assert.equal(result, 11, 'the wrapped methods still return their values');
    assert.equal(requestContext.callChain(store.calls), 'demoService.run > demoService._step > demoService.helper');
    assert.equal(demo.run.name, 'run');
});

test('traceMethods counts consecutive repeats and is a no-op outside a request', () => {
    const repo = traceMethods({ findAll: () => 'rows', update: (n) => n }, 'repo');

    assert.equal(repo.findAll(), 'rows', 'works with no request context');

    const store = { calls: [] };
    requestContext.run(store, () => { repo.update(1); repo.update(2); repo.update(3); repo.findAll(); });
    assert.equal(requestContext.callChain(store.calls), 'repo.update x3 > repo.findAll');
    assert.equal(requestContext.callChain([]), null);
    assert.equal(requestContext.callChain([{ name: 'a'.repeat(30), count: 1 }], 10), 'aaaaaaa...');
});

test('traceMethods keeps t.mock.method working on the traced singleton', (t) => {
    class Svc { load() { return 'real'; } }
    const svc = traceMethods(new Svc(), 'svc');
    const mocked = t.mock.method(svc, 'load', () => 'stubbed');
    assert.equal(svc.load(), 'stubbed');
    assert.equal(mocked.mock.callCount(), 1);
    mocked.mock.restore();
    assert.equal(svc.load(), 'real');
});

test('localDateTimeToDb formats the local wall-clock time with milliseconds', () => {
    assert.equal(localDateTimeToDb(new Date(2026, 9, 10, 8, 5, 3, 7)), '2026-10-10T08:05:03.007');
    assert.equal(localDateTimeToDb('not a date'), null);
});

test('describePath turns ids into :id and keeps the first id as the entity', () => {
    const d = describePath(`/api/goals/${UUID}/analyze?force=1`);
    assert.equal(d.routePattern, '/api/goals/:id/analyze');
    assert.equal(d.requestPath, `/api/goals/${UUID}/analyze`);
    assert.equal(d.serviceName, 'goals');
    assert.equal(d.entityId, UUID);
    assert.equal(describePath('/api/budget/monthly/2026-10').entityId, null);
});

// ------------------------------------------------------------------ middleware through the real app

test('a successful request is logged with its service, route, inner chain, payloads and local times', async (t) => {
    const rows = captureRows(t);
    financialSummary.invalidate();
    t.mock.method(financialSummary, 'build', async () => sampleSummary);

    const res = await call('GET', '/api/ai/summary?x=1');
    assert.equal(res.status, 200);
    await waitFor(() => rows.length === 1);

    const row = rows[0];
    assert.equal(row.request_id, res.headers.get('x-request-id'), 'X-Request-Id header matches the row');
    assert.match(row.request_id, /^[0-9a-f-]{36}$/);
    assert.equal(row.service_name, 'ai');
    assert.equal(row.method_name, 'GET /api/ai/summary');
    assert.equal(row.http_method, 'GET');
    assert.equal(row.request_path, '/api/ai/summary');
    assert.equal(row.request_data, '{"query":{"x":"1"}}');
    assert.match(row.response_data, /"monthlySavingsAvg":5000/);
    assert.match(row.inner_method_name, /^financialSummaryService\.getSummary/);
    assert.equal(row.is_error, false);
    assert.equal(row.event_message, null);
    assert.equal(row.status, 200);
    assert.equal(row.entity_id, null);
    assert.equal(row.machine_name, os.hostname());
    assert.equal(typeof row.user_name, 'string');
    assert.ok(row.user_name.length > 0);
    assert.equal(row.ip_address, '127.0.0.1');
    assert.match(row.start_time, LOCAL_TS);
    assert.match(row.end_time, LOCAL_TS);
    assert.ok(row.end_time >= row.start_time);
});

test('a 4xx is logged as an error with the thrown error name and message and the request body', async (t) => {
    const rows = captureRows(t);

    const res = await call('POST', '/api/ai/chat', { question: '' });
    assert.equal(res.status, 400);
    await waitFor(() => rows.length === 1);

    const row = rows[0];
    assert.equal(row.is_error, true);
    assert.equal(row.status, 400);
    assert.equal(row.method_name, 'POST /api/ai/chat');
    assert.equal(row.request_data, '{"body":{"question":""}}');
    assert.match(row.event_message, /^ValidationError: question is required/);
    assert.match(row.response_data, /"success":false/);
});

test('an entity id in the path is logged and the chain reaches the repository', async (t) => {
    const rows = captureRows(t);
    t.mock.method(installmentsRepository, 'findById', async () => null);

    const res = await call('GET', `/api/installments/${UUID}`);
    assert.equal(res.status, 404);
    await waitFor(() => rows.length === 1);

    const row = rows[0];
    assert.equal(row.service_name, 'installments');
    assert.equal(row.method_name, 'GET /api/installments/:id');
    assert.equal(row.entity_id, UUID);
    // findById is stubbed by t.mock.method, which replaces the traced wrapper, so the chain stops at the service.
    assert.equal(row.inner_method_name, 'installmentsService.getById');
    assert.match(row.event_message, /^NotFoundError: Installment with id/);
});

test('an unknown /api route is logged as a 404 error from the JSON envelope', async (t) => {
    const rows = captureRows(t);

    await call('GET', '/api/no-such-thing');
    await waitFor(() => rows.length === 1);

    assert.equal(rows[0].status, 404);
    assert.equal(rows[0].is_error, true);
    assert.equal(rows[0].event_message, 'NotFoundError: Route not found');
    assert.equal(rows[0].inner_method_name, null);
});

test('a failing log write never breaks the response', async (t) => {
    const insert = t.mock.method(apiAccessLogRepository, 'insert', async () => { throw new Error('no table'); });
    financialSummary.invalidate();
    t.mock.method(financialSummary, 'build', async () => sampleSummary);

    const res = await call('GET', '/api/ai/summary');
    assert.equal(res.status, 200);
    await waitFor(() => insert.mock.callCount() === 1);
});
