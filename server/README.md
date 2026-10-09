# Cash Flow Server

שרת Express 5 על Node.js 24, מול SQL Server (`CashFlowDB`). התיעוד המלא נמצא ב-[docs/](../docs/README.md).

```bash
npm install
copy .env.example .env        # ולמלא DB_CONNECTION_STRING (ראה docs/getting-started/DATABASE_SETUP.md)
npm start                     # http://localhost:3000   (או מהשורש: npm run server / npm run dev)
npm test                      # 34 בדיקות node:test, ללא DB וללא AI
npm run test:db               # בדיקת חיבור ל-SQL Server עם ה-.env שלך
```

| תיקייה | תפקיד |
| --- | --- |
| `app.js` | בניית אפליקציית Express (CORS, JSON limit, לוג, `/health`, `/api`, הגשת `dist/`, errorHandler) |
| `index.js` | חיבור ל-SQL Server, האזנה, סגירה מסודרת |
| `routes/` | נתיבי `/api/*` (ולידציה, asyncHandler, rate limit ל-AI) |
| `services/` | לוגיקה עסקית, `cashflow-engine`, `financialSummary` (cache), `ai.service` (Ollama / OpenAI-compatible) |
| `repositories/` | כל ה-SQL, דרך `db/helpers.js` ו-`db/mappers.js` |
| `db/` | `schema.sql`, `connection.js`, `cashFlowDiff.js`, מיגרציה חד-פעמית מ-JSON |
| `middleware/` | `errorMiddleware.js`, `rateLimit.js` |
| `utils/` | `logger.js`, `errors.js`, `asyncHandler.js` |
| `test/` | בדיקות (`npm test`) |
| `tools/` | בדיקת חיבור, SQL להקמת משתמש ותיקון הרשאות |

תיעוד רלוונטי: [API](../docs/server/API.md), [לוגים](../docs/server/LOGGING.md), [מסד נתונים](../docs/getting-started/DATABASE_SETUP.md), [ספקי AI](../docs/ai/AI_PROVIDERS.md).
