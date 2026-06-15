/**
 * AI Service — wraps Ollama HTTP API.
 * Receives a compact financial summary DTO, never the raw full dataset.
 */

const http = require('http');

const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const MODEL = process.env.AI_MODEL || 'qwen3:8b';

/**
 * Helper to handle streaming from Ollama.
 */
function streamOllama(prompt, onToken, onDone, onError) {
  const body = JSON.stringify({ 
    model: MODEL, 
    prompt, 
    stream: true, 
    options: { temperature: 0.3, num_ctx: 2048, num_predict: 1024 } 
  });

  const req = http.request(
    { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/generate', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
    (res) => {
      let isThinking = false;
      res.on('data', chunk => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            let token = parsed.response || '';
            
            // Simple filtering for <think> blocks in streaming
            if (token.includes('<think>')) isThinking = true;
            if (isThinking) {
              if (token.includes('</think>')) {
                isThinking = false;
                token = token.split('</think>')[1] || '';
              } else continue;
            }
            
            if (token) onToken(token);
            if (parsed.done) onDone();
          } catch (e) { /* ignore partial parse errors */ }
        }
      });
    }
  );
  req.on('error', onError);
  req.write(body);
  req.end();
}

/**
 * Send a prompt to Ollama and return the full response text.
 * Uses non-streaming mode for simplicity.
 */
function callOllama(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.3, num_ctx: 2048, num_predict: 1024 }, think: false });

    const req = http.request(
      { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/generate', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) { reject(new Error(`Ollama error: ${parsed.error}`)); return; }
            // Strip <think>...</think> blocks (qwen3 thinking mode) but keep the rest
            const raw = parsed.response || '';
            const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            // If stripping removed everything, return raw (model didn't use think tags)
            resolve(cleaned || raw.trim());
          } catch {
            reject(new Error(`Failed to parse Ollama response: ${data.substring(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(300000, () => { req.destroy(); reject(new Error('Ollama request timed out')); });
    req.write(body);
    req.end();
  });
}

/**
 * System persona injected into every prompt.
 */
const SYSTEM_PERSONA = `You are a personal financial advisor AI assistant. 
Rules you MUST follow:
- ONLY use the financial data provided in the JSON summary below.
- NEVER invent, assume, or hallucinate numbers not present in the data.
- Be concise, clear, and practical.
- Respond in the same language the user writes in.
- Always cite the relevant numbers from the data when making a point.
- Format your response with clear sections using markdown.`;

/**
 * Build full analysis prompt from financial summary.
 */
function buildAnalysisPrompt(summary) {
  return `${SYSTEM_PERSONA}

## Financial Data Summary
\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

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

/**
 * Build chat prompt for a user question with financial context.
 */
function buildChatPrompt(summary, userQuestion) {
  return `${SYSTEM_PERSONA}

## Financial Data Summary
\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

## User Question
${userQuestion}

## Instructions
Answer the question directly and accurately using only the data above.
If the answer requires a calculation, show the math step by step.
If the data doesn't contain enough information to answer, say so clearly.`;
}

/**
 * Build scenario simulation prompt.
 */
function buildScenarioPrompt(summary, scenario, simulationResult) {
  return `${SYSTEM_PERSONA}

## Financial Data Summary
\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

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

async function getAnalysis(summary) {
  const prompt = buildAnalysisPrompt(summary);
  const text = await callOllama(prompt);
  return { model: MODEL, analysis: text };
}

async function getChatStream(summary, userQuestion, onToken, onDone, onError) {
  const prompt = buildChatPrompt(summary, userQuestion);
  streamOllama(prompt, onToken, onDone, onError);
}

async function getChat(summary, userQuestion) {
  const prompt = buildChatPrompt(summary, userQuestion);
  const text = await callOllama(prompt);
  return { model: MODEL, answer: text };
}

async function getScenario(summary, scenario, simulationResult) {
  const prompt = buildScenarioPrompt(summary, scenario, simulationResult);
  const text = await callOllama(prompt);
  return { model: MODEL, scenarioAnalysis: text };
}

module.exports = { getAnalysis, getChat, getScenario, getChatStream };
