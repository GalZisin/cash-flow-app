/**
 * AI service - sends the compact financial summary (never the raw data) to a language model.
 *
 * Two providers, chosen with AI_PROVIDER in server/.env:
 *   openai  (default)  any OpenAI-compatible /chat/completions endpoint. Default target: Groq
 *                      (https://api.groq.com/openai/v1, model openai/gpt-oss-20b). Also OpenRouter, Gemini,
 *                      Mistral, Cloudflare Workers AI, LM Studio, vLLM, ...  needs AI_API_KEY (except local servers).
 *                      AI_PROVIDER=groq is accepted as another name for it.
 *   ollama             Ollama's /api/generate            e.g. AI_BASE_URL=http://localhost:11434  (or another machine)
 *
 * Other settings: AI_MODEL, AI_TIMEOUT_MS (default 60000), AI_CONTEXT_TOKENS (default 8000: budget of one chat request,
 * prompt + answer, = Groq free tier tokens/min). Configuration is read per call so tests can change it.
 */
const http = require('http');
const https = require('https');
const { ServiceUnavailableError, TooManyRequestsError, ValidationError } = require('../utils/errors');
const traceMethods = require('../utils/traceMethods');

const OPTIONS = { temperature: 0.3, num_ctx: 2048, num_predict: 1024 };
const MAX_TOKENS = 1024;
// Token estimates measured on Groq gpt-oss-20b: the compact JSON prompt runs ~3.2 chars/token, Hebrew chat text ~2.4.
const PROMPT_CHARS_PER_TOKEN = 3;
const MESSAGE_CHARS_PER_TOKEN = 2.4;

function getConfig() {
  const provider = (process.env.AI_PROVIDER || '').trim().toLowerCase() === 'ollama' ? 'ollama' : 'openai';
  const defaultUrl = provider === 'openai' ? 'https://api.groq.com/openai/v1' : 'http://localhost:11434';
  const baseUrl = new URL(process.env.AI_BASE_URL || defaultUrl);
  const model = process.env.AI_MODEL || (provider === 'openai' ? 'openai/gpt-oss-20b' : 'qwen3:8b');
  return {
    provider, baseUrl, model,
    apiKey: process.env.AI_API_KEY || '',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 60_000),
    contextTokens: Number(process.env.AI_CONTEXT_TOKENS ?? 8000)
  };
}

