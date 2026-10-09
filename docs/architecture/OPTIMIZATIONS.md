# ייעולים: מה נמצא, מה יושם, מה נשאר

סקירת ארכיטקטורה שבוצעה ב-2026-10-09 העלתה 20 הצעות. כולן יושמו ב-branch `feature/optimizations-node24-ai`. הטבלה מתעדת כל אחת, איפה הקוד ואיך לבדוק.

## שרת

| # | נושא | מה היה | מה יש עכשיו | קבצים |
| --- | --- | --- | --- | --- |
| 1 | ניתוח יעדים | 2 קריאות DB + עדכון לכל יעד, בכל שמירת תזרים | קריאה אחת של ההקשר, חישוב טהור בזיכרון, כתיבה אחת בטרנזקציה | `services/goals.service.js`, `services/goals-analyzer.service.js` (`analyzeGoalSync`), `repositories/goals.repository.js` (`updateMany`) |
| 2 | שמירת תזרים | DELETE מלא + INSERT של כל החודשים | השוואה למצב הקיים, כתיבה רק של חודשים שהשתנו, הכנסה של חדשים, מחיקה של חסרים | `db/cashFlowDiff.js` (טהור, נבדק), `repositories/cashFlow.repository.js` |
| 3 | שגיאה ב-stream | `res.status(500)` אחרי שה-headers נשלחו | הודעה בגוף התגובה, סטטוס לא משתנה | `routes/ai.routes.js` |
| 4 | מודול AI | קבצים בשורש, ללא asyncHandler, כתובת Ollama קבועה | `routes/ai.routes.js`, `services/ai.service.js`, `services/financialSummary.service.js`, הגדרות מ-`.env` | |
| 5 | הגנות API | CORS פתוח, ללא גבול גוף, ללא rate limit | CORS allow-list, `express.json({ limit })`, rate limit על `/api/ai` | `app.js`, `middleware/rateLimit.js` |
| 6 | קוד מת | `src/ai.controller.js`, `utils/jsonMirror.js`, `utils/fileStorage.js`, סקריפטי מיגרציה ישנים, מתודה כפולה | נמחקו | |
| 7 | כלי עזר | 6 קבצים בשורש השרת | `server/tools/` + `npm run test:db` | |
| 8 | לוגים | ערבוב `console` ו-logger, לוג כפול לכל בקשה | logger בכל מקום, 4xx כ-warn ו-5xx כ-error | `routes/index.js`, `middleware/errorMiddleware.js` |
| 9 | נתיב בדיקה | `GET /api/goals/test` בפרודקשן, require בתוך handler | הוסרו | `routes/goals.routes.js` |
| 10 | סביבה | prod מצביע על localhost, `.env.example` חלקי | `apiUrl: '/api'`, השרת מגיש את `dist/`, `.env.example` מלא, interceptor קורא את מעטפת השגיאה האחידה | `src/environments/environment.prod.ts`, `server/app.js`, `src/app/interceptors/http.interceptor.ts` |
| 18 | בדיקות | 2 spec בלקוח, 0 בשרת | 34 בדיקות שרת (`node:test`, ללא DB/AI) + 13 בלקוח | `server/test/`, `*.spec.ts` |
| 19 | מזהים | `Date.now()` (התנגשות אפשרית) | uuid v4 | `services/*.service.js` |
| 20 | זמן תגובה AI | timeout 5 דקות, סיכום מחושב בכל שאלה | `AI_TIMEOUT_MS` (60 שניות), cache של הסיכום ל-60 שניות שמתאפס בכל בקשת שינוי | `services/financialSummary.service.js`, `app.js` |

## לקוח

| # | נושא | מה היה | מה יש עכשיו | קבצים |
| --- | --- | --- | --- | --- |
| 11 | Bootstrap | נטען פעמיים (bundle + CDN) | שני bundles בשם (`bootstrap-rtl.css`, `bootstrap-ltr.css`) מתוך node_modules, בלי CDN, החלפה מקומית | `angular.json`, `src/index.html`, `services/language.service.ts` |
| 12 | פונטים | 4 בקשות ל-Google Fonts כולל Roboto שלא בשימוש | Heebo + Inter בבקשה אחת עם preconnect | `src/index.html` |
| 13 | תלויות | `d3` מלא, `jspdf` + `jspdf-autotable` ללא שימוש | `d3-selection`, `d3-shape`, `d3-transition` בלבד; jspdf הוסר | `package.json` |
| 14 | זיהוי שינויים | 4 מ-21 קומפוננטות ב-OnPush | +6 קומפוננטות תצוגה (פריסות, רשימת השקעות) | `features/installments/*`, `features/investments/investment-list` |
| 15 | טעינה בבנאי | `CashFlowSimulationService` ביצע HTTP בבנאי | `loadOriginal()` מפורש ממסך היעדים | `services/cash-flow-simulation.service.ts`, `features/goals` |
| 16 | טבלת התזרים (941 שורות) | הכל בקומפוננטה אחת | דיאלוג ברירות המחדל הוא קומפוננטה נפרדת עם spec; חישובי סכומים ויתרה ב-`CashFlowCalculationService` | `features/cash-flow/cash-flow-defaults-dialog/`, `services/cash-flow-calculation.service.ts` |
| 17 | state | ערבוב BehaviorSubject ו-signals | `CashFlowService`, `ConversationService` על signals (עם `toObservable` לצרכנים קיימים) | `services/` |

## באגים שהתגלו דרך הבדיקות ותוקנו

1. **תווית חודש התחזית ב-AI** הייתה חודש אחד אחורה (המרה ל-UTC ב-`toISOString`). כל 6 חודשי התחזית סומנו לא נכון.
2. **סימולציית רכישה** הוחלה רק אם הרכישה הייתה בחודש הראשון של התחזית. רכישה מאוחרת יותר לא נוכתה.
3. **רכישה באמצע חודש** יוחסה לחודש העוקב.

## מה נשאר

- `budget-tracker.component.scss` (28kB) חורג מתקציב ה-SCSS המקורי (25kB). הסף הועלה ל-32kB כדי שה-build יעבור; הפתרון הנכון הוא לפצל את הקובץ.
- אימות שמירת התזרים הדיפרנציאלית מול SQL Server אמיתי (הלוגיקה נבדקה ביחידה, לא מול DB).
- `InvestmentService` עדיין על BehaviorSubject.
- טבלת התזרים עדיין 849 שורות: אפשר להוציא גם את דיאלוג מחיקת ההוצאה ואת לוגיקת ה-loanPayment.
- אימות משתמשים ו-HTTPS לפני חשיפה לרשת.
