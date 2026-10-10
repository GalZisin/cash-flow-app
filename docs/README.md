# תיעוד Cash Flow App

כל התיעוד של הפרויקט מרוכז כאן, לפי נושא. התחל ב-[README הראשי](../README.md) לסקירה והתקנה.

## מתחילים (getting-started)

| קובץ | מה יש בו |
| --- | --- |
| [HOW_TO_RUN.md](getting-started/HOW_TO_RUN.md) | הרצה בגירסת Node אחת, קובצי bat, פקודות npm, מצב עם AI ובלי AI, פתרון בעיות |
| [DATABASE_SETUP.md](getting-started/DATABASE_SETUP.md) | הקמת SQL Server, `schema.sql`, משתמש ייעודי, `.env`, ייבוא נתונים ישנים, מבנה הטבלאות |

## ארכיטקטורה (architecture)

| קובץ | מה יש בו |
| --- | --- |
| [ARCHITECTURE.md](architecture/ARCHITECTURE.md) | השכבות, זרימת הנתונים, מי פונה למי, החלטות עיצוב |
| [../ARCHITECTURE_DIAGRAM.html](../ARCHITECTURE_DIAGRAM.html) | תרשים אינטראקטיבי: מבט-על + תרשים מפורט של כל רכיב וחיבור. לפתוח בדפדפן |
| [OPTIMIZATIONS.md](architecture/OPTIMIZATIONS.md) | 20 הצעות הייעול, מה יושם, באגים שנמצאו, מה נשאר |
| [PROJECT_SPECIFICATION.html](architecture/PROJECT_SPECIFICATION.html) | אפיון המערכת המקורי (HTML) |

## שרת (server)

| קובץ | מה יש בו |
| --- | --- |
| [API.md](server/API.md) | כל נתיבי `/api/*`: תזרים, פריסות, השקעות, תקציב, יעדים, שיחות, דוחות, AI. פורמט שגיאות, קודי סטטוס |
| [LOGGING.md](server/LOGGING.md) | רמות לוג, קבצי הלוג, שימוש ב-logger בקוד, ניטור, טבלת לוג גישה ל-API (`log.cash_flow_api_access`) |

## לקוח (frontend)

| קובץ | מה יש בו |
| --- | --- |
| [BUDGET_TRACKER.md](frontend/BUDGET_TRACKER.md) | מסך מעקב התקציב: תכונות, API, קבצים |
| [CASH_FLOW_CHARTS.md](frontend/CASH_FLOW_CHARTS.md) | גרפי מגמות התזרים בדאשבורד יועץ ה-AI: תקופות, תחזית, חישובים |
| [GOALS_INTEGRATION.md](frontend/GOALS_INTEGRATION.md) | אינטגרציה בין יעדים, תזרים ופריסות |
| [GOALS_INTEGRATION_EXAMPLE.md](frontend/GOALS_INTEGRATION_EXAMPLE.md) | דוגמה מעשית צעד אחר צעד |
| [GSAP_ANIMATIONS.md](frontend/GSAP_ANIMATIONS.md) | שלוש דירקטיבות האנימציה ואיך משתמשים בהן |
| [../src/themes/README.md](../src/themes/README.md) | ערכות צבע: מבנה התיקייה, ה-tokens, הוספת ערכה, בדיקת ניגודיות |

## AI (ai)

| קובץ | מה יש בו |
| --- | --- |
| [AI_PROVIDERS.md](ai/AI_PROVIDERS.md), [../AI_OPTIONS.html](../AI_OPTIONS.html) (עמוד ויזואלי) | חיבור למודל: Ollama מקומי, Ollama על מכונה אחרת, ספקי API חינמיים (Groq, OpenRouter, Gemini, Mistral), הגדרות `.env`, השוואה |
| [AI_DEVELOPMENT_PROMPT.md](ai/AI_DEVELOPMENT_PROMPT.md) | system prompt לעוזרי AI שעוזרים לפתח את הפרויקט (קונבנציות, מודלים, דפוסים) |
| [../CLAUDE.md](../CLAUDE.md) | הנחיות ל-Claude Code: פקודות, ארכיטקטורה, קונבנציות, כללי git |

## ארכיון (archive)

תיעוד היסטורי של תהליכים שהסתיימו. לא מתוחזק, נשמר להבנת ההחלטות.

| קובץ | תקופה |
| --- | --- |
| [REFACTORING_PLAN.md](archive/REFACTORING_PLAN.md), [REFACTORING_USAGE_GUIDE.md](archive/REFACTORING_USAGE_GUIDE.md) | רפקטורינג הלקוח (2026-07) |
| [SERVER_REFACTORING_PLAN.md](archive/SERVER_REFACTORING_PLAN.md), [REFACTORING_COMPLETE.md](archive/REFACTORING_COMPLETE.md), [MIGRATION_GUIDE.md](archive/MIGRATION_GUIDE.md) | רפקטורינג השרת לשכבות, עוד בתקופת קובצי ה-JSON (2026-07) |
| [cash-flow-app-documentation-2026-07.pdf](archive/cash-flow-app-documentation-2026-07.pdf) | תיעוד PDF מקיף מתקופת ה-JSON |

## כללים לתיעוד

- כל קובץ md חדש נכנס לאחת התיקיות למעלה ומקבל שורה בטבלה המתאימה.
- כשמתנהגות משתנה (נתיב API, משתנה סביבה, פקודת הרצה) מעדכנים את הקובץ הרלוונטי באותו commit.
- קבצים בשורש הפרויקט: `README.md`, `CLAUDE.md` ושני עמודי ה-HTML העצמאיים (`ARCHITECTURE_DIAGRAM.html`, `AI_OPTIONS.html`).
