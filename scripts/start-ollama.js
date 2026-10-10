/**
 * Starts the local Ollama server (used by `npm run dev:ai` and run-all-ai.bat).
 *
 * - Reads server/.env: Ollama is only the offline fallback (AI_PROVIDER=ollama). With the default
 *   remote API (Groq) or an AI_BASE_URL on another machine, Ollama is not needed here and the script
 *   exits 0 without starting anything.
 * - If Ollama is already listening on the configured port nothing is started.
 * - Looks for `ollama` in PATH, then in the default Windows / macOS / Linux install locations.
 * - Exits with code 1 and a clear message when Ollama is not installed, so the rest of the
 *   project (client + server) keeps running without AI.
 */
const { spawn, spawnSync } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');

/** Minimal .env parser (KEY=VALUE lines, # comments) so this script has no dependencies. */
function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = { ...readEnvFile(path.join(__dirname, '..', 'server', '.env')), ...process.env };
// Same rule as server/services/ai.service.js: only AI_PROVIDER=ollama uses Ollama, the default is Groq.
const provider = (env.AI_PROVIDER || '').trim().toLowerCase() === 'ollama' ? 'ollama' : 'openai';
let baseUrl;
try { baseUrl = new URL(env.AI_BASE_URL || 'http://localhost:11434'); } catch { baseUrl = new URL('http://localhost:11434'); }
const HOST = baseUrl.hostname;
const PORT = Number(baseUrl.port || 11434);
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1500, () => { socket.destroy(); resolve(false); });
  });
}

function findOllama() {
  const isWin = process.platform === 'win32';
  const which = spawnSync(isWin ? 'where' : 'which', ['ollama'], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim().split(/\r?\n/)[0];

  const candidates = isWin
    ? [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Ollama', 'ollama.exe')
    ]
    : ['/usr/local/bin/ollama', '/opt/homebrew/bin/ollama', '/usr/bin/ollama', path.join(os.homedir(), '.ollama', 'bin', 'ollama')];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

(async () => {
  if (provider === 'openai') {
    console.log(`[ollama] AI_PROVIDER is not "ollama" (remote API, default Groq) - no local Ollama needed. Set AI_PROVIDER=ollama in server/.env for the offline fallback.`);
    return;
  }
  if (!LOCAL_HOSTS.includes(HOST)) {
    const up = await isPortOpen(HOST, PORT);
    console.log(`[ollama] AI_BASE_URL points to another machine (${baseUrl.origin}): ${up ? 'reachable' : 'NOT reachable - check that Ollama runs there with OLLAMA_HOST=0.0.0.0'}.`);
    return;
  }
  if (await isPortOpen(HOST, PORT)) {
    console.log(`[ollama] already running on ${HOST}:${PORT} - nothing to start`);
    return;
  }

  const exe = findOllama();
  if (!exe) {
    console.error('[ollama] Ollama is not installed on this machine (not in PATH and not in the default install folder).');
    console.error('[ollama] Install it from https://ollama.com and run: ollama pull qwen3:8b');
    console.error('[ollama] Or use the default Groq API: remove AI_PROVIDER=ollama from server/.env and set AI_API_KEY (docs/ai/AI_PROVIDERS.md).');
    console.error('[ollama] The app keeps running without AI. The AI tab will show a clear "AI service unavailable" message.');
    process.exit(1);
  }

  console.log(`[ollama] starting: ${exe} serve  (model: ${env.AI_MODEL || 'qwen3:8b'})`);
  const child = spawn(exe, ['serve'], { stdio: 'inherit', env: { ...process.env, OLLAMA_HOST: `${HOST}:${PORT}` } });
  child.on('exit', (code) => { console.log(`[ollama] exited with code ${code}`); process.exit(code ?? 0); });
  const stop = () => child.kill();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})();
