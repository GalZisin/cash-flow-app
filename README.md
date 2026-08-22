# Cash Flow App

אפליקציית ניהול פיננסי אישי לניהול תזרים מזומנים, השקעות, תשלומים עתידיים וניתוח מבוסס AI. הממשק תומך בעברית ובאנגלית, וכן במצב בהיר וכהה.

> 🚀 **רוצה להתחיל מהר?** [QUICK_START.md](./QUICK_START.md) - מדריך מהיר למתחילים  
> 📚 **מחפש תיעוד?** [DOCUMENTATION_GUIDE.md](./DOCUMENTATION_GUIDE.md) - מפה מלאה של כל התיעוד

## יכולות עיקריות

- **תזרים מזומנים** — הזנת הכנסות, משכנתה, הלוואות, הוצאות קבועות והוצאות חד־פעמיות, וחישוב יתרה חודשית.
- **השקעות** — ניהול השקעות, עסקאות, צילומי מצב של שווי השקעה וחוקי סימולציה.
- **תשלומים ופריסות** — מעקב אחר עסקאות בתשלומים, מקדמות, אבני דרך ורכיבי הלוואה (תומך ב-milestone payments).
- **עוזר AI** — סיכום פיננסי, ניתוח, צ׳אט וסימולציית רכישה עתידית בעזרת Ollama מקומי.
- **אנימציות מתקדמות** — GSAP animations עם directives מותאמים (counter, stagger fade-in, progress bars).
- **ייצוא ותצוגה** — גרפים, דיאגרמת Sankey, כרטיסי סיכום וייצוא PDF מתוך הממשק.
- **מצב כהה** — תמיכה מלאה במצב בהיר/כהה עם אפקטים ויזואליים מתקדמים.

## טכנולוגיות

| שכבה | טכנולוגיות |
| --- | --- |
| ממשק | **Angular 21.2.17**, Angular Material 21.2.14, Bootstrap 5.3, RxJS 7.8 |
| ויזואליזציה ואנימציות | **D3.js 7.9** / D3-Sankey 0.12, **GSAP 3.15** |
| שרת | **Node.js**, Express 5.2, CORS |
| ארכיטקטורה | Layered Architecture (Routes → Services → Repositories) |
| התמדה | קובצי JSON מקומיים ב-`server/data/` |
| Logging | Logger מותאם + קבצי log (combined.log, error.log) |
| AI אופציונלי | **Ollama** (local), מודל `qwen3:8b` כברירת מחדל |

## דרישות מקדימות

