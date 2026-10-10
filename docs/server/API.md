# API

Base URL: `http://localhost:3000/api`. כל הגופים הם JSON. מזהים הם מחרוזות uuid.

## בריאות

`GET /health` (ללא `/api`). מחזיר `200` עם `status: "OK"` או `503` עם `status: "DEGRADED"` ופרטי שגיאת ה-DB.

```json
{ "status": "OK", "database": "OK", "timestamp": "2026-10-09T10:00:00.000Z", "uptime": 12.3 }
```

## תזרים מזומנים

| שיטה | נתיב | תיאור |
| --- | --- | --- |
| GET | `/cash-flow` | `{ months: [...] }` או `null` אם עוד לא נשמר |
| POST | `/cash-flow` | שומר את כל הטבלה (כתיבה דיפרנציאלית: רק חודשים שהשתנו). אחרי השמירה רץ ניתוח של כל היעדים. מחזיר `{ success: true }` |
| GET | `/cash-flow-defaults` | ברירות מחדל לחודש חדש |
| POST | `/cash-flow-defaults` | שומר ברירות מחדל, מחזיר את הערכים המנורמלים |

חודש:

```json
{
  "month": "2026-07-01T00:00:00.000Z",
  "startingBalance": 10000, "income": 15000,
  "mortgagePayment": 5000, "loanPayment": 2000, "manualLoanPayment": 500, "installmentsPayment": 1500,
  "additionalIncomes": [{ "description": "בונוס", "amount": 1000 }],
  "regularExpenses":  [{ "description": "ארנונה", "amount": 500, "category": "HOUSING" }],
  "specialExpenses":  [{ "description": "מקדמה", "amount": 3000, "category": "OTHER", "goalRelated": true, "goalId": "..." }],
  "endingBalance": 17500, "rowColor": "#dcfce7"
}
```

## פריסות תשלומים

| שיטה | נתיב | תיאור |
| --- | --- | --- |
| GET | `/installments` | כל הפריסות |
| GET | `/installments/:id` | פריסה אחת (`404` אם לא קיימת) |
| POST | `/installments` | יצירה. חובה `name`. מחזיר `201` עם הפריסה |
| PUT | `/installments/:id` | עדכון חלקי |
| DELETE | `/installments/:id` | `{ success: true }` |

שדות: `name, totalAmount, downPayment, monthlyPayment, installmentsCount, startDate (YYYY-MM-DD), color, notes, manualPaidCount, lastManualPaymentDate, paymentType ('manual' | 'loan' | 'milestone'), loanComponents[], milestones[], milestonePayments[], payments[]`.

## השקעות

| שיטה | נתיב | תיאור |
| --- | --- | --- |
| GET | `/investments` | כל ההשקעות (כולל `transactions`, `snapshots`, `simulationRules`) |
| GET | `/investments/:id` | השקעה אחת |
| POST | `/investments` | יצירה. חובה `name`. `201` |
| PUT | `/investments/:id` | עדכון (כולל מערכי העסקאות/הצילומים/החוקים) |
| DELETE | `/investments/:id` | `{ success: true }` |

## תקציב

| שיטה | נתיב | תיאור |
| --- | --- | --- |
| GET | `/budget/settings` | `{ "FOOD": 5000, "CAR": 2000, ... }` תקרה לכל קטגוריה |
| POST | `/budget/settings` | שמירת התקרות |
| GET | `/budget/monthly/:month` | תקציב מחושב לחודש `YYYY-MM` מתוך התזרים: `totalBudget, totalSpent, totalRemaining, overallPercentage, categories[]` |
| GET | `/budget/alerts/:month` | התראות: `category, budgetLimit, actualSpent, overAmount, percentage, severity ('warning' | 'danger')` |

## יעדים פיננסיים

| שיטה | נתיב | תיאור |
| --- | --- | --- |
| GET | `/goals` | כל היעדים, כל אחד עם `analysis` |
| GET | `/goals/overview` | ספירות לפי סטטוס, סכום יעד כולל, היעד הקרוב |
| GET | `/goals/timeline` | אירועי תאריך יעד ותאריך מוצע, ממוינים |
| POST | `/goals/analyze-all` | ניתוח מחדש של כל היעדים הפעילים (`{ analyzed: n }`) |
| GET | `/goals/:id` | יעד אחד |
| POST | `/goals` | יצירה. חובה `name, type, targetAmount > 0, targetDate (YYYY-MM)`. `201` עם היעד המנותח |
| PUT | `/goals/:id` | עדכון, ואחריו ניתוח של כל היעדים |
| DELETE | `/goals/:id` | `{ success: true }` |
| POST | `/goals/:id/analyze` | ניתוח של יעד אחד, מחזיר את ה-`analysis` |
| GET | `/goals/:id/integration` | הוצאות בתזרים, פריסות והתחייבויות עתידיות שקשורות ליעד |

