/**
 * AI service - talks to an Ollama-compatible /api/generate endpoint.
 * Receives a compact financial summary DTO, never the raw full dataset.
 *
 * Configuration (server/.env):
 *   AI_BASE_URL    where Ollama listens (default http://localhost:11434). Can be a remote machine.
 *   AI_MODEL       model name (default qwen3:8b)
 *   AI_TIMEOUT_MS  per-request timeout (default 60000)
 */
const http = require('http');
const https = require('https');
const { ServiceUnavailableError } = require('../utils/errors');

const BASE_URL = new URL(process.env.AI_BASE_URL || 'http://localhost:11434');
const MODEL = process.env.AI_MODEL || 'qwen3:8b';
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 60_000);
const GENERATE_PATH = '/api/generate';
const OPTIONS = { temperature: 0.3, num_ctx: 2048, num_predict: 1024 };

const AI_UNAVAILABLE_MESSAGE =
  `AI service (${BASE_URL.origin}) is not running. Start the app with "npm run dev:ai" or run-all-ai.bat to enable AI.`;

/** Maps low-level network failures to a 503 the client can explain to the user. */
function toServiceError(err) {
  if (err instanceof ServiceUnavailableError) return err;
  const code = err?.code || '';
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET' || /ECONNREFUSED/.test(err?.message || '')) {
    return new ServiceUnavailableError(AI_UNAVAILABLE_MESSAGE, 'AI_UNAVAILABLE');
  }
  if (code === 'AI_TIMEOUT') {
    return new ServiceUnavailableError(`AI request timed out after ${TIMEOUT_MS / 1000}s`, 'AI_TIMEOUT');
  }
  return err;
}

/** Opens a POST request to the model server; the caller consumes the response stream. */
function openRequest(body, onResponse, onError) {
  const client = BASE_URL.protocol === 'https:' ? https : http;
  const req = client.request(
    {
      hostname: BASE_URL.hostname,
      port: BASE_URL.port || (BASE_URL.protocol === 'https:' ? 443 : 80),
      path: GENERATE_PATH,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    },
    onResponse
  );
  req.on('error', (err) => onError(toServiceError(err)));
  req.setTimeout(TIMEOUT_MS, () => {
    req.destroy(Object.assign(new Error('AI request timed out'), { code: 'AI_TIMEOUT' }));
  });
  req.write(body);
  req.end();
  return req;
}

/**
 * Streams tokens from the model. Blocks wrapped in <think>...</think> (qwen3 "thinking")
 * are filtered out before they reach the client.
 */
function streamGenerate(prompt, onToken, onDone, onError) {
  const body = JSON.stringify({ model: MODEL, prompt, stream: true, options: OPTIONS });
  let finished = false;
  const finish = (fn, arg) => { if (!finished) { finished = true; fn(arg); } };

  openRequest(body, (res) => {
    let isThinking = false;
    res.on('data', (chunk) => {
      for (const line of chunk.toString().split('\n')) {
        if (!line.trim()) continue;
        let parsed;
        try { parsed = JSON.parse(line); } catch { continue; /* partial JSON line */ }
        if (parsed.error) return finish(onError, new Error(`AI error: ${parsed.error}`));

        let token = parsed.response || '';
        if (token.includes('<think>')) isThinking = true;
        if (isThinking) {
          if (!token.includes('</think>')) continue;
          isThinking = false;
          token = token.split('</think>')[1] || '';
        }
        if (token) onToken(token);
        if (parsed.done) finish(onDone);
      }
    });
    res.on('end', () => finish(onDone));
    res.on('error', (err) => finish(onError, toServiceError(err)));
  }, (err) => finish(onError, err));
}

/** Sends a prompt and resolves with the full (think-stripped) response text. */
function generate(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, prompt, stream: false, options: OPTIONS, think: false });
    openRequest(body, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('error', (err) => reject(toServiceError(err)));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch {
          return reject(new Error(`Failed to parse AI response: ${data.substring(0, 200)}`));
        }
        if (parsed.error) return reject(new Error(`AI error: ${parsed.error}`));
        const raw = parsed.response || '';
        const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        resolve(cleaned || raw.trim());
      });
    }, reject);
  });
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

function summaryBlock(summary) {
  return `## Financial Data Summary
\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\``;
}

function buildAnalysisPrompt(summary) {
  return `${SYSTEM_PERSONA}

${summaryBlock(summary)}

## Task
Provide a complete financial health analysis covering:
1. **Current financial position** — balance, income vs expenses
2. **Cash flow trend** — are savings growing or shrinking?
3. **Debt situation** — loans and installments burden
4. **Investment overview** — what's tracked
5. **6-month forecast** — based on the projection data
6. **Top 3 recommendations** — actionable advice based only on this data

Be specific with numbers. Do not add generic advice not supported by the data.`;
}

function buildChatPrompt(summary, userQuestion) {
  return `${SYSTEM_PERSONA}

${summaryBlock(summary)}

## User Question
${userQuestion}

## Instructions
Answer the question directly and accurately using only the data above.
If the answer requires a calculation, show the math step by step.
If the data doesn't contain enough information to answer, say so clearly.`;
}

function buildScenarioPrompt(summary, scenario, simulationResult) {
  return `${SYSTEM_PERSONA}

${summaryBlock(summary)}

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
4. Any risks or warnings`;
}

// ---------------------------------------------------------------- public API

async function getAnalysis(summary) {
  return { model: MODEL, analysis: await generate(buildAnalysisPrompt(summary)) };
}

async function getChat(summary, userQuestion) {
  return { model: MODEL, answer: await generate(buildChatPrompt(summary, userQuestion)) };
}

function getChatStream(summary, userQuestion, onToken, onDone, onError) {
  streamGenerate(buildChatPrompt(summary, userQuestion), onToken, onDone, onError);
}

async function getScenario(summary, scenario, simulationResult) {
  return { model: MODEL, scenarioAnalysis: await generate(buildScenarioPrompt(summary, scenario, simulationResult)) };
}

module.exports = {
  getAnalysis, getChat, getScenario, getChatStream,
  // exported for tests / diagnostics
  MODEL, BASE_URL, TIMEOUT_MS, AI_UNAVAILABLE_MESSAGE, toServiceError
};
