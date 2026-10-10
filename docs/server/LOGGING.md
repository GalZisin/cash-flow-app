# לוגים

השרת כותב ל-console ולקבצים דרך `server/utils/logger.js`. אין `console.*` ישיר ב-routes/services/repositories.

## 📂 מיקום קבצי Log

```
server/
└── logs/
    ├── combined.log    # כל הלוגים (INFO, WARN, ERROR, DEBUG)
    └── error.log       # רק שגיאות (ERROR)
```

---

## 🎯 מתי המערכת כותבת ללוגים?

### 1️⃣ **INFO** - מידע כללי (combined.log)

#### כל בקשת HTTP
```javascript
[2026-08-07T07:37:00.325Z] [INFO] GET /health
[2026-08-07T07:37:00.331Z] [INFO] GET /api/cash-flow
[2026-08-07T07:37:00.340Z] [INFO] POST /api/installments
```

**מתי?**
- כל פעם שמגיעה בקשה לסרבר
- Endpoint כלשהו מופעל

#### אירועי מערכת
```javascript
[2026-08-07T07:36:57.123Z] [INFO] ╔════════════════════════════════════════╗
[2026-08-07T07:36:57.124Z] [INFO] ║   Cash Flow Server                     ║
[2026-08-07T07:36:57.125Z] [INFO] ║   Running on http://localhost:3000    ║
[2026-08-07T07:36:57.126Z] [INFO] ╚════════════════════════════════════════╝
```

**מתי?**
- הפעלת השרת
- כיבוי graceful של השרת
- אירועי מערכת חשובים

#### פעולות מוצלחות
```javascript
[2026-10-09T10:58:21.519Z] [INFO] 🗄️  Connected to SQL Server (database: CashFlowDB)
[2026-10-09T10:58:21.600Z] [INFO] 🌐 Serving client from ...distcash-flow-approwser
```

**מתי?**
- חיבור ל-SQL Server בעלייה
- הגשת הלקוח הבנוי בפרודקשן

---

### 2️⃣ **WARN** - אזהרות (combined.log)

#### Routes לא קיימים
```javascript
[2026-08-07T07:37:00.345Z] [WARN] Route not found: GET /api/nonexistent
```

**מתי?**
- משתמש ניסה להגיע ל-endpoint שלא קיים
- 404 errors

#### אזהרות כלליות
```javascript
[2026-08-07T07:38:00.100Z] [WARN] SIGTERM signal received: closing HTTP server
[2026-08-07T07:38:00.200Z] [WARN] Old data format detected, migrating...
```

**מתי?**
- Graceful shutdown
- מיגרציות/שינויים אוטומטיים
- מצבים לא רגילים שלא שגיאות

---

### 3️⃣ **ERROR** - שגיאות (error.log + combined.log)

#### שגיאות קריאה/כתיבה
```javascript
[2026-10-09T10:58:21.521Z] [ERROR] ❌ Could not connect to SQL Server: DB_CONNECTION_STRING is not set. Copy server/.env.example to server/.env and fill it in.
[2026-10-09T11:02:10.004Z] [ERROR] Error getting related installments: Invalid column name
```

**מתי?**
- כשלון בחיבור ל-SQL Server או שאילתה שנכשלה
- כל שגיאה עם סטטוס 500 (ה-errorHandler כותב גם את ה-stack)

#### שגיאות לקוח (4xx) נכתבות כ-WARN, לא כ-ERROR
```javascript
[2026-10-09T11:05:00.100Z] [WARN] question is required {"name":"ValidationError","path":"/api/ai/chat","method":"POST"}
[2026-10-09T11:05:00.200Z] [WARN] Too many AI requests, please wait a minute. {"name":"TooManyRequestsError","path":"/api/ai/summary","method":"GET"}
```

**מתי?**
- נתונים לא תקינים מהלקוח (400), ישות לא קיימת (404), rate limit (429)
- ספק ה-AI לא זמין: 503 נרשם כ-ERROR עם `code: AI_UNAVAILABLE`

