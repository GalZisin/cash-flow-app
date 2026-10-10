# Cash Flow App

אפליקציית ניהול פיננסי אישי: תזרים מזומנים חודשי, פריסות תשלומים והלוואות, השקעות, מעקב תקציב, יעדים פיננסיים ועוזר AI. ממשק בעברית ובאנגלית (RTL/LTR), מצב בהיר וכהה.

| שכבה | טכנולוגיה |
| --- | --- |
| לקוח | Angular 21 (standalone components, signals), Angular Material, Bootstrap 5.3, GSAP, d3-sankey |
| שרת | Node.js 24, Express 5, ארכיטקטורה שכבתית (Routes → Services → Repositories) |
| מסד נתונים | SQL Server (`CashFlowDB`) דרך `mssql` / `msnodesqlv8` |
| AI (אופציונלי) | Ollama מקומי **או** ספק API מרוחק תואם OpenAI (Groq, OpenRouter, Gemini, Mistral) |

## התחלה מהירה

דרישה אחת: **Node.js 24 ומעלה** (לשרת וללקוח יחד). בדיקה: `node -v`.

```bash
npm install                      # לקוח
npm install --prefix server      # שרת
copy server\.env.example server\.env   # ולמלא DB_CONNECTION_STRING (ראה docs/getting-started/DATABASE_SETUP.md)

npm run dev        # שרת + לקוח, בלי AI       (או לחיצה כפולה על run-all.bat)
npm run dev:ai     # Ollama + שרת + לקוח, עם AI (או run-all-ai.bat)
```

- ממשק: http://localhost:4300
- API: http://localhost:3000/api (בריאות: http://localhost:3000/health)

בדיקות:

```bash
npm test                   # Angular (Karma, Chrome headless)
npm test --prefix server   # שרת (node:test, ללא צורך ב-DB או ב-AI)
```

## תיעוד

כל התיעוד מרוכז בתיקיית [docs/](docs/README.md), לפי נושא:

| נושא | קובץ |
| --- | --- |
| הרצה, קובצי bat, מצב עם/בלי AI | [docs/getting-started/HOW_TO_RUN.md](docs/getting-started/HOW_TO_RUN.md) |
| הקמת SQL Server ו-.env | [docs/getting-started/DATABASE_SETUP.md](docs/getting-started/DATABASE_SETUP.md) |
| ארכיטקטורה וזרימת נתונים | [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) ו-[ARCHITECTURE_DIAGRAM.html](ARCHITECTURE_DIAGRAM.html) (תרשים אינטראקטיבי) |
| ייעולים שבוצעו ומה נשאר | [docs/architecture/OPTIMIZATIONS.md](docs/architecture/OPTIMIZATIONS.md) |
| תיעוד API מלא | [docs/server/API.md](docs/server/API.md) |
| לוגים | [docs/server/LOGGING.md](docs/server/LOGGING.md) |
| חיבור למודל AI: Ollama מקומי / מרוחק / ספקי API חינמיים | [docs/ai/AI_PROVIDERS.md](docs/ai/AI_PROVIDERS.md), [AI_OPTIONS.html](AI_OPTIONS.html) (עמוד ויזואלי עם תרשים לכל אפשרות) |
| מדריכי פיצ'רים (תקציב, יעדים, אנימציות) | [docs/frontend/](docs/README.md#frontend) |
| ערכות צבע (6 ערכות, בהיר וכהה) והוספת ערכה | [src/themes/README.md](src/themes/README.md) |
| הנחיות לעבודה עם Claude Code / עוזרי AI | [CLAUDE.md](CLAUDE.md), [docs/ai/AI_DEVELOPMENT_PROMPT.md](docs/ai/AI_DEVELOPMENT_PROMPT.md) |

## מבנה הפרויקט

```text
cash-flow-app/
├── src/app/                 Angular
│   ├── features/            מסכים: cash-flow, installments, investments, budget-tracker, goals, ai-assistant
│   ├── services/            שירותי נתונים (HttpClient + signals), שפה, ערכת נושא, חישובים
│   ├── models/              טיפוסים משותפים
│   ├── directives/          אנימציות GSAP
│   └── interceptors/        לוג ושגיאות HTTP
├── server/                  Express
│   ├── app.js / index.js    בניית האפליקציה / הפעלה (חיבור ל-DB, האזנה)
│   ├── routes/              נתיבי /api/*
│   ├── services/            לוגיקה עסקית, מנוע תזרים, סיכום פיננסי, חיבור ל-AI
│   ├── repositories/        גישה ל-SQL Server
│   ├── db/                  schema.sql, connection pool, helpers, mappers
│   ├── middleware/          errorHandler, rateLimit
│   ├── test/                בדיקות node:test
│   └── tools/               סקריפטי בדיקת חיבור והקמת משתמש SQL
├── scripts/start-ollama.js  הפעלת Ollama במצב dev:ai
├── docs/                    כל התיעוד
├── run-all.bat / run-all-ai.bat / run-server.bat / run-client.bat
└── ARCHITECTURE_DIAGRAM.html
```

## אבטחה ופרטיות

- הנתונים נשמרים ב-SQL Server מקומי. `server/.env` (מחרוזת החיבור ומפתחות API) אינו ב-git.
- ל-AI נשלח **סיכום פיננסי מחושב** בלבד, לא הנתונים הגולמיים. עם ספק API מרוחק הסיכום עובר לשרת של הספק; עם Ollama הכל נשאר במחשב.
- CORS מוגבל ל-localhost:4300 כברירת מחדל, גוף בקשה עד 1MB, rate limit על נתיבי AI. אין אימות משתמשים: השרת מיועד להרצה מקומית.