- Node.js ו־npm
- דפדפן עדכני
- להפעלת יכולות AI: [Ollama](https://ollama.com/) ומודל מקומי תואם

## התקנה והפעלה

התקינו את התלויות של הממשק ושל השרת:

```bash
npm install
npm install --prefix server
```

להפעלת הממשק והשרת יחד:

```bash
npm run dev
```

לאחר ההפעלה:

- הממשק זמין ב־`http://localhost:4300`
- ה־API זמין ב־`http://localhost:3000/api`

ניתן גם להפעיל כל צד בנפרד:

```bash
npm start       # ממשק Angular בפורט 4300
npm run server  # שרת Express בפורט 3000
```

## הפעלת AI מקומי (אופציונלי)

העוזר החכם מתקשר ל־Ollama ב־`localhost:11434`. התקינו והורידו את המודל:

```bash
ollama pull qwen3:8b
ollama serve
```

בחירת מודל אחר נעשית באמצעות משתנה הסביבה `AI_MODEL` לפני הפעלת השרת. לדוגמה ב־PowerShell:

```powershell
$env:AI_MODEL = 'qwen3:8b'
npm run server
```

ללא Ollama, שאר האפליקציה פועלת כרגיל; רק פעולות לשונית ה־AI יחזירו שגיאה מהשרת.

## מבנה הפרויקט

### Frontend (Angular 21)
```text
src/
  app/
    features/           קומפוננטות ראשיות לפי תכונות
      ├── cash-flow/          תזרים מזומנים + טבלת תזרים
      ├── installments/       פריסות ותשלומים
      ├── investments/        השקעות וסימולציות
      └── ai-assistant/       עוזר AI + צ'אט
    services/           תקשורת API, שפה וערכת נושא
    models/             מודלי נתונים (TypeScript interfaces)
    directives/         GSAP אנימציות (animate-number, stagger-fade-in, etc.)
    utils/              חישובים וניתוחים פיננסיים
  environments/         כתובת API לסביבות פיתוח/ייצור
```

### Backend (Node.js + Express) - ארכיטקטורה מרובדת
```text
server/
  ├── index.js                נקודת כניסה ראשית
  ├── routes/                 API Layer (endpoints)
  │   ├── index.js               route aggregator
  │   ├── cashFlow.routes.js     תזרים מזומנים
  │   ├── installments.routes.js פריסות
  │   ├── investments.routes.js  השקעות
  │   ├── conversations.routes.js שיחות AI
  │   └── aiReports.routes.js    דוחות AI
  ├── services/               Business Logic Layer
  │   ├── cashFlow.service.js
  │   ├── installments.service.js
  │   ├── investments.service.js
  │   ├── conversations.service.js
  │   └── aiReports.service.js
  ├── repositories/           Data Access Layer
  │   ├── cashFlow.repository.js
  │   ├── installments.repository.js
  │   ├── investments.repository.js
  │   ├── conversations.repository.js
  │   └── aiReports.repository.js
  ├── utils/                  כלי עזר
  │   ├── fileStorage.js         קריאה/כתיבה של JSON
  │   ├── logger.js              מערכת logging
  │   ├── errors.js              Custom error classes
  │   └── asyncHandler.js        Async error wrapper
  ├── middleware/             Express middleware
  │   └── errorMiddleware.js     טיפול שגיאות גלובלי
  ├── data/                   קבצי JSON (נתונים אישיים)
  │   ├── cash-flow-data-miluim.json
  │   ├── cash-flow-defaults.json
  │   ├── installments.json
  │   ├── investments.json
  │   ├── conversations.json
  │   └── ai-reports.json
  ├── logs/                   קבצי log
  │   ├── combined.log           כל הלוגים
  │   └── error.log              שגיאות בלבד
  ├── ai.routes.js            AI routes (legacy)
  ├── ai.service.js           AI service (legacy)
  └── cashflow-engine.js      חישובי סיכום ותחזית
```

**ראה תיעוד מפורט**: [server/README.md](./server/README.md)

## נתונים מקומיים

השרת יוצר ומעדכן קובצי JSON בתוך `server/data/`:
- `cash-flow-data-miluim.json` - נתוני תזרים מזומנים
- `cash-flow-defaults.json` - ברירות מחדל
- `investments.json` - השקעות
- `installments.json` - פריסות ותשלומים
- `conversations.json` - היסטוריית שיחות AI
- `ai-reports.json` - דוחות AI

**הקבצים אינם נכללים ב־Git** (מוגדרים ב-.gitignore), כדי למנוע העלאה של נתונים פיננסיים אישיים.

**חשוב**: גבה את קובצי ה־JSON לפני מחיקת סביבת העבודה או מעבר למחשב אחר!

### Logging
השרת כותב לוגים לקבצים ב-`server/logs/`:
- `combined.log` - כל הלוגים (INFO, WARN, ERROR)
- `error.log` - שגיאות בלבד

**ראה**: [server/LOGGING_GUIDE.md](./server/LOGGING_GUIDE.md)

## API עיקרי

כל הנתיבים מתחילים ב־`http://localhost:3000/api`.

### תזרים מזומנים
- `GET /api/cash-flow` - קבלת נתוני תזרים
- `POST /api/cash-flow` - שמירת נתוני תזרים
- `GET /api/cash-flow-defaults` - קבלת ברירות מחדל
- `POST /api/cash-flow-defaults` - שמירת ברירות מחדל

### פריסות ותשלומים
- `GET /api/installments` - קבלת כל הפריסות
- `POST /api/installments` - יצירת פריסה חדשה
- `PUT /api/installments/:id` - עדכון פריסה
- `DELETE /api/installments/:id` - מחיקת פריסה

### השקעות
- `GET /api/investments` - קבלת כל ההשקעות
- `POST /api/investments` - יצירת השקעה חדשה
- `PUT /api/investments/:id` - עדכון השקעה
- `DELETE /api/investments/:id` - מחיקת השקעה
- `POST /api/investments/:id/snapshot` - הוספת snapshot
- `POST /api/investments/:id/transaction` - הוספת עסקה
- `POST /api/investments/:id/simulation-rule` - הוספת חוק סימולציה

### שיחות AI
- `GET /api/conversations` - קבלת כל השיחות
- `POST /api/conversations` - יצירת שיחה חדשה
- `PUT /api/conversations/:id` - עדכון שיחה
- `DELETE /api/conversations/:id` - מחיקת שיחה

### דוחות AI
- `GET /api/ai-reports` - קבלת כל הדוחות
- `POST /api/ai-reports` - יצירת דוח חדש
- `DELETE /api/ai-reports/:id` - מחיקת דוח

### עוזר AI (Ollama)
- `GET /api/ai/summary` - סיכום פיננסי מחושב
- `POST /api/ai/analysis` - ניתוח AI מלא
- `POST /api/ai/chat` - שאלת שאלה לעוזר AI
- `POST /api/ai/chat-stream` - צ'אט עם streaming
- `POST /api/ai/scenario` - סימולציית רכישה עתידית

**תיעוד מפורט**: [server/API_DOCUMENTATION.md](./server/API_DOCUMENTATION.md)

## פקודות שימושיות

```bash
npm run build  # בניית גרסת production לתיקיית dist/
npm test       # הרצת בדיקות יחידה
npm run watch  # בנייה מחדש בעת שינוי קבצים
```

## הערות פיתוח

### Frontend (Angular 21.2.17)
- **גרסה**: Angular 21.2.17 + Angular Material 21.2.14
- **אנימציות**: GSAP 3.15.0 עם directives מותאמים אישית
- **גרפים**: D3.js 7.9.0 + d3-sankey
- **כתובת API**: מוגדרת ב־`src/environments/environment.ts`
- **תרגום**: @ngx-translate/core עם תמיכה בעברית ואנגלית

### Backend (Node.js + Express)
- **ארכיטקטורה**: Layered Architecture (Routes → Services → Repositories)
- **Logging**: מערכת logging מובנית (console + files)
- **Error Handling**: טיפול שגיאות גלובלי עם custom error classes
- **CORS**: מאופשר לפיתוח מקומי
- **נתונים**: JSON files (עתידי: MongoDB/PostgreSQL)

### אבטחה לפריסה
- השרת מיועד להרצה מקומית; לפני פריסה יש להגדיר:
  - הרשאות CORS מוגבלות
  - אימות משתמשים (JWT/OAuth)
  - אחסון נתונים מאובטח (Database + encryption)
  - HTTPS
  - Rate limiting

### AI
- ליכולות ה־AI יש להימנע מהזנת מידע רגיש
- השרת שולח ל־Ollama סיכום פיננסי מחושב, לא נתונים גולמיים
- המודל רץ מקומית על המחשב (לא נשלח לענן)

### תיעוד נוסף
- 🚀 [QUICK_START.md](./QUICK_START.md) - מדריך מהיר למתחילים
- 📚 [DOCUMENTATION_GUIDE.md](./DOCUMENTATION_GUIDE.md) - מפת תיעוד מלאה
- 🎨 [GSAP_USAGE_GUIDE.md](./GSAP_USAGE_GUIDE.md) - מדריך אנימציות
- 🔧 [server/README.md](./server/README.md) - תיעוד Backend
- 🔌 [server/API_DOCUMENTATION.md](./server/API_DOCUMENTATION.md) - תיעוד API
- 📝 [server/LOGGING_GUIDE.md](./server/LOGGING_GUIDE.md) - מערכת Logging
