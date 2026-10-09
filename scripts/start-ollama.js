/**
 * Starts the local Ollama server (used by `npm run dev:ai` and run-all-ai.bat).
 *
 * - If Ollama is already listening on OLLAMA_PORT (default 11434) nothing is started.
 * - Looks for `ollama` in PATH, then in the default Windows / macOS / Linux install locations.
 * - Exits with code 1 and a clear message when Ollama is not installed, so the rest of the
 *   project (client + server) keeps running without AI.
 */
const { spawn, spawnSync } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.OLLAMA_PORT || 11434);
const HOST = process.env.OLLAMA_HOST_NAME || '127.0.0.1';

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
  if (which.status === 0 && which.stdout.trim()) {
    return which.stdout.trim().split(/\r?\n/)[0];
  }

  const candidates = isWin
    ? [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Ollama', 'ollama.exe')
    ]
    : [
      '/usr/local/bin/ollama',
      '/opt/homebrew/bin/ollama',
      '/usr/bin/ollama',
      path.join(os.homedir(), '.ollama', 'bin', 'ollama')
    ];

  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

(async () => {
  if (await isPortOpen(HOST, PORT)) {
    console.log(`[ollama] already running on ${HOST}:${PORT} - nothing to start`);
    return;
  }

  const exe = findOllama();
  if (!exe) {
    console.error('[ollama] Ollama is not installed on this machine (not in PATH and not in the default install folder).');
    console.error('[ollama] Install it from https://ollama.com and run: ollama pull qwen3:8b');
    console.error('[ollama] The app keeps running without AI. The AI tab will show a clear "AI service unavailable" message.');
    process.exit(1);
  }

  console.log(`[ollama] starting: ${exe} serve  (model: ${process.env.AI_MODEL || 'qwen3:8b'})`);
  const child = spawn(exe, ['serve'], { stdio: 'inherit' });

  child.on('exit', (code) => {
    console.log(`[ollama] exited with code ${code}`);
    process.exit(code ?? 0);
  });

  const stop = () => { child.kill(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})();
