/**
 * Tests the two AI providers (Ollama and OpenAI-compatible) against a fake model server
 * running on 127.0.0.1, including streaming, <think> filtering, auth, rate limit and timeout.
 */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const ai = require('../services/ai.service');

let server, base, lastRequest, behaviour;

before(async () => {
    server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            lastRequest = { path: req.url, headers: req.headers, body: JSON.parse(body) };
            behaviour(req, res, lastRequest.body);
        });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((r) => server.close(r)));
beforeEach(() => {
    process.env.AI_TIMEOUT_MS = '2000';
    process.env.AI_API_KEY = '';
});

function collectStream(prompt) {
    return new Promise((resolve, reject) => {
        let text = '';
        ai.streamGenerate(prompt, (t) => (text += t), () => resolve(text), reject);
    });
}

// ---------------------------------------------------------------- Ollama
test('ollama: full answer, think block stripped, request shape', async () => {
    process.env.AI_PROVIDER = 'ollama'; process.env.AI_BASE_URL = base; process.env.AI_MODEL = 'qwen3:8b';
    behaviour = (req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ response: '<think>hmm</think>Balance is fine.', done: true })); };

    const text = await ai.generate({ system: 'SYS', user: 'USER' });
    assert.equal(text, 'Balance is fine.');
    assert.equal(lastRequest.path, '/api/generate');
    assert.equal(lastRequest.body.model, 'qwen3:8b');
    assert.equal(lastRequest.body.stream, false);
    assert.match(lastRequest.body.prompt, /^SYS\n\nUSER$/);
    assert.equal(lastRequest.headers.authorization, undefined, 'no auth header without a key');
});

test('ollama: streaming filters the think block across tokens', async () => {
    process.env.AI_PROVIDER = 'ollama'; process.env.AI_BASE_URL = base;
    behaviour = (req, res) => {
        res.setHeader('Content-Type', 'application/x-ndjson');
        ['<think>', 'reasoning', '</think>Hel', 'lo ', 'world'].forEach((t) => res.write(JSON.stringify({ response: t, done: false }) + '\n'));
        res.end(JSON.stringify({ response: '', done: true }) + '\n');
    };
    assert.equal(await collectStream({ system: 'S', user: 'U' }), 'Hello world');
});