function unavailableMessage(cfg) {
  return cfg.provider === 'ollama'
    ? `AI service (${cfg.baseUrl.origin}) is not running. Start the app with "npm run dev:ai" or run-all-ai.bat to enable AI.`
    : `AI provider (${cfg.baseUrl.origin}) is not reachable. Check AI_BASE_URL and your network.`;
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

/** A remote OpenAI-compatible provider (Groq, ...) without AI_API_KEY: explain instead of sending a request that gets 401. */
function missingKeyError(cfg) {
  if (cfg.provider !== 'openai' || cfg.apiKey || LOCAL_HOSTS.includes(cfg.baseUrl.hostname)) return null;
  return new ServiceUnavailableError(
    `AI_API_KEY is not set in server/.env for ${cfg.baseUrl.origin}. Create a free key at https://console.groq.com/keys and restart the server.`,
    'AI_NO_KEY'
  );
}

/** Maps low-level failures to errors the client can explain (503 / 429). */
function toServiceError(err, cfg = getConfig()) {
  if (err instanceof ServiceUnavailableError || err instanceof TooManyRequestsError) return err;
  const code = err?.code || '';
  if (['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EAI_AGAIN'].includes(code) || /ECONNREFUSED/.test(err?.message || '')) {
    return new ServiceUnavailableError(unavailableMessage(cfg), 'AI_UNAVAILABLE');
  }
  if (code === 'AI_TIMEOUT') return new ServiceUnavailableError(`AI request timed out after ${cfg.timeoutMs / 1000}s`, 'AI_TIMEOUT');
  if (code === 'AI_AUTH') return new ServiceUnavailableError('AI provider rejected the API key (AI_API_KEY).', 'AI_AUTH');
  if (code === 'AI_RATE_LIMIT') return new TooManyRequestsError('AI provider rate limit reached, try again in a minute.');
  if (code === 'AI_TOO_LARGE') return new ValidationError('The conversation is too long for the AI provider. Start a new chat.', 'AI_CONTEXT_FULL');
  return err;
}

function httpErrorFor(status, text) {
  if (status === 401 || status === 403) return Object.assign(new Error(`AI provider auth failed (${status})`), { code: 'AI_AUTH' });
  if (status === 429) return Object.assign(new Error('AI provider rate limit (429)'), { code: 'AI_RATE_LIMIT' });
  if (status === 413) return Object.assign(new Error('AI request too large (413)'), { code: 'AI_TOO_LARGE' });
  return new Error(`AI provider error ${status}: ${String(text).substring(0, 300)}`);
}

// ---------------------------------------------------------------- provider quota

/** "1m26.4s", "659ms", "2h3m" (x-ratelimit-reset-* values) -> milliseconds. */
function parseDuration(text) {
  let ms = 0;
  for (const [, n, unit] of String(text || '').matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) {
    ms += Number(n) * { h: 3_600_000, m: 60_000, s: 1000, ms: 1 }[unit];
  }
  return Math.round(ms);
}

/** x-ratelimit-* response headers (Groq, OpenAI, ...) -> { requests, tokens } with absolute reset times, or null. */
function parseQuota(headers, now = Date.now()) {
  const part = (kind) => {
    const limit = headers[`x-ratelimit-limit-${kind}`], remaining = headers[`x-ratelimit-remaining-${kind}`];
    if (limit === undefined || remaining === undefined || !Number.isFinite(Number(limit))) return null;
    const resetAt = new Date(now + parseDuration(headers[`x-ratelimit-reset-${kind}`])).toISOString();
    return { limit: Number(limit), remaining: Number(remaining), resetAt };
  };
  const requests = part('requests'), tokens = part('tokens');
  return requests || tokens ? { requests, tokens, updatedAt: new Date(now).toISOString() } : null;
}

// Last quota the provider reported (per server process). Ollama sends no such headers, so it stays null there.
let lastQuota = null;

function recordQuota(headers) {
  const quota = parseQuota(headers);
  if (quota) lastQuota = quota;
}

/** The last reported quota; a window whose reset time has passed is shown as full again (approximation). */
function currentQuota(now = Date.now()) {
  if (!lastQuota) return null;
  const fresh = (q) => (q && Date.parse(q.resetAt) <= now ? { ...q, remaining: q.limit } : q);
  return { ...lastQuota, requests: fresh(lastQuota.requests), tokens: fresh(lastQuota.tokens) };
}

/** Opens a POST to <baseUrl><path>; the caller consumes the response stream. */
function openRequest(cfg, path, body, onResponse, onError) {
  const noKey = missingKeyError(cfg);
  if (noKey) { process.nextTick(() => onError(noKey)); return null; }
  const client = cfg.baseUrl.protocol === 'https:' ? https : http;
  const basePath = cfg.baseUrl.pathname.replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  if (cfg.provider === 'openai') headers['HTTP-Referer'] = 'https://github.com/GalZisin/cash-flow-app'; // OpenRouter attribution, harmless elsewhere

  const req = client.request(
    { hostname: cfg.baseUrl.hostname, port: cfg.baseUrl.port || (cfg.baseUrl.protocol === 'https:' ? 443 : 80), path: basePath + path, method: 'POST', headers },
    (res) => {
      recordQuota(res.headers);
      if (res.statusCode >= 400) {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => onError(toServiceError(httpErrorFor(res.statusCode, text), cfg)));
        return;
      }
      onResponse(res);
    }
  );
  req.on('error', (err) => onError(toServiceError(err, cfg)));
  req.setTimeout(cfg.timeoutMs, () => req.destroy(Object.assign(new Error('AI request timed out'), { code: 'AI_TIMEOUT' })));
  req.write(body);
  req.end();
  return req;
}

