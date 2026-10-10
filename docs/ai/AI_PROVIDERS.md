# חיבור למודל AI: מקומי, מרוחק, או ספק API חינמי

העוזר שולח למודל **סיכום פיננסי קומפקטי** (לא את הנתונים הגולמיים) ומקבל טקסט. כל ספק שמדבר באחד משני הפרוטוקולים האלה עובד, בלי שינוי קוד:

| `AI_PROVIDER` | פרוטוקול | מתאים ל- |
| --- | --- | --- |
| `ollama` (ברירת מחדל) | Ollama `/api/generate` | Ollama על המחשב הזה או על מחשב אחר ברשת |
| `openai` | OpenAI Chat Completions `/chat/completions` (כולל streaming ב-SSE) | Groq, OpenRouter, Google Gemini, Mistral, Cloudflare Workers AI, Together, LM Studio, vLLM, llama.cpp server וכל API תואם |

ההגדרה כולה ב-`server/.env` (תבנית מלאה ב-`server/.env.example`):

```ini
AI_PROVIDER=openai
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=openai/gpt-oss-20b
AI_API_KEY=gsk_...
# AI_TIMEOUT_MS=60000
```

הקוד: `server/services/ai.service.js`. בדיקות מול שרת מדומה: `server/test/ai-providers.test.js`.

## הבעיה שפותרים

Ollama מקומי מריץ את המודל על ה-CPU של המחשב ותופס אותו כמעט כולו בזמן בקשה. שלוש דרכים לפתור:

1. **Ollama על מחשב אחר ברשת** (הנתונים נשארים אצלך, אפס עלות, המחשב שלך פנוי).
2. **ספק API מרוחק עם מכסה חינמית** (אפס עלות עד המכסה, מהיר מאוד, אבל הסיכום הפיננסי עובר לספק).
3. שילוב: Groq ביום-יום, Ollama כגיבוי.

## אפשרות 1: Ollama על מחשב אחר

על המחשב שמריץ את Ollama:

```powershell
# Windows: Ollama מאזין רק ל-localhost כברירת מחדל. לפתוח לרשת:
[System.Environment]::SetEnvironmentVariable('OLLAMA_HOST', '0.0.0.0', 'User')
# להפעיל מחדש את Ollama (מהמגש או: ollama serve), ולוודא שחומת האש מאפשרת פורט 11434
ollama pull qwen3:8b
```

על המחשב של האפליקציה, ב-`server/.env`:

```ini
AI_PROVIDER=ollama
AI_BASE_URL=http://192.168.1.50:11434
AI_MODEL=qwen3:8b
```

`npm run dev:ai` מזהה שהכתובת לא מקומית, לא מנסה להפעיל Ollama כאן, ורק בודק שהמחשב המרוחק עונה.

## אפשרות 2: ספקי API עם מכסה חינמית

נכון ל-2026-10-09. המכסות משתנות לעיתים קרובות; לפני שבונים על מספר, לבדוק בעמוד הספק. השימוש של האפליקציה קטן: כמה שאלות ביום, כל אחת כ-2,000 עד 4,000 טוקנים.

| ספק | מכסה חינמית (פורסם) | כרטיס אשראי | מודלים לדוגמה | הערות |
| --- | --- | --- | --- | --- |
| **Groq** | 30 בקשות/דקה, 1,000 בקשות/יום, 200,000 טוקנים/יום למודלים הגדולים; 14,400/יום ו-500,000 טוקנים/יום לקטנים | לא נדרש | `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3-32b`, `llama-3.3-70b-versatile` | המהיר ביותר. **ההמלצה הראשונה** לאפליקציה הזו |
| **OpenRouter** | מודלי `:free`: 20 בקשות/דקה, 50 בקשות/יום (1,000/יום אחרי רכישה חד-פעמית של $10 קרדיט) | לא נדרש | כל מודל שמסתיים ב-`:free`, הרשימה מתחלפת | הכי הרבה מודלים לבחירה, מכסה יומית קטנה |
| **Google Gemini** | Flash ו-Flash-Lite חינם; המספרים מוצגים רק ב-AI Studio אחרי התחברות (דיווחים: 10 עד 15 בקשות/דקה, 250 עד 1,500 ביום) | לא נדרש | `gemini-2.5-flash`, `gemini-2.5-flash-lite` | **הנתונים בשכבה החינמית משמשים לאימון** לפי תנאי Google. לשקול בזהירות עם מידע פיננסי |
| **Mistral** | תוכנית חינמית ("Experiment"), ללא סכום מפורסם | לא נדרש | `mistral-small-latest` | אירופאי, תנאים נוחים לפרטיות |
| **Cloudflare Workers AI** | 10,000 "neurons" ליום | לא נדרש (חשבון Cloudflare) | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | endpoint תואם OpenAI: `https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1` |
| Cerebras | ~~חינמי~~ מאז 2026-05: $5 קרדיט ל-30 יום **רק אחרי הוספת כרטיס** | נדרש | | לא מתאים לדרישה "חינמי ללא כרטיס" |
| GitHub Models | **נסגר ב-2026-07-30** | | | לא להשתמש; הגדרות ישנות ל-`models.github.ai` ייכשלו |

