# Themes

כל ניהול הצבעים של האפליקציה נמצא כאן. כל צבע באפליקציה קורא משתנה CSS בשם `--cf-<token>`, וכל ערכת צבע מגדירה את כל המשתנים פעמיים: למצב בהיר ולמצב כהה.

```text
src/themes/
├── _engine.scss            חוזה ה-tokens, יצירת ה-CSS לכל ערכה, וגשר ל-Bootstrap ול-Angular Material
├── _index.scss             רשימת הערכות (נטען פעם אחת מ-src/styles.scss)
├── palettes/               ערכה אחת לכל קובץ: (light: (...), dark: (...))
│   ├── _classic.scss       ברירת המחדל: המראה המקורי (אינדיגו וצפחה)
│   ├── _ocean.scss         כחול פינטק עם טורקיז
│   ├── _emerald.scss       ירוק "עושר"
│   ├── _violet.scss        סגול SaaS
│   ├── _sunset.scss        טרקוטה חם
│   └── _graphite.scss      ניטרלי מינימליסטי
├── theme.registry.ts       רשימת הערכות לממשק: שם, תיאור וצבעי תצוגה מקדימה
├── theme.registry.spec.ts  בודק שהרשימה תואמת ל-CSS שנבנה בפועל
└── theme-picker/           כפתור ותפריט בחירת ערכה (ליד כפתור בהיר/כהה)
```

## איך זה עובד

- `ThemeService` (`src/app/services/theme.service.ts`) שם על `<html>` את `data-theme="<id>"` ואת המחלקה `dark-mode` (כמו קודם).
- `_engine.scss` מייצר לכל ערכה `:root[data-theme='<id>']` (בהיר) ו-`:root[data-theme='<id>'].dark-mode` (כהה).
- הבחירה נשמרת ב-localStorage (`color-theme`, `theme`). לתצוגה מקדימה או שיתוף: `?theme=ocean&mode=dark` בכתובת.
- Bootstrap (`--bs-*`, `.btn-primary`) ו-Angular Material (`--mat-sys-*`) מקבלים את הצבעים מה-tokens, כך שגם הרכיבים שלהם מתחלפים.

## ה-tokens

| קבוצה | tokens | שימוש |
| --- | --- | --- |
| רקעים | `bg`, `surface`, `surface-2`, `surface-3`, `surface-4`, `header` | רקע הדף, כרטיסים, שכבות מוגבהות, כותרת טבלה |
| קווים | `border`, `border-strong` | מסגרות עדינות / בולטות |
| טקסט | `text-strong`, `text`, `text-2`, `text-3`, `text-4` | כותרות, גוף, משני, מושתק, רמזים |
| מותג | `primary`, `primary-strong`, `primary-text`, `primary-soft`, `primary-border`, `on-primary`, `accent` | כפתורים, טאב פעיל, קישורים, רקע עדין, הדגשה |
| סטטוס | `success*`, `danger*`, `warning*` (רגיל / `-soft` רקע / `-solid` מילוי) | הכנסות, הוצאות, התראות |
| הודעות (toast) | `success-toast`, `danger-toast` | רקע הודעת השמירה / השגיאה (snackbar) עם טקסט לבן. כהה מספיק גם במצב כהה |
| שונות | `tooltip-bg` | רקע tooltip |

ל-`bg`, `surface`, `text`, `primary`, `accent`, `success`, `danger`, `warning` וגם ל-`success-solid`, `danger-solid`, `warning-solid` יש `--cf-<token>-rgb` לשקיפות:

```scss
.card { background: var(--cf-surface); border: 1px solid var(--cf-border); color: var(--cf-text); }
.badge { background: rgba(var(--cf-primary-rgb), 0.12); color: var(--cf-primary-text); }
```

**כלל:** בקוד חדש לא כותבים צבעים קשיחים. רק `var(--cf-...)`. חריגים מותרים: צללים ניטרליים (`rgba(0,0,0,...)`), שכבות זכוכית (`rgba(255,255,255,...)`), וצבעי נתונים (קטגוריות הוצאה, דיאגרמת Sankey).

## הוספת ערכה חדשה

1. להעתיק פלטה קיימת ל-`palettes/_<id>.scss` ולשנות צבעים. חובה להגדיר את כל ה-tokens בשני המצבים (ה-build נכשל עם הודעה אם חסר token).
2. ב-`_index.scss`: להוסיף `@use 'palettes/<id>' as <id>-theme;` ו-`@include engine.theme('<id>', <id>-theme.$palette);`.
3. ב-`theme.registry.ts`: להוסיף רשומה עם שם, תיאור ו-`preview` (bg, surface, primary, accent, text לכל מצב).
4. להריץ:
   ```bash
   npm run themes:check   # ניגודיות WCAG לכל הזוגות שהממשק משתמש בהם
   npm test               # theme.registry.spec בודק שה-preview תואם ל-CSS
   ```

## כללי ניגודיות שהערכות עומדות בהם

`npm run themes:check` בודק: טקסט על רקע ≥ 7, טקסט משני ומושתק ≥ 4.5, רמזים ≥ 3, טקסט לבן על `primary` ≥ 4.5, טקסט לבן על `success-toast` ו-`danger-toast` ≥ 6, `primary-text` על כרטיס ועל `primary-soft` ≥ 4.5, צבעי סטטוס על הרקע העדין שלהם ≥ 4.5.