/** Removes <think>...</think> blocks (qwen3 and similar "thinking" models). */
const stripThinking = (text) => text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

/** Stateful filter that drops <think> blocks from a token stream. */
function thinkFilter() {
  let thinking = false;
  return (token) => {
    if (token.includes('<think>')) thinking = true;
    if (!thinking) return token;
    if (!token.includes('</think>')) return '';
    thinking = false;
    return token.split('</think>')[1] || '';
  };
}

/** Reads a stream line by line and calls onLine for every complete line. */
function lineReader(res, onLine) {
  let buffer = '';
  res.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    lines.forEach((l) => onLine(l));
  });
  res.on('end', () => { if (buffer.trim()) onLine(buffer); });
}

// ---------------------------------------------------------------- providers

/**
 * gpt-oss models reason before answering, and the reasoning counts toward max_tokens: at the default
 * effort a Hebrew answer can spend the whole budget on reasoning and come back empty (finish_reason "length").
 * AI_REASONING_EFFORT (low | medium | high, default low) is sent only to those models.
 */
function reasoningParams(cfg) {
  if (!/gpt-oss/i.test(cfg.model)) return {};
  const effort = (process.env.AI_REASONING_EFFORT || 'low').trim().toLowerCase();
  return ['low', 'medium', 'high'].includes(effort) ? { reasoning_effort: effort } : {};
}

const providers = {
  ollama: {
    path: '/api/generate',
    body(cfg, prompt, stream, maxTokens = MAX_TOKENS) {
      const options = { ...OPTIONS, num_predict: maxTokens };
      const history = (prompt.history || []).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
      const text = [prompt.system, history && `## Conversation so far\n${history}`, prompt.user].filter(Boolean).join('\n\n');
      return JSON.stringify({ model: cfg.model, prompt: text, stream, options, ...(stream ? {} : { think: false }) });
    },
    parseFull(data) {
      const parsed = JSON.parse(data);
      if (parsed.error) throw new Error(`AI error: ${parsed.error}`);
      return parsed.response || '';
    },
    // one JSON object per line
    streamLine(line) {
      if (!line.trim()) return null;
      const parsed = JSON.parse(line);
      if (parsed.error) throw new Error(`AI error: ${parsed.error}`);
      return { token: parsed.response || '', done: !!parsed.done };
    }
  },
  openai: {
    path: '/chat/completions',
    body(cfg, prompt, stream, maxTokens = MAX_TOKENS) {
      return JSON.stringify({
        model: cfg.model, stream, temperature: OPTIONS.temperature, max_tokens: maxTokens,
        ...reasoningParams(cfg),
        messages: [
          { role: 'system', content: prompt.system },
          ...(prompt.history || []).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: prompt.user }
        ]
      });
    },
    parseFull(data) {
      const parsed = JSON.parse(data);
      if (parsed.error) throw new Error(`AI error: ${parsed.error.message || JSON.stringify(parsed.error)}`);
      return parsed.choices?.[0]?.message?.content || '';
    },
    // server-sent events: "data: {...}" lines, ends with "data: [DONE]"
    streamLine(line) {
      const t = line.trim();
      if (!t.startsWith('data:')) return null;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') return { token: '', done: true };
      const parsed = JSON.parse(payload);
      if (parsed.error) throw new Error(`AI error: ${parsed.error.message || JSON.stringify(parsed.error)}`);
      const choice = parsed.choices?.[0];
      return { token: choice?.delta?.content || '', done: choice?.finish_reason != null };
    }
  }
};

