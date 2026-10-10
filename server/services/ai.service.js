/**
 * AI service - sends the compact financial summary (never the raw data) to a language model.
 *
 * Two providers, chosen with AI_PROVIDER in server/.env:
 *   ollama  (default)  Ollama's /api/generate            e.g. AI_BASE_URL=http://localhost:11434  (or another machine)
 *   openai             any OpenAI-compatible /chat/completions endpoint: Groq, OpenRouter, Gemini, Mistral,
 *                      Cloudflare Workers AI, LM Studio, vLLM, ...  needs AI_API_KEY (except local servers)
 *
 * Other settings: AI_MODEL, AI_TIMEOUT_MS (default 60000). Configuration is read per call so tests can change it.
 */
const http = require('http');
const https = require('https');
const { ServiceUnavailableError, TooManyRequestsError } = require('../utils/errors');
const traceMethods = require('../utils/traceMethods');

const OPTIONS = { temperature: 0.3, num_ctx: 2048, num_predict: 1024 };
const MAX_TOKENS = 1024;

function getConfig() {
  const provider = (process.env.AI_PROVIDER || 'ollama').toLowerCase() === 'openai' ? 'openai' : 'ollama';
  const defaultUrl = provider === 'openai' ? 'https://api.groq.com/openai/v1' : 'http://localhost:11434';
  const baseUrl = new URL(process.env.AI_BASE_URL || defaultUrl);
  const model = process.env.AI_MODEL || (provider === 'openai' ? 'openai/gpt-oss-20b' : 'qwen3:8b');
  return {
    provider, baseUrl, model,
    apiKey: process.env.AI_API_KEY || '',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 60_000)
  };
}

function unavailableMessage(cfg) {
  return cfg.provider === 'ollama'
    ? `AI service (${cfg.baseUrl.origin}) is not running. Start the app with "npm run dev:ai" or run-all-ai.bat to enable AI.`
    : `AI provider (${cfg.baseUrl.origin}) is not reachable. Check AI_BASE_URL and your network.`;
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
  return err;
}

function httpErrorFor(status, text) {
  if (status === 401 || status === 403) return Object.assign(new Error(`AI provider auth failed (${status})`), { code: 'AI_AUTH' });
  if (status === 429) return Object.assign(new Error('AI provider rate limit (429)'), { code: 'AI_RATE_LIMIT' });
  return new Error(`AI provider error ${status}: ${String(text).substring(0, 300)}`);
}

/** Opens a POST to <baseUrl><path>; the caller consumes the response stream. */
function openRequest(cfg, path, body, onResponse, onError) {
  const client = cfg.baseUrl.protocol === 'https:' ? https : http;
  const basePath = cfg.baseUrl.pathname.replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  if (cfg.provider === 'openai') headers['HTTP-Referer'] = 'https://github.com/GalZisin/cash-flow-app'; // OpenRouter attribution, harmless elsewhere

  const req = client.request(
    { hostname: cfg.baseUrl.hostname, port: cfg.baseUrl.port || (cfg.baseUrl.protocol === 'https:' ? 443 : 80), path: basePath + path, method: 'POST', headers },
    (res) => {
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

const providers = {
  ollama: {
    path: '/api/generate',
    body(cfg, prompt, stream) {
      return JSON.stringify({ model: cfg.model, prompt: prompt.system + '\n\n' + prompt.user, stream, options: OPTIONS, ...(stream ? {} : { think: false }) });
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
    body(cfg, prompt, stream) {
      return JSON.stringify({
        model: cfg.model, stream, temperature: OPTIONS.temperature, max_tokens: MAX_TOKENS,
        messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }]
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

/** Sends a prompt and resolves with the full, think-stripped answer. */
function generate(prompt) {
  const cfg = getConfig();
  const p = providers[cfg.provider];
  return new Promise((resolve, reject) => {
    openRequest(cfg, p.path, p.body(cfg, prompt, false), (res) => {
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
- Format your response with clear sections using markdown.`;

const summaryBlock = (summary) => `## Financial Data Summary
\`\`\`json
${JSON.stringify(summary, null, 2)}
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

function buildChatPrompt(summary, userQuestion) {
  return { system: SYSTEM_PERSONA, user: `${summaryBlock(summary)}

## User Question
${userQuestion}

## Instructions
Answer the question directly and accurately using only the data above.
If the answer requires a calculation, show the math step by step.
If the data doesn't contain enough information to answer, say so clearly.` };
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
async function getChat(summary, userQuestion) {
  return { model: getConfig().model, answer: await generate(buildChatPrompt(summary, userQuestion)) };
}
function getChatStream(summary, userQuestion, onToken, onDone, onError) {
  streamGenerate(buildChatPrompt(summary, userQuestion), onToken, onDone, onError);
}
async function getScenario(summary, scenario, simulationResult) {
  return { model: getConfig().model, scenarioAnalysis: await generate(buildScenarioPrompt(summary, scenario, simulationResult)) };
}

/** Which provider / model the server is configured for (for /health-style diagnostics and tests). */
function describe() {
  const cfg = getConfig();
  return { provider: cfg.provider, baseUrl: cfg.baseUrl.origin + cfg.baseUrl.pathname.replace(/\/$/, ''), model: cfg.model, hasApiKey: !!cfg.apiKey };
}

module.exports = traceMethods({
  getAnalysis, getChat, getScenario, getChatStream, describe,
  // exported for tests
  getConfig, toServiceError, stripThinking, thinkFilter, providers, generate, streamGenerate
}, 'aiService');
