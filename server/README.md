# Cash Flow Server

> שרת Backend עבור אפליקציית Cash Flow - מבוסס Express.js עם ארכיטקטורה מרובדת

## 🚀 התחלה מהירה

### הפעלת השרת

**Windows:**
```powershell
cd server
.\start-server.ps1
```

**או ישירות:**
```bash
cd server
node index.js
```

השרת יעלה על `http://localhost:3000`

---

## 📁 מבנה הפרויקט

```
server/
├── routes/              # API endpoints
├── services/            # Business logic
├── repositories/        # Data access
├── utils/              # Utilities (logger, errors, etc.)
├── middleware/         # Express middleware
├── data/               # JSON data files
└── index.js            # Entry point
```

---

## 🔌 API Endpoints

### Health Check
```
GET /health
```

### Cash Flow
```
GET  /api/cash-flow              # קבלת נתוני תזרים
POST /api/cash-flow              # שמירת נתוני תזרים
GET  /api/cash-flow-defaults     # קבלת ברירות מחדל
POST /api/cash-flow-defaults     # שמירת ברירות מחדל
```

### Installments (פריסות)
```
GET    /api/installments         # קבלת כל הפריסות
POST   /api/installments         # יצירת פריסה חדשה
PUT    /api/installments/:id     # עדכון פריסה
DELETE /api/installments/:id     # מחיקת פריסה
```

### Investments (השקעות)
```
GET    /api/investments          # קבלת כל ההשקעות
POST   /api/investments          # יצירת השקעה חדשה
PUT    /api/investments/:id      # עדכון השקעה
DELETE /api/investments/:id      # מחיקת השקעה
```

### Conversations (שיחות AI)
```
GET    /api/conversations        # קבלת כל השיחות
POST   /api/conversations        # יצירת שיחה חדשה
PUT    /api/conversations/:id    # עדכון שיחה
DELETE /api/conversations/:id    # מחיקת שיחה
```

### AI Reports (דוחות AI)
```
GET    /api/ai-reports           # קבלת כל הדוחות
POST   /api/ai-reports           # יצירת דוח חדש
GET    /api/ai-reports/:id       # קבלת דוח ספציפי
DELETE /api/ai-reports/:id       # מחיקת דוח
```

### AI Assistant (Legacy)
```
POST /api/ai/*                   # AI endpoints
```

---

## 📚 תיעוד מפורט

- **[REFACTORING_COMPLETE.md](./REFACTORING_COMPLETE.md)** - סיכום הרפקטורינג
- **[SERVER_REFACTORING_PLAN.md](./SERVER_REFACTORING_PLAN.md)** - תכנית מפורטת + דוגמאות
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - מדריך מעבר
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - תיעוד API מלא

---

## 🛠️ Development

### התקנת Dependencies
```bash
npm install
```

### הפעלה עם Auto-Reload
```bash
npm install -g nodemon
nodemon index.js
```

### בדיקת Endpoints
```bash
# Health check
curl http://localhost:3000/health

# Cash flow data
curl http://localhost:3000/api/cash-flow

# Installments
curl http://localhost:3000/api/installments
```

---

## 🐛 פתרון בעיות

### השרת לא עולה
```powershell
# בדוק אם פורט 3000 תפוס
netstat -ano | findstr :3000

# עצור תהליך ישן
taskkill /F /PID <PID>
```

### נתונים לא נטענים
```powershell
# בדוק שהקבצים קיימים
dir data\*.json
```

### שגיאות בקוד
הסרבר מדפיס לוגים מפורטים ל-console עם timestamps

---

## 🔄 ארכיטקטורה

השרת בנוי בארכיטקטורה מרובדת (Layered Architecture):

```
┌─────────────────────────────────────────┐
│         HTTP Request (Express)          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         ROUTES (controllers)            │
│  • Validate request                     │
│  • Call service layer                   │
│  • Format response                      │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         SERVICES (business logic)       │
│  • Business rules                       │
│  • Data transformation                  │
│  • Orchestrate repositories             │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│       REPOSITORIES (data access)        │
│  • Read/Write JSON files                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│              DATA LAYER                 │
│         (JSON files in data/)           │
└─────────────────────────────────────────┘
```

---

## 📦 Dependencies

```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5"
}
```

---

## 📝 License

MIT

---

**עודכן לאחרונה**: 8 יולי 2026