#### שגיאות כלליות
```javascript
[2026-08-07T07:41:00.500Z] [ERROR] Unhandled error: {"name":"TypeError","message":"Cannot read property 'months' of null","stack":"..."}
```

**מתי?**
- חריגות לא צפויות
- שגיאות תכנות
- בעיות לא צפויות

---

### 4️⃣ **DEBUG** - פירוט מלא (combined.log)

**מתי להפעיל?**
```bash
# Windows
set LOG_LEVEL=DEBUG
node index.js

# Linux/Mac
LOG_LEVEL=DEBUG node index.js
```

**דוגמאות:**
```javascript
[2026-10-09T10:58:21.400Z] [DEBUG] All /api routes mounted
```

**מתי?**
- בעיות קשות לאיתור
- Development/Debugging
- ניתוח ביצועים

---

## 🗄️ לוג גישה ל-API בטבלה

בנוסף לקבצים, כל בקשת `/api` נכתבת כשורה בטבלה **`log.cash_flow_api_access`** ב-SQL Server (request, response, שגיאה, זמנים ושרשרת המתודות הפנימיות).

**הקמה**: להריץ `server/db/log-schema.sql` אחרי `schema.sql` (יוצר את הסכימה `log` ואת הטבלה; בטוח להרצה חוזרת). בלי הטבלה השרת ממשיך לעבוד ורושם אזהרה אחת ב-`combined.log`.

**איך זה עובד** (`server/middleware/apiAccessLog.js`, מחובר ב-`app.js` על `/api`):
1. לכל בקשה נוצר `request_id` (uuid v4) שחוזר גם בכותרת `X-Request-Id`, ונפתח הקשר לבקשה (`utils/requestContext.js`, AsyncLocalStorage).
2. כל service ו-repository מיוצאים דרך `utils/traceMethods.js`, שעוטף את המתודות שלהם (כולל עוזרות `_private` שנקראות דרך `this`). כל קריאה נרשמת להקשר, כך שבעמודה `inner_method_name` מופיעה השרשרת, למשל `cashFlowService.saveCashFlow > cashFlowRepository.write > goalsService.analyzeAllGoals > goalsRepository.updateMany`. קריאות חוזרות ברצף מקוצרות (`x3`). מתודות `#private` של JavaScript לא ניתנות ליירוט.
3. גוף הבקשה (`query` + `body`) וגוף התשובה (JSON או stream) נשמרים עד `API_ACCESS_LOG_MAX_CHARS` תווים (ברירת מחדל 20000) ואז נחתכים עם `...[truncated]`.
4. בסיום התשובה (או כשהלקוח התנתק) השורה נכתבת דרך `repositories/apiAccessLog.repository.js`. כישלון בכתיבה לא משפיע על התשובה.

**העמודות העיקריות**

| עמודה | מה יש בה |
| --- | --- |
| `event_id` | מזהה רץ (IDENTITY מ-1000) |
| `request_id` | uuid של הבקשה (= `X-Request-Id`) |
| `user_name` | משתמש מערכת ההפעלה שמריץ את השרת (אין התחברות באפליקציה) |
| `start_time`, `end_time`, `total_time` | זמן **מקומי** של מכונת השרת, ומשך במילישניות (עמודה מחושבת) |
| `service_name` | הקבוצה בנתיב: `cash-flow`, `installments`, `investments`, `goals`, `budget`, `conversations`, `ai-reports`, `ai` |
| `method_name` | הנתיב כתבנית, למשל `GET /api/goals/:id/analyze` |
| `inner_method_name` | שרשרת המתודות הפנימיות (ראה למעלה) |
| `http_method`, `request_path` | המתודה והנתיב בפועל (עם המזהה) |
| `request_data`, `response_data` | הגופים כ-JSON (חתוכים) |
| `entity_id` | מזהה הישות מהנתיב או מ-`body.id` (פריסה / השקעה / יעד / שיחה) |
| `is_error`, `status`, `event_message` | סטטוס 4xx/5xx או חריגה; `event_message` הוא `ErrorName: message` (ב-5xx גם ה-stack) |
| `machine_name`, `ip_address` | שם המחשב וכתובת הלקוח |
| `added_by`, `added_on` | ה-login של SQL ושעת הכתיבה (`SYSDATETIME()`) |