// ---------------------------------------------------------------- OpenAI-compatible
test('openai: chat completions request with bearer key and system/user messages', async () => {
    process.env.AI_PROVIDER = 'openai'; process.env.AI_BASE_URL = base + '/openai/v1'; process.env.AI_MODEL = 'llama-test'; process.env.AI_API_KEY = 'gsk_test';
    behaviour = (req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Answer.' } }] })); };

    const text = await ai.generate({ system: 'SYS', user: 'USER' });
    assert.equal(text, 'Answer.');
    assert.equal(lastRequest.path, '/openai/v1/chat/completions');
    assert.equal(lastRequest.headers.authorization, 'Bearer gsk_test');
    assert.deepEqual(lastRequest.body.messages, [{ role: 'system', content: 'SYS' }, { role: 'user', content: 'USER' }]);
    assert.equal(lastRequest.body.model, 'llama-test');
    assert.equal(lastRequest.body.stream, false);
});

test('openai: SSE streaming (data: lines, [DONE]) is turned into tokens', async () => {
    process.env.AI_PROVIDER = 'openai'; process.env.AI_BASE_URL = base;
    behaviour = (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        const chunk = (c, fin = null) => `data: ${JSON.stringify({ choices: [{ delta: { content: c }, finish_reason: fin }] })}\n\n`;
        res.write(chunk('Hel')); res.write(chunk('lo')); res.write(chunk(' there', 'stop'));
        res.end('data: [DONE]\n\n');
    };
    assert.equal(await collectStream({ system: 'S', user: 'U' }), 'Hello there');
    assert.equal(lastRequest.body.stream, true);
});

test('openai: 401 becomes a 503 with code AI_AUTH, 429 becomes a 429', async () => {
    process.env.AI_PROVIDER = 'openai'; process.env.AI_BASE_URL = base;
    behaviour = (req, res) => { res.statusCode = 401; res.end('{"error":{"message":"bad key"}}'); };
    await assert.rejects(ai.generate({ system: 'S', user: 'U' }), (err) => err.statusCode === 503 && err.code === 'AI_AUTH');

    behaviour = (req, res) => { res.statusCode = 429; res.end('rate limited'); };
    await assert.rejects(ai.generate({ system: 'S', user: 'U' }), (err) => err.statusCode === 429 && err.code === 'RATE_LIMITED');
});

test('a provider that is not listening becomes a 503 AI_UNAVAILABLE', async () => {
    process.env.AI_PROVIDER = 'openai'; process.env.AI_BASE_URL = 'http://127.0.0.1:1';
    await assert.rejects(ai.generate({ system: 'S', user: 'U' }), (err) => err.statusCode === 503 && err.code === 'AI_UNAVAILABLE');
});

test('a slow provider hits AI_TIMEOUT_MS and becomes a 503 AI_TIMEOUT', async () => {
    process.env.AI_PROVIDER = 'ollama'; process.env.AI_BASE_URL = base; process.env.AI_TIMEOUT_MS = '150';
    behaviour = () => { /* never answers */ };
    await assert.rejects(ai.generate({ system: 'S', user: 'U' }), (err) => err.statusCode === 503 && err.code === 'AI_TIMEOUT');
});

test('describe() reflects the configuration and defaults', () => {
    process.env.AI_PROVIDER = 'openai'; process.env.AI_BASE_URL = 'https://api.groq.com/openai/v1'; process.env.AI_MODEL = 'openai/gpt-oss-20b'; process.env.AI_API_KEY = 'x';
    assert.deepEqual(ai.describe(), { provider: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-20b', hasApiKey: true, missingApiKey: false });
    // no AI settings at all -> Groq, and the missing key is reported
    delete process.env.AI_PROVIDER; delete process.env.AI_BASE_URL; delete process.env.AI_MODEL; process.env.AI_API_KEY = '';
    assert.deepEqual(ai.describe(), { provider: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-20b', hasApiKey: false, missingApiKey: true });
    process.env.AI_PROVIDER = 'ollama';
    assert.deepEqual(ai.describe(), { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'qwen3:8b', hasApiKey: false, missingApiKey: false });
});

test('AI_PROVIDER=groq is another name for the OpenAI-compatible provider', () => {
    process.env.AI_PROVIDER = 'Groq'; delete process.env.AI_BASE_URL; delete process.env.AI_MODEL;
    assert.equal(ai.getConfig().provider, 'openai');
    assert.equal(ai.getConfig().baseUrl.origin, 'https://api.groq.com');
});

test('remote provider without AI_API_KEY: 503 AI_NO_KEY, nothing is sent', async () => {
    process.env.AI_PROVIDER = 'openai'; process.env.AI_BASE_URL = 'https://api.groq.com/openai/v1'; process.env.AI_API_KEY = '';
    await assert.rejects(ai.generate({ system: 'S', user: 'U' }), (err) => err.statusCode === 503 && err.code === 'AI_NO_KEY' && /console\.groq\.com/.test(err.message));
    await assert.rejects(collectStream({ system: 'S', user: 'U' }), (err) => err.code === 'AI_NO_KEY');
});

test('a local OpenAI-compatible server (LM Studio, vLLM) works without a key', async () => {
    process.env.AI_PROVIDER = 'openai'; process.env.AI_BASE_URL = base; process.env.AI_API_KEY = '';
    behaviour = (req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })); };
    assert.equal(await ai.generate({ system: 'S', user: 'U' }), 'ok');
    assert.equal(lastRequest.headers.authorization, undefined);
});

test('thinkFilter and stripThinking', () => {
    const f = ai.thinkFilter();
    assert.equal(['a', '<think>x', 'y</think>b', 'c'].map(f).join(''), 'abc');
    assert.equal(ai.stripThinking('<think>\nplan\n</think>\nResult'), 'Result');
});
