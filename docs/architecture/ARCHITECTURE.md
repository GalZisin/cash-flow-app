# ארכיטקטורה

תרשים אינטראקטיבי: [ARCHITECTURE_DIAGRAM.html](../../ARCHITECTURE_DIAGRAM.html) (מבט-על + תרשים מפורט עם ריחוף ולחיצה).

## מבט-על

שלוש שכבות שמדברות רק דרך ממשקים מוגדרים:

```text
דפדפן (Angular 21, :4300)
  מסכים ──► שירותי Angular ──► HTTP REST/JSON (/api/*)
                                       │
שרת (Node 24 + Express 5, :3000)       ▼
  routes/ ──► services/ ──► repositories/ ──► SQL Server (CashFlowDB)
     └──► מודול AI: financialSummary ──► ai.service ──► מודל שפה (Ollama / API מרוחק)
```

- הלקוח לא ניגש למסד הנתונים ולא למודל. הכל דרך השרת.
- רק `repositories/` מריצים SQL. `services/` לא יודעים על SQL ולא על HTTP.
- מודול ה-AI מקבל **סיכום פיננסי קומפקטי** (DTO שמחושב ב-`cashflow-engine.js`), לא את הנתונים הגולמיים.

## צד לקוח

| חלק | מיקום | תפקיד |
| --- | --- | --- |
| מעטפת | `src/app/app.component.*` | ניווט, החלפת שפה (RTL/LTR), מצב כהה |
| ניתוב | `src/app/app.routes.ts` | 6 מסכים ב-lazy loading: cashflow, installments, investments, budget, goals, ai |
| הגדרות | `src/app/app.config.ts` | HttpClient + interceptor, ngx-translate, Material defaults |
| מסכים | `src/app/features/<feature>/` | קומפוננטות standalone. המסך הגדול ביותר הוא טבלת התזרים |
| שירותי נתונים | `src/app/services/` | אחד לכל תחום. HttpClient לקריאות, signals ל-state. `cash-flow-simulation.service.ts` מחשב בלקוח את השפעת היעדים על התזרים |
| תשתית | `interceptors/`, `directives/`, `models/`, `utils/` | לוג ושגיאות HTTP, אנימציות GSAP, טיפוסים, אנליטיקה |

כללים: קומפוננטה פונה לשירות, לא ל-HTTP ישירות. state בשירות הוא signal (עם `toObservable` רק למי שעדיין צורך rxjs). קומפוננטות תצוגה ב-OnPush.

## צד שרת

| שכבה | מיקום | תפקיד |
| --- | --- | --- |
| כניסה | `server/app.js`, `server/index.js` | `app.js` בונה את Express: CORS מוגבל, גבול גוף בקשה, לוג בקשות, `/health`, `/api`, הגשת `dist/` בפרודקשן, 404, errorHandler. `index.js` מתחבר ל-SQL Server ומאזין |
| Routes | `server/routes/` | ולידציה של קלט, קריאה ל-service, תשובה. עטופים ב-`asyncHandler`. נתיבי AI גם ב-rate limit |
| Services | `server/services/` | לוגיקה עסקית: נורמליזציה, ניתוח יעדים (`goals-analyzer`), תקציב חודשי, סיכום פיננסי (`financialSummary` עם cache), חיבור למודל (`ai.service`) |
| Repositories | `server/repositories/` | כל ה-SQL. טרנזקציות ופרמטרים מוקלדים דרך `db/helpers.js`, מיפוי אובייקט↔שורה ב-`db/mappers.js` |
| DB | `server/db/` | `schema.sql` (19 טבלאות), `connection.js` (pool יחיד), `cashFlowDiff.js` (שמירה דיפרנציאלית) |

## זרימות מרכזיות

**שמירת תזרים**: טבלה → `CashFlowService.save()` → `POST /api/cash-flow` → `cashFlow.service` → `cashFlow.repository.write()` משווה למצב הקיים וכותב רק חודשים שהשתנו בטרנזקציה אחת → `goals.service.analyzeAllGoals()` טוען תזרים ויעדים פעם אחת, מנתח בזיכרון וכותב פעם אחת.

**שאלה ל-AI**: `AiService.chatStream()` (fetch) → `POST /api/ai/chat-stream` → `financialSummary.getSummary()` (cache 60 שניות, מתאפס בכל בקשת שינוי) → `ai.service.getChatStream()` → המודל → טוקנים זורמים חזרה כ-chunked text. אם המודל לא זמין: 503 עם `code: AI_UNAVAILABLE`.

**יצירת יעד**: `POST /api/goals` → `goals.service.createGoal()` → `goals.repository.create()` → `analyzeAllGoals()` → הלקוח מעדכן signal → `CashFlowSimulation` מחשב תזרים מדומה בצד הלקוח.

## החלטות עיצוב

- **SQL Server במקום JSON**: טבלאות מנורמלות עם `extra_json` בכל טבלה כדי לא לאבד שדות שהאפליקציה תוסיף בעתיד. כסף ב-`DECIMAL(18,2)`.
- **סיכום במקום נתונים גולמיים ל-AI**: פרומפט קטן, פרטיות טובה יותר, אותו סיכום לכל השאלות ברצף (ולכן cache).
- **ספק AI מתחלף דרך `.env`**: `AI_PROVIDER=ollama` או `openai` (כל endpoint תואם OpenAI). ראה [AI_PROVIDERS.md](../ai/AI_PROVIDERS.md).
- **ללא אימות משתמשים**: האפליקציה מיועדת להרצה מקומית של משתמש אחד. לפני חשיפה לרשת צריך אימות, HTTPS ו-CORS מוגבל לדומיין.
- **מזהים**: uuid v4 בכל הישויות.

## מספרים

6 מסכים, 22 קומפוננטות, 13 שירותי Angular, 8 מודולי routes, 12 שירותי שרת, 7 repositories, 19 טבלאות. בדיקות: 13 (Angular) + 34 (שרת).
