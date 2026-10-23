# פריסות תשלומים: התקדמות אוטומטית לפי תאריך

במסך הפריסות, תשלום מתוזמן נחשב **שולם אוטומטית ברגע שמועד החיוב שלו הגיע**. אין צורך לסמן כל תשלום ידנית; סימון ידני משמש רק לתיקון (שולם מוקדם, בסכום אחר, או לא שולם למרות שהמועד עבר). אותו כלל מחושב גם בשרת לסיכום ה-AI, ראה [API.md](../server/API.md#התקדמות-תשלומים-לפי-תאריך--תיקונים-paymentoverrides) (מפתחות הלוח, פורמט `paymentOverrides`, נתונים ישנים).

## מה רואים בכרטיס

| מצב תשלום | בהיסטוריית התשלומים | החזרה |
| --- | --- | --- |
| המועד הגיע, בלי תיקון | "אוטומטי" (tooltip: נחשב כמשולם כי הגיע מועד החיוב) | |
| סומן ידנית כשולם | תאריך וסכום התשלום בפועל | ⟲ "החזר לחישוב אוטומטי לפי תאריך" |
| המועד עבר וסומן "לא שולם" | "לא שולם" | ⟲ |

פעולות:

- **✅** מסמן את התשלום הבא שטרם שולם (של הפריסה, או של רכיב הלוואה) כמשולם בתאריך שנבחר. מקדמה לא נכללת.
- **↺** מבטל את התשלום האחרון ששולם. ↺ על תשלום ספציפי: תשלום מהלוח מסומן "לא שולם", תשלום נוסף נמחק.
- **פעימות**: סימון פעימה כשולמה (תאריך, סכום ותיאור אם שונים), והוספת תשלום שלא בלוח, שנשמר עם מפתח `x:<id>` ונספר בסכום ששולם.

## כללי השמירה

כל הפעולות רק מעדכנות את `paymentOverrides` של הפריסה ושומרות אותה ב-`PUT /api/installments/:id`:

- **סימון כשולם** (`overridesAfterPay`): מחליף תיקון קודם לאותו מפתח ב-`{ key, status: 'paid', date, amount?, description? }`.
- **ביטול** (`overridesAfterUnpay`): לפני המועד מספיק להסיר את התיקון; אחרי המועד נשמר `{ key, status: 'skipped' }`.
- **החזרה לאוטומטי** (`overridesAfterReset`): מסיר את התיקון.

`getStatus(item, today)` ב-`InstallmentService` בונה מזה את מה שהמסך צריך: ששולם / שנותר, תשלומים ששולמו, התשלום הבא, השלמת הפריסה. הפריסות שהושלמו לא נכנסות לסכום החודשי.

## קבצים

```text
src/app/utils/installment-schedule.util.ts       לוח התשלומים (buildSchedule), מצב כל תשלום ל-today (resolvePayments), עדכוני overrides
src/app/utils/installment-schedule.util.spec.ts
src/app/services/installment.service.ts          getStatus, markPaymentPaid / markPaymentUnpaid / resetPayment / markAsPaid / undoPayment, חישובי חודש לתזרים
src/app/features/installments/                   installment-card (תצוגה ופעולות), installments-table, installments (מסך ודיאלוגים)
server/utils/installmentSchedule.js              אותו לוח בשרת (סיכום ה-AI ב-cashflow-engine.js)
```

הלוגיקה קיימת פעמיים (לקוח ושרת) ובכוונה זהה. שינוי בכלל צריך להיכנס לשני הקבצים ולשתי חבילות הבדיקות (`installment-schedule.util.spec.ts`, `server/test/installment-schedule.test.js`).
