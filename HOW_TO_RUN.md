# 🚀 איך להריץ את הפרויקט - Cash Flow App

## ✅ גירסת Node אחת לכל הפרויקט
השרת (Express) והלקוח (Angular 21) רצים על **אותה גירסת Node.js: 24 ומעלה**.
אין יותר צורך להחליף גירסאות עם nvm בין השרת ללקוח.

- Angular 21.2 תומך ב-Node `^20.19 || ^22.12 || >=24`
- כל תלויות השרת (Express 5, mssql 12, msnodesqlv8) דורשות Node 18 ומעלה
- הגירסה הנדרשת מוגדרת ב-`package.json` (שדה `engines`) וב-`.nvmrc`

בדיקה שהגירסה נכונה:
```cmd
node -v
```
אמור להציג `v24.x.x` או גבוה יותר. אם לא, התקן Node 24 LTS מ-https://nodejs.org, או עם nvm:
```cmd
nvm install 24
nvm use 24
```

---

## 🎯 הרצה בקובץ אחד: עם AI או בלי AI

| מצב | קובץ bat (לחיצה כפולה) | פקודת npm | מה רץ |
| --- | --- | --- | --- |
| **בלי AI** | `run-all.bat` | `npm run dev` | שרת + לקוח |
| **עם AI מקומי (Ollama)** | `run-all-ai.bat` | `npm run dev:ai` | Ollama + שרת + לקוח |

שני המצבים רצים בחלון אחד (דרך `concurrently`), כל תהליך עם צבע ושם משלו. `Ctrl+C` עוצר את כולם.
קובצי ה-bat גם מתקינים `node_modules` אוטומטית אם חסר.

**בלי AI:** כל האפליקציה עובדת כרגיל. לשונית ה-AI מחזירה הודעה ברורה "AI service is not running" (HTTP 503) במקום שגיאת חיבור.

**עם AI:** הסקריפט `scripts/start-ollama.js` מחפש את Ollama ב-PATH או בתיקיית ההתקנה הרגילה ומריץ `ollama serve`. אם Ollama כבר רץ, הוא לא מופעל פעמיים. אם Ollama לא מותקן, מודפסת הודעה והשרת והלקוח ממשיכים לרוץ בלי AI.
דרישות ל-AI: [Ollama](https://ollama.com) מותקן ומודל מורד (`ollama pull qwen3:8b`). בחירת מודל אחר: משתנה סביבה `AI_MODEL`.

### הרצת כל צד בנפרד
```cmd
run-server.bat     ← טרמינל 1: שרת
run-client.bat     ← טרמינל 2: לקוח
```
או ב-PowerShell:
```powershell
.\run-server.ps1
.\run-client.ps1
```

כל הסקריפטים בודקים שגירסת Node היא 24 ומעלה ומציגים הודעת שגיאה ברורה אם לא.

---

## ⚙️ לפני ההרצה הראשונה

1. התקנת תלויות (פעם אחת):
   ```cmd
   npm install
   npm install --prefix server
   ```
2. קובץ סביבה לשרת: העתק את `server\.env.example` ל-`server\.env` ומלא את `DB_CONNECTION_STRING`.
3. ודא ש-SQL Server פועל ושמסד הנתונים `CashFlowDB` קיים (`server\db\schema.sql`).

---

## 📊 מה אמור לקרות

✅ **שרת:**
```
Using Node.js: v24.x.x
🗄️  Connected to SQL Server (database: CashFlowDB)
║   Running on http://localhost:3000    ║
```

✅ **לקוח:**
```
Using Node.js: v24.x.x
Application bundle generation complete.
➜  Local:   http://localhost:4300/
```

---

## 🌐 פתיחת האפליקציה
```
http://localhost:4300
```

## 🛑 עצירה
`Ctrl+C` בכל טרמינל.

---

## ❓ פתרון בעיות

### השרת לא עולה
1. `server\.env` חסר או `DB_CONNECTION_STRING` לא מוגדר (הסקריפטים מזהירים על זה)
2. SQL Server לא פועל או מסד הנתונים לא קיים
3. פורט 3000 תפוס

### Angular לא עולה
1. נקה cache: `Remove-Item -Recurse .angular`
2. התקן מחדש: `npm install`
3. פורט 4300 תפוס

### הודעת "Node.js 24 or newer is required"
הותקנה גירסת Node ישנה. התקן Node 24 LTS, או `nvm install 24` ואז `nvm use 24`.

---

## 📝 מבנה הפרויקט
```
cash-flow-app/
├── server/              ← Backend (Express + SQL Server)
│   ├── index.js
│   └── .env             ← לא ב-git, ליצור מ-.env.example
├── src/                 ← Frontend (Angular 21)
├── scripts/
│   └── start-ollama.js  ← מפעיל Ollama (למצב עם AI)
├── .nvmrc               ← גירסת Node לפרויקט (24)
├── run-all.bat          ← הכל בלי AI (npm run dev)
├── run-all-ai.bat       ← הכל עם AI מקומי (npm run dev:ai)
├── run-server.bat       ← שרת בלבד
├── run-client.bat       ← לקוח בלבד
├── run-server.ps1       ← גרסת PowerShell - שרת
└── run-client.ps1       ← גרסת PowerShell - לקוח
```

## ✅ סיכום מהיר
1. `node -v` → 24 ומעלה
2. בלי AI: `run-all.bat` (או `npm run dev`). עם AI: `run-all-ai.bat` (או `npm run dev:ai`)
3. דפדפן → http://localhost:4300