מקורות: [OpenRouter: Free LLM APIs compared (2026)](https://openrouter.ai/blog/tutorials/free-llm-apis-compared/), [Free LLM API tiers verified](https://gravity.fast/data/free-llm-api-tiers/), [Groq free tier](https://klymentiev.com/blog/groq-pricing), [OpenRouter rate limits](https://openrouter.zendesk.com/hc/en-us/articles/39501163636379-OpenRouter-Rate-Limits-What-You-Need-to-Know), [Gemini free tier (Sept 2026)](https://www.memetik.ai/guides/gemini-api-free-tier-limits), [GitHub Models retired](https://github.blog/changelog/2026-07-30-github-models-is-now-retired/).

### המלצה

**Groq** עם `openai/gpt-oss-20b` (מהיר, 1,000 בקשות ביום, ללא כרטיס) או `openai/gpt-oss-120b` לאיכות גבוהה יותר. אם Groq לא זמין: **OpenRouter** עם מודל `:free`. **Gemini** רק אם מקבלים שהסיכום ישמש לאימון.

### הגדרה צעד אחר צעד (Groq)

1. חשבון ב-https://console.groq.com, יצירת מפתח ב-*API Keys*.
2. ב-`server/.env`:
   ```ini
   AI_PROVIDER=openai
   AI_BASE_URL=https://api.groq.com/openai/v1
   AI_MODEL=openai/gpt-oss-20b
   AI_API_KEY=gsk_xxxxxxxx
   ```
3. `npm run dev` (לא צריך `dev:ai`; Ollama לא נדרש). לשונית ה-AI עובדת מול Groq.
4. בדיקה מהירה: `curl -X POST http://localhost:3000/api/ai/chat -H "Content-Type: application/json" -d "{\"question\":\"hello\"}"`.

אותם שלבים לשאר הספקים, עם הכתובת, המודל והמפתח מהטבלה (דוגמאות מוכנות ב-`.env.example`).

### מה קורה בשגיאות

| מצב | תגובת השרת ללקוח |
| --- | --- |
| הספק לא נגיש / Ollama לא רץ | `503` עם `code: AI_UNAVAILABLE` והודעה שמסבירה מה להפעיל |
| מפתח API שגוי (401/403 מהספק) | `503` עם `code: AI_AUTH` |
| חריגה ממכסת הספק (429) | `429` עם `code: RATE_LIMITED` |
| המודל לא ענה תוך `AI_TIMEOUT_MS` | `503` עם `code: AI_TIMEOUT` |

בכל המקרים שאר האפליקציה ממשיכה לעבוד. לשונית ה-AI מציגה את ההודעה.

## פרטיות

- עם Ollama (מקומי או ברשת הביתית) שום דבר לא יוצא החוצה.
- עם ספק מרוחק, הסיכום הפיננסי (יתרות, ממוצעים, שמות פריסות והשקעות, תחזית) נשלח לספק. בלי שמות אנשים, בלי מספרי חשבון, בלי פירוט תנועות. מפתח ה-API נשאר ב-`.env` בשרת ולא מגיע לדפדפן.
- מומלץ לא לשמור מפתחות בקוד או ב-git. `.env` ב-`.gitignore`.

## הרחבה בעתיד

להוסיף ספק עם פרוטוקול אחר (למשל Anthropic Messages API) פירושו להוסיף אובייקט ל-`providers` ב-`ai.service.js` עם `path`, `body()`, `parseFull()` ו-`streamLine()`, ובדיקה ב-`test/ai-providers.test.js`. שאר הקוד לא משתנה.
