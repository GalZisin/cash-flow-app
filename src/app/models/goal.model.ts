/**
 * Financial Goal Models
 */

export enum GoalType {
    PURCHASE = 'PURCHASE',           // רכישה גדולה (רכב, נכס)
    LOAN_PAYOFF = 'LOAN_PAYOFF',     // פרעון הלוואה
    SAVINGS = 'SAVINGS',             // חיסכון (חתונה, לימודים)
    PROJECT = 'PROJECT'              // פרויקט (שיפוץ)
}

export enum GoalStatus {
    ACHIEVABLE = 'ACHIEVABLE',           // ניתן להשגה
    WARNING = 'WARNING',                 // גבולי - צריך להיזהר
    NOT_ACHIEVABLE = 'NOT_ACHIEVABLE'    // לא ניתן להשגה
}

export interface LoanDetails {
    loanAmount: number;        // סכום הלוואה
    downPayment: number;       // מקדמה
    monthlyPayment: number;    // החזר חודשי
    months: number;            // מספר תשלומים
    interestRate: number;      // ריבית שנתית
}

export interface GoalMilestone {
    id: string;
    description: string;
    percentage: number;
    amount: number;
    date: string;
}

export type GoalScheduleType = 'single' | 'loan' | 'milestone';

export interface GoalSchedule {
    type: GoalScheduleType;
    amount?: number;
    date?: string;
    loan?: LoanDetails;
    milestones?: GoalMilestone[];
}

export interface GoalAnalysis {
    achievable: boolean;
    projectedBalance: number;           // יתרה צפויה בתאריך היעד
    currentBalance: number;             // יתרה נוכחית
    safetyBuffer?: number;              // מרווח ביטחון מומלץ לחצי שנה
    minimumSafetyBuffer?: number;       // רף מינימום ליתרה
    monthsUntilGoal: number;           // חודשים עד היעד
    monthlySavingsNeeded: number;      // חיסכון חודשי נדרש
    suggestedDate?: string;            // תאריך מוצע (אם לא ריאלי)
    monthsDelay?: number;              // כמה חודשים לדחות
    reasons: string[];                 // סיבות למה לא ריאלי
    recommendations: string[];         // המלצות לשיפור
    impactOnOtherGoals?: string[];   // השפעה על יעדים אחרים
    statusMessage?: string;          // תיאור קצר של מצב היעד לפי התזרים
    conflicts?: GoalConflict[];
    status: GoalStatus;

    // קישור לתזרים מזומנים ופריסות
    relatedCashFlowExpenses?: RelatedExpense[];  // הוצאות מיוחדות מתזרים מזומנים
    relatedInstallments?: RelatedInstallment[];  // פריסות תשלומים קשורות
    futureCommitments?: FutureCommitment[];      // התחייבויות עתידיות
    insights?: string[];                          // תובנות מבוססות על כל המידע
}

export interface RelatedExpense {
    month: string;                    // YYYY-MM
    description: string;
    amount: number;
    isSpecial: boolean;              // האם הוצאה מיוחדת
    impactOnGoal: number;           // כמה זה משפיע על היכולת להגיע ליעד
}

export interface RelatedInstallment {
    id: string;
    name: string;
    monthlyPayment: number;
    startDate: string;
    endDate: string;
    remainingAmount: number;
    paymentType: 'manual' | 'loan' | 'milestone';
    impactOnGoal: number;           // השפעה על היכולת להגיע ליעד
    overlapMonths: number;          // כמה חודשים חופפים לטווח היעד
}

export interface FutureCommitment {
    type: 'installment' | 'loan' | 'special_expense';
    description: string;
    monthlyImpact: number;          // השפעה חודשית ממוצעת
    totalImpact: number;            // השפעה כוללת
    startDate: string;
    endDate?: string;
    source: string;                 // מאיפה זה מגיע (שם פריסה/תיאור)
}

export interface GoalConflict {
    goalId: string;
    goalName: string;
    targetDate: string;
    shortfall: number;
    protectedGoal: boolean;
    recommendation: string;
}

export interface FinancialGoal {
    id: string;
    name: string;
    description?: string;
    type: GoalType;
    targetAmount: number;
    targetDate: string;              // YYYY-MM

    // פרטי הלוואה (אם רלוונטי)
    loanDetails?: LoanDetails;
    schedule?: GoalSchedule;

    // קישור לתזרים ופריסות
    linkedInstallmentId?: string;    // ID של פריסת תשלומים קשורה
    linkedToSpecialExpense?: boolean; // האם קשור להוצאה מיוחדת בתזרים
    autoUpdateFromCashFlow?: boolean; // עדכון אוטומטי כשהתזרים משתנה

    // עדיפות
    priority: number;                // 1 = הכי חשוב

    // ניתוח
    analysis?: GoalAnalysis;
    lastAnalyzed?: string;          // תאריך ניתוח אחרון

    // מטא-דאטה
    createdDate: string;
    updatedDate: string;
    completed: boolean;
    isFixed?: boolean;               // יעד קבוע שלא ניתן להזיז או לבטל בתרחיש
    completedDate?: string;
}

export interface GoalTimelineEvent {
    date: string;                   // YYYY-MM
    goalId: string;
    goalName: string;
    type: 'start' | 'target' | 'suggested' | 'milestone';
    amount?: number;
    color: string;
}

export interface GoalsOverview {
    totalGoals: number;
    activeGoals: number;
    completedGoals: number;
    totalTargetAmount: number;
    achievableGoals: number;
    warningGoals: number;
    notAchievableGoals: number;
    nextGoal?: FinancialGoal;
}
