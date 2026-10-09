# הקמת מסד הנתונים (SQL Server)

השרת שומר הכל במסד נתונים **`CashFlowDB`** ב-Microsoft SQL Server. ה-REST API לא תלוי בזה, כך שהלקוח לא יודע על ה-DB.

## 1. יצירת מסד הנתונים והטבלאות

הרץ את `server/db/schema.sql` ב-SSMS / Azure Data Studio, או:

```cmd
sqlcmd -S localhost -E -i server\db\schema.sql
```

הסקריפט יוצר את `CashFlowDB` ואת כל הטבלאות. בטוח להריץ שוב: אובייקטים נוצרים רק אם חסרים.

אופציונלי: `server/db/create-app-user.sql` יוצר login ייעודי `cashflow_app` (שנה את הסיסמה בקובץ) כדי שהשרת לא ישתמש ב-`sa`. כלים נוספים להרשאות וחיבור: `server/tools/` (`setup-sql-user.ps1`, `fix-sql-auth.sql`, `create-db-and-user.sql`).

## 2. הגדרת החיבור

```cmd
copy server\.env.example server\.env
```

ערוך את `server/.env` וקבע `DB_CONNECTION_STRING`, למשל:

```ini
DB_CONNECTION_STRING=Server=localhost,1433;Database=CashFlowDB;User Id=cashflow_app;Password=YOUR_PASSWORD;Encrypt=true;TrustServerCertificate=true
```

צורות נוספות (named instance, Windows Authentication עם `msnodesqlv8`) מתועדות ב-`.env.example`.
חיבור לפי פורט (`localhost,1433`) דורש ש-TCP/IP יהיה פעיל ב-*SQL Server Configuration Manager* (כבוי כברירת מחדל ב-SQL Server Express).

בדיקה:

```cmd
cd server
npm run test:db
```

## 3. ייבוא נתונים מהגירסה הישנה (פעם אחת, רק אם יש קובצי JSON)

```cmd
cd server
npm run db:migrate
```

`db:migrate` קורא את `server/data/*.json` הישנים (לא משנה אותם) וממלא את הטבלאות. טבלאות שכבר מכילות נתונים מדולגות; `npm run db:migrate -- --force` מחליף אותן.

## 4. הרצה

```cmd
npm run dev          # מהשורש: שרת + לקוח
```

`GET http://localhost:3000/health` מדווח על מצב החיבור ל-DB.

## הטבלאות

| טבלה | תוכן |
| --- | --- |
| `cash_flow_months`, `cash_flow_items` | טבלת התזרים; פריטים = הכנסות נוספות / הוצאות שוטפות / הוצאות מיוחדות של חודש |
| `cash_flow_defaults`, `cash_flow_default_items` | התבנית לחודש חדש (שורה אחת + פריטים) |
| `budget_settings` | תקרה חודשית לכל קטגוריית הוצאה |
| `installments` + `installment_loan_components`, `installment_loan_payments`, `installment_milestones`, `installment_milestone_payments`, `installment_payments` | פריסות, הלוואות, אבני דרך והיסטוריית תשלומים |
| `investments` + `investment_transactions`, `investment_snapshots`, `investment_simulation_rules` | השקעות |
| `financial_goals` | יעדים (פרטי הלוואה, לוח זמנים וניתוח נשמרים כעמודות JSON) |
| `conversations`, `conversation_messages` | שיחות עם העוזר |
| `ai_reports` | דוחות AI שמורים |

הערות עיצוב:

- אותו חודש קלנדרי יכול להופיע יותר מפעם אחת בתזרים, ולכן `month_date` אינו ייחודי; `sort_order` שומר את סדר השורות.
- לכל טבלה שמחזיקה אובייקט של האפליקציה יש עמודת `extra_json` ששומרת שדות שהאפליקציה תוסיף בעתיד, כך שלא אובד מידע.
- כסף הוא `DECIMAL(18,2)`.
- `ending_balance` נשמר כי האפליקציה שולחת אותו, אבל הוא נגזר (פתיחה + הכנסות − הוצאות) והאפליקציה מחשבת אותו מחדש.
- **שמירת התזרים דיפרנציאלית**: `cashFlow.repository.write()` משווה את מה שהגיע למצב ב-DB (`db/cashFlowDiff.js`) וכותב רק חודשים שהשתנו, בטרנזקציה אחת עם `TABLOCKX`.

## קוד

| קובץ | תפקיד |
| --- | --- |
| `server/db/connection.js` | pool משותף אחד, קורא `DB_CONNECTION_STRING`, בוחר דרייבר (`mssql` או `msnodesqlv8`) |
| `server/db/helpers.js`, `helpers.pure.js` | פרמטרים מוקלדים, טרנזקציות, `insertMany`, `insertReturningId`, `updateRow` |
| `server/db/mappers.js` | המרה אובייקט ↔ שורה (ללא גישה ל-DB) |
| `server/db/cashFlowDiff.js` | תכנון השמירה הדיפרנציאלית (טהור, נבדק ב-`test/cashflow-diff.test.js`) |
| `server/repositories/*.js` | שאילתות לכל ישות |
| `server/db/migrate-json-to-sql.js` | ייבוא חד-פעמי מ-JSON |
| `server/db/test-mappers.js` | `npm run test:mappers` בודק את המיפוי מול קובצי JSON ישנים |
