# 📚 מדריך תיעוד - Cash Flow App

## 🎯 איזה קובץ לקרוא?

### 📖 קבצים חשובים - **קרא אותם!**

| קובץ | מטרה | מתי להשתמש |
|------|------|-----------|
| **README.md** | סקירה כללית של הפרויקט | **תמיד תתחיל כאן!** |
| **server/README.md** | מדריך Server Backend | כשעובדים על Backend |
| **GSAP_USAGE_GUIDE.md** | הדרכה לאנימציות GSAP | כשמוסיפים אנימציות |

---

### 🗂️ קבצים למידע מפורט

| קובץ | תוכן | מתי לקרוא |
|------|------|----------|
| **server/API_DOCUMENTATION.md** | תיעוד מלא של API endpoints | כשצריך לדעת איזה endpoint להשתמש |
| **server/LOGGING_GUIDE.md** | מערכת הלוגים ואיך להשתמש | כשיש בעיות ורוצים debug |
| **server/REFACTORING_COMPLETE.md** | סיכום הרפקטורינג שבוצע | להבנת המבנה החדש |

---

### 📦 קבצים היסטוריים - **אפשר לארכב**

אלו קבצים שתיעדו תהליכים שכבר הושלמו. כדאי להעביר לתיקיית `docs/archive/`:

| קובץ | סטטוס | מה לעשות |
|------|-------|----------|
| **REFACTORING_PLAN.md** | ✅ הושלם | העבר ל-`docs/archive/` |
| **REFACTORING_USAGE_GUIDE.md** | ✅ הושלם | העבר ל-`docs/archive/` |
| **SERVER_REFACTORING_PLAN.md** | ✅ הושלם | העבר ל-`docs/archive/` |
| **server/MIGRATION_GUIDE.md** | ✅ הושלם | העבר ל-`docs/archive/` |
| **SYSTEM_PROMPT.md** | 🤖 Kiro AI only | העבר ל-`.kiro/` או מחק |

---

## 🎯 תרשים החלטה מהיר

```
אני רוצה...
│
├─ להתחיל פיתוח חדש
│  └─ קרא: README.md
│
├─ להוסיף feature בפרונטנד
│  ├─ עם אנימציות? → GSAP_USAGE_GUIDE.md
│  └─ בלי אנימציות → README.md
│
├─ להוסיף feature בבקאנד
│  ├─ endpoint חדש? → server/README.md + server/API_DOCUMENTATION.md
│  └─ תיקון bug? → server/LOGGING_GUIDE.md
│
├─ להבין איך המערכת בנויה
│  ├─ Backend → server/REFACTORING_COMPLETE.md
│  └─ Frontend → REFACTORING_USAGE_GUIDE.md
│
└─ לפתור בעיות
   ├─ שגיאות בסרבר → server/LOGGING_GUIDE.md
   └─ API לא עובד → server/API_DOCUMENTATION.md
```

---

## 🧹 תכנית סידור

### שלב 1: צור תיקיית docs
```bash
mkdir docs
mkdir docs\archive
```

### שלב 2: העבר קבצים היסטוריים
```bash
move REFACTORING_PLAN.md docs\archive\
move REFACTORING_USAGE_GUIDE.md docs\archive\
move SERVER_REFACTORING_PLAN.md docs\archive\
move server\MIGRATION_GUIDE.md docs\archive\
```

### שלב 3: מחק/העבר קבצים מיותרים
```bash
# אם יש לך .kiro directory:
move SYSTEM_PROMPT.md .kiro\

# או פשוט מחק אם זה לא רלוונטי:
del SYSTEM_PROMPT.md
```

---

## ✅ מבנה סופי מומלץ

```
cash-flow-app/
├── README.md                    ✅ קרא ראשון!
├── GSAP_USAGE_GUIDE.md         ✅ מדריך אנימציות
├── DOCUMENTATION_GUIDE.md      ✅ המדריך הזה
│
├── server/
│   ├── README.md               ✅ מדריך Backend
│   ├── API_DOCUMENTATION.md    ✅ תיעוד API
│   ├── LOGGING_GUIDE.md        ✅ מערכת Logging
│   └── REFACTORING_COMPLETE.md ✅ סיכום מבנה
│
└── docs/
    └── archive/                📦 תיעוד היסטורי
        ├── REFACTORING_PLAN.md
        ├── REFACTORING_USAGE_GUIDE.md
        ├── SERVER_REFACTORING_PLAN.md
        └── MIGRATION_GUIDE.md
```

---

## 💡 טיפים

### לפני שקוראים תיעוד:
1. **התחל מ-README.md** - תמיד!
2. **חפש בתוכן** - Ctrl+F במקום לקרוא הכל
3. **עדכן תיעוד** - כשמוסיפים feature, עדכן את ה-README

### לשמירת תיעוד רלוונטי:
- ✅ **שמור**: מדריכים לשימוש יומיומי
- 📦 **ארכב**: תיעוד תהליכים שהושלמו
- ❌ **מחק**: קבצים זמניים/מיותרים

---

**נוצר**: 8 יולי 2026