**הגדרות** (`server/.env`): `API_ACCESS_LOG=0` מכבה את הלוג, `API_ACCESS_LOG_MAX_CHARS` קובע את גודל הגופים שנשמרים.

**שאילתות שימושיות**

```sql
-- 50 הבקשות האחרונות
SELECT TOP 50 event_id, start_time, total_time, method_name, status, inner_method_name
FROM [log].cash_flow_api_access ORDER BY start_time DESC;

-- רק שגיאות (אינדקס מסונן)
SELECT start_time, method_name, status, event_message
FROM [log].cash_flow_api_access WHERE is_error = 1 ORDER BY start_time DESC;

-- כל מה שקרה בבקשה אחת (לפי X-Request-Id)
SELECT * FROM [log].cash_flow_api_access WHERE request_id = '3f2a1c6e-7b1d-4e0b-9c1a-0d2b5f7e8a91';
```

---

## 💡 איך להשתמש ב-Logger בקוד?

### דוגמאות שימוש:

```javascript
const logger = require('../utils/logger'); // מתוך routes/ services/ repositories/

// INFO - פעולות רגילות
logger.info('User logged in', { userId: 123 });
logger.info('Data saved successfully');

// WARN - מצבים לא רגילים
logger.warn('Deprecated API used', { endpoint: '/old-api' });
logger.warn('Rate limit approaching', { requests: 95 });

// ERROR - שגיאות אמיתיות
logger.error('Failed to save data', { 
  error: err.message, 
  stack: err.stack 
});

// DEBUG - פירוט מלא
logger.debug('Processing request', { 
  body: req.body, 
  headers: req.headers 
});
```

---

## 📊 ניטור Logs

### צפייה בזמן אמת:
```bash
# Windows PowerShell
Get-Content logs\combined.log -Wait -Tail 20

# Linux/Mac
tail -f logs/combined.log
```

### חיפוש שגיאות:
```bash
# Windows
findstr "ERROR" logs\combined.log

# Linux/Mac
grep "ERROR" logs/combined.log
```

### ניקוי Logs ישנים:
```bash
# Windows
del logs\*.log

# Linux/Mac
rm logs/*.log
```

---

## 🔒 אבטחה

### מה **לא** לכתוב ללוגים:
- ❌ סיסמאות
- ❌ API tokens
- ❌ מספרי כרטיס אשראי
- ❌ מידע אישי רגיש (PII)

### מה **כן** לכתוב:
- ✅ User IDs (לא usernames)
- ✅ Request paths
- ✅ Error messages (ללא סיסמאות)
- ✅ Timestamps
- ✅ Status codes

---

## 🚀 Production vs Development

### Development (default):
```javascript
LOG_LEVEL=INFO  // רואים הכל חוץ מ-DEBUG
```

### Production:
```javascript
LOG_LEVEL=WARN  // רק אזהרות ושגיאות
```

### Debugging:
```javascript
LOG_LEVEL=DEBUG  // הכל כולל פרטים מלאים
```

---

## 📈 Rotation (עתידי)

בעתיד, כדאי להוסיף log rotation:

```bash
npm install rotating-file-stream
```

זה ימנע מה-logs לגדול לאינסוף ויוצר קבצים מסודרים:
```
logs/
├── combined-2026-08-01.log
├── combined-2026-08-02.log
├── combined-2026-08-03.log
└── error-2026-08-03.log
```

---

**עודכן**: 2026-10-10
