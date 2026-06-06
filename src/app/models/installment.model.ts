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
    loanComponents: LoanComponent[]; // רשימת ההלוואות המשויכות
}

export interface LoanComponentStatus {
    loan: LoanComponent;
    paidAmount: number;
    remainingAmount: number;
    progressPct: number;
    paidInstallments: number;
    monthsLeft: number;
    isCompleted: boolean;
}

export interface InstallmentStatus {
    installment: Installment;
    remainingAmount: number;    // סכום שנותר לתשלום
    paidAmount: number;         // סכום ששולם (כולל מקדמה)
    paidInstallments: number;   // מספר תשלומים ששולמו
    totalInstallments: number;  // מספר תשלומים כולל
    progressPct: number;        // אחוז התקדמות 0-100
    endDate: string;            // תאריך סיום צפוי
    isCompleted: boolean;       // האם הסתיים
    monthsLeft: number;         // חודשים שנותרו
    loanStatuses: LoanComponentStatus[];
}

export interface CashFlowWarning {
    month: string; // YYYY-MM
    balance: number;
    threshold: number;
    message: string;
}
