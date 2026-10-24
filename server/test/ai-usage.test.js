/**
 * Chat usage meters: provider quota from x-ratelimit-* headers, the context budget estimate,
 * conversation history in both providers, and the /usage + chat routes (history validation, AI_CONTEXT_FULL).
 * A fake model server on 127.0.0.1 stands in for the provider; no database and no AI needed.
 */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.AI_RATE_LIMIT_PER_MINUTE = '1000';

const { createApp } = require('../app');
const financialSummary = require('../services/financialSummary.service');
const ai = require('../services/ai.service');
const { buildSummary } = require('../services/cashflow-engine');
const { sampleCashFlow } = require('./fixtures');

const summary = buildSummary({ cashFlow: sampleCashFlow(), installments: [], investments: [], defaults: { income: 20000 } });

let provider, providerBase, lastRequest, behaviour, app, appBase;

before(async () => {
    provider = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            lastRequest = { path: req.url, body: JSON.parse(body) };
            behaviour(req, res, lastRequest.body);
        });
    });
    await new Promise((r) => provider.listen(0, '127.0.0.1', r));
    providerBase = `http://127.0.0.1:${provider.address().port}`;

    app = http.createServer(createApp());
    await new Promise((r) => app.listen(0, '127.0.0.1', r));
    appBase = `http://127.0.0.1:${app.address().port}`;
});
after(() => Promise.all([provider, app].map((s) => new Promise((r) => s.close(r)))));
beforeEach(() => {
    process.env.AI_PROVIDER = 'openai'; process.env.AI_BASE_URL = providerBase; process.env.AI_API_KEY = '';
    process.env.AI_TIMEOUT_MS = '2000';
    delete process.env.AI_CONTEXT_TOKENS;
});