/** Sends a prompt and resolves with the full, think-stripped answer. options.maxTokens overrides MAX_TOKENS. */
function generate(prompt, options = {}) {
  const cfg = getConfig();
  const p = providers[cfg.provider];
  return new Promise((resolve, reject) => {
    openRequest(cfg, p.path, p.body(cfg, prompt, false, options.maxTokens), (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('error', (err) => reject(toServiceError(err, cfg)));
      res.on('end', () => {
        try {
          const raw = p.parseFull(data);
          resolve(stripThinking(raw) || raw.trim());
        } catch (err) {
          reject(err.message?.startsWith('AI error') ? err : new Error(`Failed to parse AI response: ${data.substring(0, 200)}`));
        }
      });
    }, reject);
  });
}

/** Streams think-stripped tokens: onToken(text), onDone(), onError(err). */
function streamGenerate(prompt, onToken, onDone, onError) {
  const cfg = getConfig();
  const p = providers[cfg.provider];
  const filter = thinkFilter();
  let finished = false;
  const finish = (fn, arg) => { if (!finished) { finished = true; fn(arg); } };

  openRequest(cfg, p.path, p.body(cfg, prompt, true), (res) => {
    lineReader(res, (line) => {
      if (finished) return;
      let item;
      try { item = p.streamLine(line); } catch (err) {
        if (err.message?.startsWith('AI error')) return finish(onError, err);
        return; // partial / non-JSON line
      }
      if (!item) return;
      const token = filter(item.token);
      if (token) onToken(token);
      if (item.done) finish(onDone);
    });
    res.on('end', () => finish(onDone));
    res.on('error', (err) => finish(onError, toServiceError(err, cfg)));
  }, (err) => finish(onError, err));
}

// ---------------------------------------------------------------- prompts

const SYSTEM_PERSONA = `You are a personal financial advisor AI assistant.
Rules you MUST follow:
- ONLY use the financial data provided in the JSON summary below.
- NEVER invent, assume, or hallucinate numbers not present in the data.
- Be concise, clear, and practical.
- Respond in the same language the user writes in.
- Always cite the relevant numbers from the data when making a point.
- Format your response with clear sections using markdown.
Data notes: amounts are ILS; asOf = today; payments due on/before asOf count as paid.
loans[].components = the loan's parts (interestRate = annual %, payoffDate/payoffAmount = planned early payoff).
installments[].remainingSchedule = unpaid milestones. expensesByCategory.avgMonthly = average per category over its months.
investments[].change = value change since that date; expectedAnnualReturn = user's estimate (%).`;

// Compact JSON (no indentation): the summary goes with every request, and indentation alone is ~30% of its tokens.
const summaryBlock = (summary) => `## Financial Data Summary
\`\`\`json
${JSON.stringify(summary)}
\`\`\``;

function buildAnalysisPrompt(summary) {
  return { system: SYSTEM_PERSONA, user: `${summaryBlock(summary)}

## Task
Provide a complete financial health analysis covering:
1. **Current financial position** — balance, income vs expenses
2. **Cash flow trend** — are savings growing or shrinking?
3. **Debt situation** — loans and installments burden
4. **Investment overview** — what's tracked
5. **6-month forecast** — based on the projection data
6. **Top 3 recommendations** — actionable advice based only on this data

Be specific with numbers. Do not add generic advice not supported by the data.` };
}

/** options.history = earlier turns of this conversation ({ role, content }), options.lang = 'he' | 'en' answer language. */
function buildChatPrompt(summary, userQuestion, options = {}) {
  const language = options.lang ? `\nRespond in ${options.lang === 'en' ? 'English' : 'Hebrew'}.` : '';
  return { system: SYSTEM_PERSONA, history: options.history || [], user: `${summaryBlock(summary)}

## User Question
${userQuestion}

## Instructions
Answer the question directly and accurately using only the data above.
If the answer requires a calculation, show the math step by step.
If the data doesn't contain enough information to answer, say so clearly.${language}` };
}

