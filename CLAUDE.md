# CLAUDE.md

Guidance for Claude Code (and other AI assistants) working in this repository.

## What this project is

Personal finance app: monthly cash flow, installments/loans, investments, budget tracker, financial goals and an AI assistant.
Angular 21 client (`src/`) + Express 5 server (`server/`) + SQL Server. UI language is Hebrew first (RTL), English second.

## Commands

```bash
npm install && npm install --prefix server   # once
npm run dev          # server + client, no AI
npm run dev:ai       # Ollama + server + client (scripts/start-ollama.js skips Ollama when a remote AI provider is configured)
npm start            # client only (ng serve, port 4300)
npm run server       # server only (port 3000)
npm run build        # production build -> dist/cash-flow-app/browser (served by the server when present)
npm test             # Angular unit tests (Karma + ChromeHeadless): npx ng test --watch=false --browsers=ChromeHeadless
npm test --prefix server     # server unit + HTTP tests (node:test). No DB, no AI needed.
npm run test:db --prefix server   # checks DB_CONNECTION_STRING against a real SQL Server
```

Node 24+ for both parts (`engines`, `.nvmrc`). Do not reintroduce separate Node versions.

## Architecture (read docs/architecture/ARCHITECTURE.md for the full picture)

- **Client**: standalone components under `src/app/features/<feature>/`, one data service per domain under `src/app/services/` (HttpClient + signals). Routes are lazy (`app.routes.ts`). All API calls go through services, never from components.
- **Server**: `app.js` builds the Express app (CORS, JSON limit, logging, /health, static client, error handler); `index.js` connects to SQL Server and listens. `routes/` validate and delegate, `services/` hold business logic, `repositories/` hold all SQL (via `db/helpers.js` + `db/mappers.js`). Only repositories touch the database.
- **AI**: `routes/ai.routes.js` -> `services/financialSummary.service.js` (cached summary built by `services/cashflow-engine.js`) -> `services/ai.service.js` (provider: Ollama `/api/generate` or any OpenAI-compatible `/chat/completions`, chosen by `AI_PROVIDER`). Only the compact summary is sent to the model.
- **Errors**: throw `ValidationError` / `NotFoundError` / `ServiceUnavailableError` / `TooManyRequestsError` from `utils/errors.js` inside `asyncHandler`; the error middleware answers `{ success:false, error:{ name, message, code? } }`. The client interceptor reads that envelope (`extractServerMessage`).
- **Cash flow save** is differential (`db/cashFlowDiff.js`): only changed months are written. Goals re-analysis loads the context once and writes once (`goalsRepository.updateMany`).

## Conventions

- Files use **CRLF** line endings (git autocrlf). Keep them; do not reformat whole files.
- Hebrew is fine in comments, UI strings and docs. UI text goes through ngx-translate (`public/assets/i18n/he.json`, `en.json`); do not hardcode visible strings in templates.
- Angular: standalone components, `@if/@for` control flow, signals for state (`signal/computed`, `toObservable` only where an rxjs consumer still exists), `inject()` for DI, `ChangeDetectionStrategy.OnPush` on presentational components, Reactive Forms only.
- Server: CommonJS (`require`), one exported singleton per service/repository (`module.exports = new X()`), ids are `uuid` v4, timestamps ISO strings, all SQL parameters typed through `db/helpers.js` column specs.
- Logging through `utils/logger.js` (never `console.*` in routes/services/repositories).
- New server logic gets a `node:test` file under `server/test/` (stub repositories with `t.mock.method`, see existing tests). New Angular logic gets a `.spec.ts` next to it.
- Bundle budgets are enforced in `angular.json` production config (`anyComponentStyle` 20kB warn / 32kB error). Do not raise them again; split SCSS instead.

## Environment and secrets

- `server/.env` (git-ignored) holds `DB_CONNECTION_STRING` and the AI settings. Template with every variable: `server/.env.example`.
- The developer machine may have **no SQL Server and no Ollama**. The server then exits at startup with a clear message; use the test suite, which needs neither.
- Never commit `.env`, `server/logs/*.log`, `dist/`.

## Git rules for assistants

- Do **not** stage, commit or push on your own. The owner commits. When explicitly asked to commit, use a feature branch (never `main`), write a descriptive message and push with `-u`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` when Claude wrote the change.

## Documentation map

`docs/README.md` is the index. Update the relevant doc when behaviour changes:
getting-started (run, database), architecture (overview, optimizations), server (API, logging), frontend (feature guides), ai (providers, dev prompt), archive (history, do not edit).
`ARCHITECTURE_DIAGRAM.html` and `AI_OPTIONS.html` are self-contained pages; their node/edge data lives in each file's `<script>`.

**Diagram layout rule**: both pages run a built-in layout check after rendering (text inside every card, no arrow label over a card, band title or another label, no overlapping cards, nothing off-canvas) and write the result to a hidden `<pre id="layout-check">`. After any diagram edit, run it and require `LAYOUT OK`, then look at a screenshot:

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --virtual-time-budget=3000 --dump-dom "file:///C:/dev-gal/cash-flow-app/ARCHITECTURE_DIAGRAM.html" | grep -o '<pre id="layout-check"[^<]*'
```