async function call(method, path, body) {
    const res = await fetch(appBase + path, {
        method, headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* plain text (stream) */ }
    return { status: res.status, text, json };
}

const okAnswer = (headers = {}) => (req, res) => {
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
};

// ---------------------------------------------------------------- quota

test('parseDuration reads Groq reset values', () => {
    assert.equal(ai.parseDuration('1m26.4s'), 86_400);
    assert.equal(ai.parseDuration('659ms'), 659);
    assert.equal(ai.parseDuration('2h3m'), 7_380_000);
    assert.equal(ai.parseDuration(undefined), 0);
});

test('parseQuota turns x-ratelimit headers into limits with absolute reset times', () => {
    const now = Date.parse('2026-10-24T10:00:00.000Z');
    const quota = ai.parseQuota({
        'x-ratelimit-limit-requests': '1000', 'x-ratelimit-remaining-requests': '998', 'x-ratelimit-reset-requests': '1m26.4s',
        'x-ratelimit-limit-tokens': '8000', 'x-ratelimit-remaining-tokens': '5610', 'x-ratelimit-reset-tokens': '17.9s'
    }, now);
    assert.deepEqual(quota.requests, { limit: 1000, remaining: 998, resetAt: '2026-10-24T10:01:26.400Z' });
    assert.deepEqual(quota.tokens, { limit: 8000, remaining: 5610, resetAt: '2026-10-24T10:00:17.900Z' });
    assert.equal(ai.parseQuota({ 'content-type': 'application/json' }), null, 'no headers (Ollama) -> null');
});

test('the provider quota is recorded from responses (errors included) and refills after its reset time', async () => {
    behaviour = okAnswer({
        'x-ratelimit-limit-tokens': '8000', 'x-ratelimit-remaining-tokens': '4000', 'x-ratelimit-reset-tokens': '30s',
        'x-ratelimit-limit-requests': '1000', 'x-ratelimit-remaining-requests': '990', 'x-ratelimit-reset-requests': '2m'
    });
    await ai.generate({ system: 'S', user: 'U' });
    const usage = ai.getUsage(summary);
    assert.equal(usage.quota.tokens.remaining, 4000);
    assert.equal(usage.quota.requests.remaining, 990);
    assert.equal(ai.currentQuota(Date.now() + 31_000).tokens.remaining, 8000, 'token window has reset');
    assert.equal(ai.currentQuota(Date.now() + 31_000).requests.remaining, 990, 'request window has not');

    behaviour = (req, res) => {
        res.setHeader('x-ratelimit-limit-tokens', '8000'); res.setHeader('x-ratelimit-remaining-tokens', '0');
        res.setHeader('x-ratelimit-reset-tokens', '20s');
        res.statusCode = 429; res.end('rate limited');
    };
    await assert.rejects(ai.generate({ system: 'S', user: 'U' }), (err) => err.statusCode === 429);
    assert.equal(ai.getUsage(summary).quota.tokens.remaining, 0);
});

test('a 413 from the provider (request over its token limit) becomes 400 AI_CONTEXT_FULL', async () => {
    behaviour = (req, res) => { res.statusCode = 413; res.end('{"error":{"message":"Request too large"}}'); };
    await assert.rejects(ai.generate({ system: 'S', user: 'U' }), (err) => err.statusCode === 400 && err.code === 'AI_CONTEXT_FULL');
});

// ---------------------------------------------------------------- context

test('chatContext: the conversation gets what is left after the summary and the answer reserve, from 0%', () => {
    const empty = ai.chatContext(summary);
    assert.equal(empty.limitTokens, 8000);
    assert.equal(empty.reserveTokens, 1024);
    assert.equal(empty.usedTokens, empty.baseTokens + 1024);
    assert.equal(empty.spaceTokens, 8000 - empty.baseTokens - 1024);
    assert.equal(empty.percent, 0);

    const history = [{ role: 'user', content: 'א'.repeat(240) }, { role: 'assistant', content: 'ב'.repeat(240) }];
    const ctx = ai.chatContext(summary, { history, question: 'ג'.repeat(24) });
    assert.equal(ctx.conversationTokens, 100 + 100 + 10); // 2.4 chars per token, rounded up per message
    assert.equal(ctx.usedTokens, empty.usedTokens + 210);
    assert.equal(ctx.percent, Math.floor((210 / ctx.spaceTokens) * 100));
    assert.equal(ctx.historySent, 2);
    assert.equal(ctx.historyDropped, 0);

    process.env.AI_CONTEXT_TOKENS = '16000';
    assert.equal(ai.chatContext(summary).limitTokens, 16000);
});

test('fitChat keeps the newest messages that fit and drops the oldest', () => {
    const space = ai.chatContext(summary).spaceTokens;
    const quarter = 'x'.repeat(Math.floor((space / 4) * 2.4)); // each message ~1/4 of the space: 3 fit, 4 do not
    const history = ['old', 'mid', 'new', 'newest'].map((tag, i) => ({ role: i % 2 ? 'assistant' : 'user', content: tag + quarter }));
    const { options, context } = ai.fitChat(summary, 'hi', { history, lang: 'he' });
    assert.deepEqual(options.history.map((m) => m.content.slice(0, 6).replace(/x+$/, '')), ['mid', 'new', 'newest']);
    assert.equal(options.lang, 'he');
    assert.equal(context.historyDropped, 1);
    assert.ok(context.usedTokens <= 8000);
    assert.equal(context.percent, Math.floor((context.conversationTokens / space) * 100));
});

test('fitChat rejects only a question larger than the whole conversation space', () => {
    assert.throws(() => ai.fitChat(summary, 'x'.repeat(20_000)), (err) => err.statusCode === 400 && err.code === 'AI_CONTEXT_FULL');
    const history = [{ role: 'assistant', content: 'x'.repeat(20_000) }];
    assert.deepEqual(ai.fitChat(summary, 'hi', { history }).options.history, [], 'an oversized old answer is just left out');
});

// ---------------------------------------------------------------- history in the providers

test('openai: history goes between the system message and the question, lang adds an instruction', async () => {
    behaviour = okAnswer();
    const history = [{ role: 'user', content: 'Q1' }, { role: 'assistant', content: 'A1' }];
    await ai.getChat(summary, 'Q2', { history, lang: 'en' });
    const messages = lastRequest.body.messages;
    assert.deepEqual(messages.map((m) => m.role), ['system', 'user', 'assistant', 'user']);
    assert.equal(messages[1].content, 'Q1');
    assert.equal(messages[2].content, 'A1');
    assert.match(messages[3].content, /## User Question\nQ2/);
    assert.match(messages[3].content, /Respond in English\.$/);
});

test('ollama: history is written into the single prompt before the question', async () => {
    process.env.AI_PROVIDER = 'ollama';
    behaviour = (req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ response: 'ok', done: true })); };
    await ai.generate({ system: 'SYS', user: 'USER', history: [{ role: 'user', content: 'Q1' }, { role: 'assistant', content: 'A1' }] });
    assert.equal(lastRequest.body.prompt, 'SYS\n\n## Conversation so far\nUser: Q1\n\nAssistant: A1\n\nUSER');
});