/**
 * Estimated size of a chat request against AI_CONTEXT_TOKENS. The provider counts the prompt plus the answer budget
 * (max_tokens), so: baseTokens (persona + summary) + reserveTokens + message text / charsPerToken.
 * The client repeats this sum live (history + the text being typed) from baseTokens, reserveTokens and charsPerToken.
 */
function chatContext(summary, options = {}) {
  const base = buildChatPrompt(summary, '');
  const baseTokens = Math.ceil((base.system.length + base.user.length) / PROMPT_CHARS_PER_TOKEN);
  const messageChars = (options.history || []).reduce((sum, m) => sum + m.content.length, 0) + (options.question || '').length;
  const usedTokens = baseTokens + MAX_TOKENS + Math.ceil(messageChars / MESSAGE_CHARS_PER_TOKEN);
  const limitTokens = getConfig().contextTokens;
  return {
    usedTokens, limitTokens, percent: Math.round((usedTokens / limitTokens) * 100),
    baseTokens, reserveTokens: MAX_TOKENS, charsPerToken: MESSAGE_CHARS_PER_TOKEN
  };
}

/** Rejects a chat request that would not fit the context budget (the client offers a new chat). */
function assertChatFits(summary, question, options = {}) {
  const context = chatContext(summary, { ...options, question });
  if (context.usedTokens > context.limitTokens) {
    throw new ValidationError(
      `The conversation is full (${context.percent}% of ${context.limitTokens} tokens). Start a new chat.`, 'AI_CONTEXT_FULL'
    );
  }
  return context;
}

function buildScenarioPrompt(summary, scenario, simulationResult) {
  return { system: SYSTEM_PERSONA, user: `${summaryBlock(summary)}

## Scenario Being Simulated
- Purchase: ${scenario.description}
- Amount: ${scenario.amount.toLocaleString()}
- Date: ${scenario.date}

## Simulation Result
\`\`\`json
${JSON.stringify(simulationResult, null, 2)}
\`\`\`

## Task
Analyze this scenario and explain:
1. The immediate impact on cash balance
2. How long to recover to pre-purchase balance (based on monthly savings average)
3. Whether this purchase is financially advisable given the current data
4. Any risks or warnings` };
}

// ---------------------------------------------------------------- public API

async function getAnalysis(summary) {
  return { model: getConfig().model, analysis: await generate(buildAnalysisPrompt(summary)) };
}
async function getChat(summary, userQuestion, options = {}) {
  assertChatFits(summary, userQuestion, options);
  return { model: getConfig().model, answer: await generate(buildChatPrompt(summary, userQuestion, options)) };
}
/** The route calls assertChatFits first, while it can still answer with a JSON error. */
function getChatStream(summary, userQuestion, onToken, onDone, onError, options = {}) {
  streamGenerate(buildChatPrompt(summary, userQuestion, options), onToken, onDone, onError);
}
async function getScenario(summary, scenario, simulationResult) {
  return { model: getConfig().model, scenarioAnalysis: await generate(buildScenarioPrompt(summary, scenario, simulationResult)) };
}

/** Which provider / model the server is configured for (for /health-style diagnostics and tests). */
function describe() {
  const cfg = getConfig();
  return {
    provider: cfg.provider, baseUrl: cfg.baseUrl.origin + cfg.baseUrl.pathname.replace(/\/$/, ''), model: cfg.model,
    hasApiKey: !!cfg.apiKey, missingApiKey: !!missingKeyError(cfg)
  };
}

/** What the chat tab shows in its meters: the provider quota (null until the provider reports one) and the context budget. */
function getUsage(summary) {
  const cfg = getConfig();
  return { provider: cfg.provider, model: cfg.model, quota: currentQuota(), context: chatContext(summary) };
}

module.exports = traceMethods({
  getAnalysis, getChat, getScenario, getChatStream, describe, getUsage, assertChatFits,
  // exported for tests
  getConfig, toServiceError, stripThinking, thinkFilter, providers, generate, streamGenerate, buildChatPrompt,
  chatContext, parseDuration, parseQuota, currentQuota
}, 'aiService');