`analysis`: `achievable, status ('ACHIEVABLE' | 'WARNING' | 'NOT_ACHIEVABLE'), projectedBalance, currentBalance, requiredAtTarget, monthsUntilGoal, monthlySavingsNeeded, suggestedDate, monthsDelay, reasons[], recommendations[], impactOnOtherGoals[], conflicts[], statusMessage`.

## שיחות ודוחות AI

| שיטה | נתיב | תיאור |
| --- | --- | --- |
| GET / POST | `/conversations` | רשימה / יצירה (`title`, `messages[]`) |
| PUT / DELETE | `/conversations/:id` | עדכון / מחיקה |
| GET / POST | `/ai-reports` | רשימה (חדש ראשון, לפי `createdAt`) / יצירה (`type`: `analysis` / `insights` / `scenario`, `content`: מחרוזת, או מערך שורות ב-`insights`, `scenarioDetails?`). בלי `content` מתקבל 400 |
| GET / DELETE | `/ai-reports/:id` | דוח אחד / מחיקה |

## עוזר AI

כל הנתיבים תחת `/ai` מוגבלים ב-rate limit (`AI_RATE_LIMIT_PER_MINUTE`, ברירת מחדל 30 לדקה לכל כתובת). הסיכום הפיננסי נשמר ב-cache (`AI_SUMMARY_CACHE_MS`) ומתאפס בכל בקשת שינוי ל-`/api`.

| שיטה | נתיב | גוף | תיאור |
| --- | --- | --- | --- |
| GET | `/ai/summary` | | הסיכום הפיננסי המחושב (ללא מודל): תקופה, יתרה, ממוצעים, הלוואות, פריסות, השקעות, תחזית 6 חודשים |
| POST | `/ai/analysis` | `{}` | ניתוח מלא: `{ summary, model, analysis }` |
| POST | `/ai/chat` | `{ question }` | תשובה אחת: `{ model, answer }` |
| POST | `/ai/chat-stream` | `{ question }` | `text/plain` ב-chunks. אם המודל נופל באמצע, הגוף מסתיים בשורה `[...]` עם ההודעה |
| POST | `/ai/scenario` | `{ description, amount, date: 'YYYY-MM-DD' }` | `{ simulation, model, scenarioAnalysis }` |
| POST | `/ai/insights` | `{ dashboard?: { kpis, trends }, lang?: 'he' \| 'en' }` | תובנות לדאשבורד: `{ model, insights: [{ type, title, text }], report, archived }` |

**תובנות (`/ai/insights`)**: המודל מקבל את הסיכום מהמסד ואת תמונת הדאשבורד (כרטיסי KPI, תקופות מגרפי המגמות והנחות התחזית). מהלקוח נשמרים רק שדות מספריים מוכרים (`services/insights.service.js`, `sanitizeDashboard`), כך ששום טקסט חופשי מהלקוח לא נכנס ל-prompt. המודל מחזיר JSON, ו-`type` הוא `positive` / `warning` / `risk` / `tip`. התוצאה נשמרת בארכיון (`ai-reports`, `type: 'insights'`) בשרת. אם השמירה נכשלת, התובנות עדיין חוזרות עם `archived: false`.

הספק נקבע ב-`server/.env` (`AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`). ראה [AI_PROVIDERS.md](../ai/AI_PROVIDERS.md). במודלי gpt-oss נשלח `reasoning_effort` (`AI_REASONING_EFFORT`, ברירת מחדל `low`): ה-reasoning נספר בתוך `max_tokens`, וב-effort ברירת המחדל תשובה בעברית יכולה לחזור ריקה.

## פורמט שגיאות

```json
{ "success": false, "error": { "name": "ValidationError", "message": "question is required", "code": "..." } }
```

| סטטוס | `name` | מתי |
| --- | --- | --- |
| 400 | `ValidationError` | קלט לא תקין |
| 404 | `NotFoundError` | ישות לא קיימת, או נתיב לא קיים (`message: "Route not found"`) |
| 429 | `TooManyRequestsError` (`code: RATE_LIMITED`) | חריגה מ-rate limit, עם header `Retry-After` |
| 503 | `ServiceUnavailableError` (`code: AI_UNAVAILABLE` / `AI_TIMEOUT` / `AI_AUTH`) | המודל לא זמין, timeout, או מפתח API שגוי |
| 500 | `InternalError` / אחר | שגיאה לא צפויה. ב-`NODE_ENV=development` נוסף `stack` |

CORS: רק origins מ-`CORS_ORIGIN` (ברירת מחדל `http://localhost:4300`). גוף בקשה עד `JSON_BODY_LIMIT` (1mb).

## דוגמאות

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/cash-flow
curl -X POST http://localhost:3000/api/goals -H "Content-Type: application/json" ^
  -d "{\"name\":\"רכב\",\"type\":\"PURCHASE\",\"targetAmount\":50000,\"targetDate\":\"2027-06\"}"
curl -X POST http://localhost:3000/api/ai/chat -H "Content-Type: application/json" -d "{\"question\":\"מה המצב שלי?\"}"
```