// ---------------------------------------------------------------- routes

test('GET /api/ai/usage returns provider, quota and context', async (t) => {
    t.mock.method(financialSummary, 'getSummary', async () => summary);
    const res = await call('GET', '/api/ai/usage');
    assert.equal(res.status, 200);
    assert.equal(res.json.provider, 'openai');
    assert.equal(res.json.context.limitTokens, 8000);
    assert.ok(res.json.context.baseTokens > 0);
    assert.ok('quota' in res.json);
});

test('POST /api/ai/chat-stream passes history and lang to the service', async (t) => {
    t.mock.method(financialSummary, 'getSummary', async () => summary);
    const stream = t.mock.method(ai, 'getChatStream', (s, q, onToken, onDone) => { onToken('ok'); onDone(); });
    const history = [{ role: 'user', content: 'Q1', timestamp: 'x' }, { role: 'assistant', content: 'A1' }];
    const res = await call('POST', '/api/ai/chat-stream', { question: 'Q2', history, lang: 'he' });
    assert.equal(res.status, 200);
    assert.equal(res.text, 'ok');
    const [, question, , , , options] = stream.mock.calls[0].arguments;
    assert.equal(question, 'Q2');
    assert.deepEqual(options, { history: [{ role: 'user', content: 'Q1' }, { role: 'assistant', content: 'A1' }], lang: 'he' });
});

test('POST /api/ai/chat-stream trims a long history and reports how many messages were left out', async (t) => {
    t.mock.method(financialSummary, 'getSummary', async () => summary);
    const stream = t.mock.method(ai, 'getChatStream', (s, q, onToken, onDone) => { onToken('ok'); onDone(); });
    const history = [{ role: 'user', content: 'x'.repeat(20_000) }, { role: 'assistant', content: 'A1' }];

    const res = await fetch(`${appBase}/api/ai/chat-stream`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'Q2', history })
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-ai-history-dropped'), '1');
    assert.deepEqual(stream.mock.calls[0].arguments[5].history, [{ role: 'assistant', content: 'A1' }]);
});

test('POST /api/ai/chat-stream validates history and answers 400 AI_CONTEXT_FULL for an oversized question', async (t) => {
    t.mock.method(financialSummary, 'getSummary', async () => summary);
    const stream = t.mock.method(ai, 'getChatStream', () => assert.fail('must not stream'));

    const bad = await call('POST', '/api/ai/chat-stream', { question: 'hi', history: [{ role: 'system', content: 'x' }] });
    assert.equal(bad.status, 400);

    const full = await call('POST', '/api/ai/chat-stream', { question: 'x'.repeat(20_000) });
    assert.equal(full.status, 400);
    assert.equal(full.json.error.code, 'AI_CONTEXT_FULL');
    assert.equal(stream.mock.callCount(), 0);
});
