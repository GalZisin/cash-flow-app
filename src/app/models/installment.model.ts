export interface LoanComponent {
    id: string;
    description: string;      // למשל: "הלוואה מהבנק"
    totalLoanAmount: number;  // סכום הקרן של ההלוואה
    monthlyPayment: number;   // החזר חודשי
    installmentsCount: number; // מספר תשלומים
    startDate: string;        // תאריך תחילת ההלוואה
    paidCount: number;        // כמה שולם ידנית
    lastPaidDate?: string;    // תאריך תשלום אחרון
    interestRate?: number;    // ריבית שנתית באחוזים
    payoffDate?: string;      // תאריך פירעון (YYYY-MM)
    payoffAmount?: number;    // סכום פירעון מוקדם
    payments?: { date: string, amount: number }[]; // היסטוריית תשלומים הכוללת סכום ותאריך
}

export interface Milestone {
    id: string;
    description: string;
    percentage: number; // האחוז מהסכום הכולל
    amount: number;     // הסכום המחושב
    date: string;       // תאריך התשלום (YYYY-MM)
}

// New interface for Milestone Payments
export interface MilestonePayment {
    date: string;
    amount: number;
    milestoneId: string;
    description?: string;
}

/** תיקון ידני לתשלום מתוך לוח התשלומים (ראו utils/installment-schedule.util.ts) */
export interface PaymentOverride {
    key: string;                  // 'down' | 'm:<n>' | 'l:<loanId>:<n>' | 'l:<loanId>:payoff' | 'ms:<milestoneId>' | 'x:<id>'
    status: 'paid' | 'skipped';   // שולם (גם מוקדם / בסכום אחר) או לא שולם למרות שהמועד עבר
    date?: string;                // תאריך התשלום בפועל (YYYY-MM-DD)
    amount?: number;              // סכום בפועל כשהוא שונה מהמתוכנן
    description?: string;         // לתשלום נוסף שלא בלוח
}

/** שורה בהיסטוריה / בתשלומים הקרובים של פריסה */
export interface InstallmentPaymentEntry {
    key: string;
    date: string;                 // שולם: תאריך התשלום, עתידי: מועד החיוב
    dueDate: string;
    amount: number;
    type: 'down' | 'manual' | 'loan' | 'milestone' | 'extra';
    source: 'auto' | 'manual';    // אוטומטי לפי תאריך או תיקון ידני
    skipped?: boolean;            // המועד עבר וסומן "לא שולם"
    index?: number;
    description?: string;
    milestoneId?: string;
    loanId?: string;
}

export interface Installment {
    id: string;
    name: string;
    totalAmount: number;
    downPayment: number;
    monthlyPayment: number;    // סכום חודשי כולל (מחושב)
    installmentsCount: number; // משך זמן מקסימלי
    startDate: string;         // תאריך הקנייה/התחלה
    color: string;
    notes: string;
    manualPaidCount: number;   // מספר תשלומים שסומנו כבוצעו ידנית
    lastManualPaymentDate?: string; // תאריך התשלום הידני האחרון
    payments?: { date: string, amount: number }[]; // היסטוריית תשלומים ברמה הראשית
    paymentType?: 'manual' | 'loan' | 'milestone'; // סוג הפריסה: תשלומים קבועים, הלוואה, או פעימות
    loanComponents: LoanComponent[]; // רשימת ההלוואות המשויכות
    milestones?: Milestone[];        // פעימות תשלום לפי אחוזים
    milestonePayments?: MilestonePayment[]; // מודל ישן: מומר ל-paymentOverrides בטעינה
    paymentOverrides?: PaymentOverride[];   // תיקונים ידניים ללוח התשלומים האוטומטי

    // קישור ליעד פיננסי
    linkedGoalId?: string;           // ID של יעד פיננסי קשור
}

export interface LoanComponentStatus {
    loan: LoanComponent;
    paidAmount: number;
    remainingAmount: number;
    progressPct: number;
    paidInstallments: number;
    monthsLeft: number;
    isCompleted: boolean;
    history: InstallmentPaymentEntry[];   // תשלומי ההלוואה ששולמו
    upcoming: InstallmentPaymentEntry[];  // תשלומי ההלוואה שטרם שולמו
}

export interface InstallmentStatus {
    installment: Installment;
    remainingAmount: number;    // סכום שנותר לתשלום
    paidAmount: number;         // סכום ששולם (כולל מקדמה)
    paidInstallments: number;   // מספר תשלומים ששולמו
    paidMilestonesCount: number; // כמה פעימות ששולמו
    totalInstallments: number;  // מספר תשלומים כולל
    progressPct: number;        // אחוז התקדמות 0-100
    endDate: string;            // תאריך סיום צפוי
    isCompleted: boolean;       // האם הסתיים
    monthsLeft: number;         // חודשים שנותרו
    loanStatuses: LoanComponentStatus[];
    combinedPaymentHistory: InstallmentPaymentEntry[]; // תשלומים ששולמו, לפי תאריך
    upcomingPayments: InstallmentPaymentEntry[];       // תשלומים שטרם שולמו (כולל כאלה שסומנו "לא שולם")
}

export interface CashFlowWarning {
    month: string; // YYYY-MM
    balance: number;
    threshold: number;
    message: string;
}
