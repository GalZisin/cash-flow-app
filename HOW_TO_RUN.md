# 🚀 איך להריץ את הפרויקט - Cash Flow App

## ⚠️ חשוב לדעת!
הפרויקט הזה דורש **שתי גרסאות שונות** של Node.js:
- **השרת (Backend)**: Node.js 24.11.0
- **הלקוח (Angular)**: Node.js 20.19.0

הקבצים המוכנים עושים את ההחלפה אוטומטית!

---

## 🎯 שיטת הרצה מומלצת (הכי פשוטה!)

### שלב 1: הרץ את השרת
לחץ פעמיים על הקובץ:
```
run-server.bat
```
או מטרמינל:
```cmd
run-server.bat
```

**מה זה עושה:**
- עובר ל-Node.js 24
- מריץ את השרת על http://localhost:3000
- מתחבר ל-SQL Server (CashFlowDB)

---

### שלב 2: הרץ את הלקוח
**בטרמינל נפרד** או לחץ פעמיים על:
```
run-client.bat
```
או מטרמינל:
```cmd
run-client.bat
```

**מה זה עושה:**
- עובר ל-Node.js 20
- מריץ את Angular על http://localhost:4300
- פותח את הדפדפן אוטומטית

---

## 📊 מה אמור לקרות:

✅ **טרמינל 1 - שרת:**
```
Switching to Node.js 24 for Backend...
Now using node v24.11.0 (64-bit)
Starting Backend Server...
🗄️  Connected to SQL Server (database: CashFlowDB)
║   Running on http://localhost:3000    ║
```

✅ **טרמינל 2 - לקוח:**
```
Switching to Node.js 20 for Angular...
Now using node v20.19.0 (64-bit)
Starting Angular Client...
Application bundle generation complete.
➜  Local:   http://localhost:4300/
```

---

## 🌐 פתיחת האפליקציה:

לאחר שני השירותים רצים, פתח דפדפן וגש ל:
```
http://localhost:4300
```

---

## 🛑 איך לעצור:

לחץ `Ctrl+C` בכל טרמינל כדי לעצור את התהליך.

---

## 🔧 אפשרויות נוספות:

### דרך PowerShell:
```powershell
# טרמינל 1 - שרת
.\run-server.ps1

# טרמינל 2 - לקוח
.\run-client.ps1
```

---

## ❓ פתרון בעיות:

### השרת לא עולה:
1. בדוק ש-SQL Server פועל
2. בדוק את הקובץ `server\.env`
3. ודא ש-Node.js 24 מותקן: `nvm list`

### Angular לא עולה:
1. ודא ש-Node.js 20.19 מותקן: `nvm list`
2. נקה cache: `Remove-Item -Recurse .angular`
3. התקן מחדש: `npm install`

### אם יש בעיה עם NVM:
בדוק שגרסאות Node מותקנות:
```cmd
nvm list
```

אם חסרות גרסאות:
```cmd
nvm install 24.11.0
nvm install 20.19.0
```

---

## 📝 מבנה הפרויקט:

```
cash-flow-app/
├── server/              ← Backend (Node 24)
│   ├── index.js
│   └── .env
├── src/                 ← Angular Frontend (Node 20)
├── run-server.bat       ← הרץ שרת
├── run-client.bat       ← הרץ לקוח
├── run-server.ps1       ← גרסת PowerShell - שרת
└── run-client.ps1       ← גרסת PowerShell - לקוח
```

---

## ✅ סיכום מהיר:

1. **פתח טרמינל ראשון** → הרץ `run-server.bat`
2. **פתח טרמינל שני** → הרץ `run-client.bat`  
3. **פתח דפדפן** → גש ל-http://localhost:4300

**זהו! האפליקציה אמורה לרוץ! 🎉**
