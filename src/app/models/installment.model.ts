export interface Installment {
    id: string;
    name: string;
    totalAmount: number;
    downPayment: number;
    monthlyPayment: number;
    installmentsCount: number; // מספר תשלומים כולל
    startDate: string; // ISO date string YYYY-MM-DD
    color: string;
    notes: string;
    manualPaidCount: number;   // מספר תשלומים שסומנו כבוצעו ידנית
    lastManualPaymentDate?: string; // תאריך התשלום הידני האחרון
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
}
