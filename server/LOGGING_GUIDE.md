# 📝 מדריך Logging - מערכת Cash Flow

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
[2026-08-07T07:37:00.400Z] [INFO] File written successfully: data/cash-flow-data.json
[2026-08-07T07:37:00.450Z] [INFO] Installment created: מטבח חדש
```

**מתי?**
- שמירת נתונים לקובץ
- יצירת/עדכון/מחיקה של פריסה, השקעה
- פעולות CRUD מוצלחות

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
[2026-08-07T07:39:00.500Z] [ERROR] Error reading file data/cash-flow-data.json: {"code":"ENOENT"}
[2026-08-07T07:39:00.600Z] [ERROR] Failed to write file: Permission denied
```

**מתי?**
- כשלון בקריאת קובץ JSON
- כשלון בשמירת נתונים
- בעיות הרשאות

#### שגיאות Validation
```javascript
[2026-08-07T07:40:00.100Z] [ERROR] ValidationError: description is required
[2026-08-07T07:40:00.200Z] [ERROR] ValidationError: Invalid cash flow data structure
```

**מתי?**
- נתונים לא תקינים מהפרונטנד
- חסרים שדות חובה
- פורמט שגוי

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
[2026-08-07T07:42:00.100Z] [DEBUG] Reading file: data/installments.json
[2026-08-07T07:42:00.150Z] [DEBUG] Parsed 3 installments
[2026-08-07T07:42:00.200Z] [DEBUG] Calculating summary for 62 months
```

**מתי?**
- בעיות קשות לאיתור
- Development/Debugging
- ניתוח ביצועים

---

## 💡 איך להשתמש ב-Logger בקוד?

### דוגמאות שימוש:

```javascript
const logger = require('./utils/logger');

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

**עודכן**: 8 יולי 2026  
**גרסה**: 1.0
