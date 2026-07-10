# Cash Flow App

אפליקציית ניהול פיננסי אישי לניהול תזרים מזומנים, השקעות, תשלומים עתידיים וניתוח מבוסס AI. הממשק תומך בעברית ובאנגלית, וכן במצב בהיר וכהה.

## יכולות עיקריות

- **תזרים מזומנים** — הזנת הכנסות, משכנתה, הלוואות, הוצאות קבועות והוצאות חד־פעמיות, וחישוב יתרה חודשית.
- **השקעות** — ניהול השקעות, עסקאות, צילומי מצב של שווי השקעה וחוקי סימולציה.
- **תשלומים ופריסות** — מעקב אחר עסקאות בתשלומים, מקדמות, אבני דרך ורכיבי הלוואה.
- **עוזר AI** — סיכום פיננסי, ניתוח, צ׳אט וסימולציית רכישה עתידית בעזרת Ollama מקומי.
- **ייצוא ותצוגה** — גרפים, דיאגרמת Sankey, כרטיסי סיכום וייצוא PDF מתוך הממשק.

## טכנולוגיות

| שכבה | טכנולוגיות |
| --- | --- |
| ממשק | Angular 21, Angular Material, Bootstrap, RxJS |
| ויזואליזציה ואנימציות | D3 / D3-Sankey, GSAP |
| שרת | Node.js, Express, CORS |
| התמדה | קובצי JSON מקומיים תחת `server/` |
| AI אופציונלי | Ollama, מודל `qwen3:8b` כברירת מחדל |

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

```text
src/
  app/
    components/       רכיבי המסכים והדיאלוגים
    services/         תקשורת API, שפה וערכת נושא
    models/           מודלי תזרים, השקעות, תשלומים והוצאות
    utils/            חישובים וניתוחים פיננסיים
  environments/       כתובת ה־API לסביבות הפיתוח והייצור
server/
  index.js            נקודת הכניסה לשרת והגדרת הנתיבים
  cash-flow.js        API של תזרים והגדרות ברירת מחדל
  investments.js      API של השקעות, עסקאות וסימולציות
  installments.js     API של עסקאות בתשלומים
  ai.routes.js        API לעוזר ה־AI
  cashflow-engine.js  חישובי סיכום ותחזית עבור ה־AI
public/assets/i18n/   קובצי תרגום עברית ואנגלית
```

## נתונים מקומיים

השרת יוצר ומעדכן קובצי JSON בתוך `server/`, למשל `cash-flow-data-miluim.json`, `investments.json` ו־`installments.json`. הקבצים אינם נכללים ב־Git, כדי למנוע העלאה של נתונים פיננסיים אישיים.

חשוב לגבות את קובצי ה־JSON הללו לפני מחיקת סביבת העבודה או מעבר למחשב אחר.

## API עיקרי

כל הנתיבים מתחילים ב־`http://localhost:3000/api`.

| תחום | נתיבים |
| --- | --- |
| תזרים | `GET` / `POST` `/cash-flow`, `GET` / `POST` `/cash-flow-defaults` |
| השקעות | `GET` / `POST` `/investments`, `PUT` / `DELETE` `/investments/:id` |
| נתוני השקעה | `/investments/:id/snapshot`, `/transaction`, `/simulation-rule` (כולל `PUT` ו־`DELETE` עם מזהה הפריט) |
| תשלומים | `GET` / `POST` `/installments`, `PUT` / `DELETE` `/installments/:id` |
| AI | `GET /ai/summary`, `POST /ai/analysis`, `POST /ai/chat`, `POST /ai/chat-stream`, `POST /ai/scenario` |

## פקודות שימושיות

```bash
npm run build  # בניית גרסת production לתיקיית dist/
npm test       # הרצת בדיקות יחידה
npm run watch  # בנייה מחדש בעת שינוי קבצים
```

## הערות פיתוח

- כתובת ה־API מוגדרת ב־`src/environments/environment.ts`.
- השרת מאפשר CORS ומיועד להרצה מקומית; לפני פריסה יש להגדיר הרשאות CORS, אימות משתמשים ואחסון נתונים מאובטח.
- ליכולות ה־AI יש להימנע מהזנת מידע שלא רוצים להעביר למודל המקומי. השרת שולח ל־Ollama סיכום פיננסי מחושב, ולא את כל קובצי הנתונים הגולמיים.
