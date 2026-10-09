/**
 * HTTP tests for the AI routes, the error format, the rate limiter and the 404 handler.
 * The summary service and the AI service are stubbed, so no database and no Ollama are needed.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.AI_RATE_LIMIT_PER_MINUTE = '1000';
process.env.AI_SUMMARY_CACHE_MS = '60000';

const { createApp } = require('../app');
const financialSummary = require('../services/financialSummary.service');
const aiService = require('../services/ai.service');
const { buildSummary } = require('../services/cashflow-engine');
const { sampleCashFlow, monthKey } = require('./fixtures');

let server, base;
const sampleSummary = buildSummary({ cashFlow: sampleCashFlow(), installments: [], investments: [], defaults: { income: 20000 } });

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
    try { json = JSON.parse(text); } catch { /* plain text (stream) */ }
    return { status: res.status, headers: res.headers, text, json };
}

function connectionRefused() {
    return Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:11434'), { code: 'ECONNREFUSED' });
}

test('GET /api/ai/summary returns the computed summary and uses the cache', async (t) => {
    financialSummary.invalidate();
    const build = t.mock.method(financialSummary, 'build', async () => sampleSummary);

    const first = await call('GET', '/api/ai/summary');
    const second = await call('GET', '/api/ai/summary');

    assert.equal(first.status, 200);
    assert.equal(first.json.monthlySavingsAvg, 5000);
    assert.equal(second.status, 200);
    assert.equal(build.mock.callCount(), 1, 'second call is served from the cache');
});

test('a mutating request invalidates the summary cache', async (t) => {
    financialSummary.invalidate();
    const build = t.mock.method(financialSummary, 'build', async () => sampleSummary);

    await call('GET', '/api/ai/summary');
    await call('POST', '/api/goals/analyze-all', {}); // fails without a DB, but it is a mutating request
    await new Promise((r) => setTimeout(r, 10));
    await call('GET', '/api/ai/summary');

    assert.equal(build.mock.callCount(), 2, 'summary was rebuilt after the mutating request');
});

test('POST /api/ai/chat without a question is a 400 in the standard error format', async () => {
    const res = await call('POST', '/api/ai/chat', {});
    assert.equal(res.status, 400);
    assert.equal(res.json.success, false);
    assert.equal(res.json.error.name, 'ValidationError');
    assert.match(res.json.error.message, /question is required/);
});

test('POST /api/ai/chat when the model server is down is a 503 with code AI_UNAVAILABLE', async (t) => {
    t.mock.method(financialSummary, 'getSummary', async () => sampleSummary);
    t.mock.method(aiService, 'getChat', async () => { throw aiService.toServiceError(connectionRefused()); });

    const res = await call('POST', '/api/ai/chat', { question: 'how am I doing?' });
    assert.equal(res.status, 503);
    assert.equal(res.json.error.name, 'ServiceUnavailableError');
    assert.equal(res.json.error.code, 'AI_UNAVAILABLE');
    assert.match(res.json.error.message, /not running/);
});

test('POST /api/ai/chat-stream streams tokens and ends the body with a note on failure', async (t) => {
    t.mock.method(financialSummary, 'getSummary', async () => sampleSummary);
    t.mock.method(aiService, 'getChatStream', (summary, q, onToken, onDone, onError) => {
        onToken('Hello ');
        onToken('world');
        onError(aiService.toServiceError(connectionRefused()));
    });

    const res = await call('POST', '/api/ai/chat-stream', { question: 'hi' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/plain/);
    assert.match(res.text, /^Hello world/);
    assert.match(res.text, /\[AI service .* is not running/);
});

test('POST /api/ai/scenario validates input and returns the simulation next to the AI text', async (t) => {
    t.mock.method(financialSummary, 'getSummary', async () => sampleSummary);
    t.mock.method(aiService, 'getScenario', async () => ({ model: 'test', scenarioAnalysis: 'ok' }));

    const bad = await call('POST', '/api/ai/scenario', { description: 'Bike', amount: 1000, date: '15/12/2026' });
    assert.equal(bad.status, 400);

    const good = await call('POST', '/api/ai/scenario', { description: 'Bike', amount: 1000, date: `${monthKey(2)}-15` });
    assert.equal(good.status, 200);
    assert.equal(good.json.scenarioAnalysis, 'ok');
    assert.equal(good.json.simulation.forecast.length, 6);
    assert.equal(good.json.simulation.forecast[1].projectedBalance, sampleSummary.forecast[1].projectedBalance - 1000);
});

test('the rate limiter blocks the (max+1)th request in a window and sets Retry-After', () => {
    const rateLimit = require('../middleware/rateLimit');
    const limiter = rateLimit({ windowMs: 60_000, max: 3 });
    const results = [];
    for (let i = 0; i < 5; i++) {
        const headers = {};
        const res = { setHeader: (k, v) => { headers[k] = v; } };
        let error = null;
        limiter({ ip: '10.0.0.1' }, res, (err) => { error = err || null; });
        results.push({ error, headers });
    }
    assert.ok(results.slice(0, 3).every(r => r.error === null), 'first 3 requests pass');
    assert.equal(results[3].error.statusCode, 429);
    assert.equal(results[3].error.code, 'RATE_LIMITED');
    assert.ok(Number(results[3].headers['Retry-After']) > 0);
    // another client is counted separately
    let other = null;
    limiter({ ip: '10.0.0.2' }, { setHeader() {} }, (err) => { other = err || null; });
    assert.equal(other, null);
});

test('unknown routes return a JSON 404', async () => {
    const res = await call('GET', '/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.json.error.message, 'Route not found');
});

test('requests from a disallowed origin are rejected by CORS', async () => {
    const res = await fetch(base + '/api/ai/summary', { headers: { Origin: 'http://evil.example' } });
    assert.equal(res.status, 500);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('toServiceError maps network failures and timeouts to 503 and leaves other errors alone', () => {
    assert.equal(aiService.toServiceError(connectionRefused()).statusCode, 503);
    assert.equal(aiService.toServiceError(Object.assign(new Error('x'), { code: 'AI_TIMEOUT' })).code, 'AI_TIMEOUT');
    const other = new Error('boom');
    assert.equal(aiService.toServiceError(other), other);
});
