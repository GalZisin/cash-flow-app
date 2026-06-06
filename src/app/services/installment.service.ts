import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, of } from 'rxjs';
import { Installment, InstallmentStatus, LoanComponentStatus, CashFlowWarning } from '../models/installment.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class InstallmentService {
    private readonly url = `${environment.apiUrl}/installments`;
    private _items = new BehaviorSubject<Installment[]>([]);
    items$ = this._items.asObservable();

    constructor(private http: HttpClient) { }

    get itemsValue(): Installment[] {
        return this._items.value;
    }

    load() {
        return this.http.get<Installment[]>(this.url).pipe(
            tap(data => this._items.next(data))
        );
    }

    add(item: Omit<Installment, 'id'>) {
        return this.http.post<Installment>(this.url, item).pipe(
            tap(created => this._items.next([...this._items.value, created]))
        );
    }

    update(id: string, changes: Partial<Installment>) {
        return this.http.put<Installment>(`${this.url}/${id}`, changes).pipe(
            tap(updated => this._items.next(
                this._items.value.map(i => i.id === id ? updated : i)
            ))
        );
    }

    delete(id: string) {
        return this.http.delete(`${this.url}/${id}`).pipe(
            tap(() => this._items.next(this._items.value.filter(i => i.id !== id)))
        );
    }

    markAsPaid(item: Installment, paymentDate: string, loanId?: string): Observable<any> {
        if (loanId) {
            const updatedLoans = (item.loanComponents || []).map(l => {
                if (l.id === loanId) {
                    const payments = l.payments || [];
                    return {
                        ...l,
                        paidCount: payments.length + 1,
                        lastPaidDate: paymentDate,
                        payments: [...payments, { date: paymentDate, amount: l.monthlyPayment }]
                    };
                }
                return l;
            });
            return this.update(item.id, { loanComponents: updatedLoans });
        }

        const payments = item.payments || [];
        const newCount = payments.length + 1;
        return this.update(item.id, {
            manualPaidCount: newCount,
            lastManualPaymentDate: paymentDate,
            payments: [...payments, { date: paymentDate, amount: item.monthlyPayment }]
        });
    }

    undoPayment(item: Installment, loanId?: string): Observable<any> {
        if (loanId) {
            const updatedLoans = (item.loanComponents || []).map(l => {
                if (l.id === loanId) {
                    const payments = [...(l.payments || [])];
                    if (payments.length === 0) return l;
                    payments.pop(); // הסרת התשלום האחרון
                    return {
                        ...l,
                        paidCount: payments.length,
                        lastPaidDate: payments.length > 0 ? payments[payments.length - 1].date : undefined,
                        payments: payments
                    };
                }
                return l;
            });
            return this.update(item.id, { loanComponents: updatedLoans });
        }

        // ביטול תשלום ברמה הראשית
        const payments = [...(item.payments || [])];
        if (payments.length === 0) return this.load();

        payments.pop();
        return this.update(item.id, {
            manualPaidCount: payments.length,
            lastManualPaymentDate: payments.length > 0 ? payments[payments.length - 1].date : undefined,
            payments: payments
        });
    }

    /** מחשב את סטטוס הפריסה נכון להיום */
    getStatus(item: Installment): InstallmentStatus {
        const today = new Date();

        // 1. חישוב סטטוס עבור כל הלוואה בנפרד
        const loanStatuses: LoanComponentStatus[] = (item.loanComponents || []).map(loan => {
            const loanStart = new Date(loan.startDate);
            const monthsSinceLoanStart = Math.max(0,
                (today.getFullYear() - loanStart.getFullYear()) * 12 +
                (today.getMonth() - loanStart.getMonth())
            );
            // עדיפות מוחלטת להיסטוריית תשלומים אם המערך קיים (אפילו אם הוא ריק)
            const manualCount = loan.payments ? loan.payments.length : (loan.paidCount || 0);
            const paidCount = Math.min(loan.installmentsCount, loan.payments ? manualCount : Math.max(monthsSinceLoanStart, manualCount));

            // חישוב סכום ששולם: אם יש היסטוריה - סוכמים את הסכומים, אם לא - חישוב לפי כמות
            const paidAmount = loan.payments
                ? loan.payments.reduce((sum, p) => sum + p.amount, 0)
                : paidCount * loan.monthlyPayment;

            const progressPct = loan.totalLoanAmount > 0
                ? Math.min(100, Math.round((paidAmount / loan.totalLoanAmount) * 100))
                : 0;

            return {
                loan,
                paidAmount,
                remainingAmount: Math.max(0, loan.totalLoanAmount - paidAmount),
                progressPct,
                paidInstallments: paidCount,
                monthsLeft: Math.max(0, loan.installmentsCount - paidCount),
                isCompleted: paidAmount >= loan.totalLoanAmount - 0.1
            };
        });

        // 2. חישוב לוגיקה כללית של הפריט
        const totalLoansPaid = loanStatuses.reduce((sum, s) => sum + s.paidAmount, 0);

        // תמיכה בפריסות ישנות ללא הלוואות מפורטות
        const itemStart = new Date(item.startDate);
        const monthsSinceItemStart = Math.max(0,
            (today.getFullYear() - itemStart.getFullYear()) * 12 +
            (today.getMonth() - itemStart.getMonth())
        );

        // חישוב תשלומים ידניים לרמה הראשית (עבור פריסות ללא הלוואות משנה, או תשלומים כלליים שבוצעו)
        const manualCount = item.payments ? item.payments.length : (item.manualPaidCount || 0);
        const legacyPaidCount = item.payments
            ? item.payments.length
            : (item.loanComponents?.length > 0 ? 0 : Math.min(item.installmentsCount, Math.max(monthsSinceItemStart, manualCount)));

        const legacyPaidAmount = item.payments
            ? item.payments.reduce((sum, p) => sum + p.amount, 0)
            : (item.loanComponents?.length > 0 ? 0 : legacyPaidCount * item.monthlyPayment);

        const paidAmount = item.downPayment + totalLoansPaid + legacyPaidAmount;
        const remainingAmount = Math.max(0, item.totalAmount - paidAmount);
        const progressPct = item.totalAmount > 0
            ? Math.min(100, Math.round((paidAmount / item.totalAmount) * 100))
            : 0;

        let totalInstallments = item.installmentsCount;
        if (item.loanComponents?.length > 0) {
            totalInstallments = Math.max(...item.loanComponents.map(l => l.installmentsCount));
        }

        // חישוב חודשים שנותרו לפי ההלוואה שנשאר לה הכי הרבה זמן
        const maxMonthsLeftInLoans = loanStatuses.length > 0 ? Math.max(...loanStatuses.map(s => s.monthsLeft)) : 0;
        const monthsLeft = loanStatuses.length > 0 ? maxMonthsLeftInLoans : Math.max(0, totalInstallments - monthsSinceItemStart);
        const isCompleted = remainingAmount === 0;

        // תאריך סיום צפוי
        const endDate = new Date(itemStart);
        endDate.setMonth(endDate.getMonth() + totalInstallments);

        return {
            installment: item,
            paidAmount,
            remainingAmount,
            paidInstallments: loanStatuses.length > 0 ? loanStatuses.reduce((sum, s) => sum + s.paidInstallments, 0) : legacyPaidCount,
            totalInstallments,
            progressPct,
            endDate: endDate.toISOString().slice(0, 7), // YYYY-MM
            isCompleted,
            monthsLeft,
            loanStatuses
        };
    }

    /**
     * Calculates the total monthly installment payment for a specific month from a given list of installments.
     * @param targetMonthDate The date representing the month for which to calculate payments (e.g., new Date(YYYY, MM, 1)).
     * @param allInstallments The list of installments to consider for the calculation.
     * @returns The sum of monthly payments for all active installments in that month.
     */
    getMonthlyInstallmentsForMonth(targetMonthDate: Date, allInstallments: Installment[]): { installments: number, loans: number } {
        let installments = 0;
        let loans = 0;

        for (const item of allInstallments) {
            if (item.loanComponents && item.loanComponents.length > 0) {
                // זו רכישה עם רכיבי הלוואה מפורטים - נסכום לעמודת ההלוואות
                for (const loan of item.loanComponents) {
                    const start = new Date(loan.startDate);
                    const end = new Date(start.getFullYear(), start.getMonth() + loan.installmentsCount, 1);
                    if (targetMonthDate >= start && targetMonthDate < end) {
                        loans += loan.monthlyPayment;
                    }
                }
            } else {
                // זו פריסת תשלומים רגילה (ללא רכיבי הלוואה) - נסכום לעמודת הפריסות
                const start = new Date(item.startDate);
                const end = new Date(start.getFullYear(), start.getMonth() + item.installmentsCount, 1);
                if (targetMonthDate >= start && targetMonthDate < end) {
                    installments += item.monthlyPayment;
                }
            }
        }
        return { installments, loans };
    }

    /**
     * Simulates the impact of a proposed installment on the cash flow and returns warnings if any.
     * @param proposedInstallment The installment being added or updated.
     * @param currentCashFlowMonths The current state of the cash flow months.
     * @returns An array of CashFlowWarning objects.
     */
    simulateInstallmentImpact(proposedInstallment: Omit<Installment, 'id'> | Installment, currentCashFlowMonths: any[]): CashFlowWarning[] {
        const warnings: CashFlowWarning[] = [];
        const THRESHOLD = 30000; // סף האזהרה

        // יצירת עותק עמוק של חודשי תזרים המזומנים כדי לא לשנות את הנתונים המקוריים
        const simulatedMonths = JSON.parse(JSON.stringify(currentCashFlowMonths));

        // יצירת רשימה היפותטית של פריסות
        let hypotheticalInstallments: Installment[];
        if ((proposedInstallment as Installment).id) { // פריסה קיימת שעוברת עדכון
            hypotheticalInstallments = this._items.value.map(i =>
                i.id === (proposedInstallment as Installment).id ? { ...i, ...proposedInstallment } as Installment : i
            );
        } else { // פריסה חדשה
            hypotheticalInstallments = [...this._items.value, { ...proposedInstallment, id: 'temp-sim-id' } as Installment];
        }

        let prevEndingBalance = 0;
        simulatedMonths.forEach((monthCtrl: any, i: number) => {
            const monthDateValue = monthCtrl.month;
            const targetDate = new Date(monthDateValue);

            // חישוב תשלומי הפריסות עבור החודש הספציפי מהרשימה ההיפותטית
            const totals = this.getMonthlyInstallmentsForMonth(targetDate, hypotheticalInstallments);
            const effectiveLoan = totals.loans || (Number(monthCtrl.loanPayment) || 0);
            monthCtrl.loanPayment = effectiveLoan;
            monthCtrl.installmentsPayment = totals.installments;

            // ... (העתק את לוגיקת חישוב היתרה מ-CashFlowTableComponent.calculateEndingBalances) ...
            // מכיוון שאין לנו גישה ישירה ל-FormGroup/FormArray כאן, נצטרך לשחזר את החישוב
            // זהו חישוב מקוצר לדוגמה, יש להשלים אותו בהתאם ללוגיקה המלאה שלכם ב-CashFlowTableComponent
            const totalStarting = i === 0 ? (Number(monthCtrl.startingBalance) || 0) : prevEndingBalance;
            const income = (Number(monthCtrl.income) || 0) + (monthCtrl.additionalIncomes || []).reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
            const expenses = (Number(monthCtrl.mortgagePayment) || 0) + effectiveLoan + totals.installments + (monthCtrl.specialExpenses || []).reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) + (monthCtrl.regularExpenses || []).reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
            const endingBalance = totalStarting + income - expenses;

            if (i < simulatedMonths.length - 1) {
                simulatedMonths[i + 1].startingBalance = endingBalance;
            }
            monthCtrl.endingBalance = endingBalance; // עדכון עבור החודש הנוכחי

            // בדיקת אזהרות
            if (endingBalance < THRESHOLD) {
                warnings.push({
                    month: new Date(monthDateValue).toISOString().slice(0, 7),
                    balance: endingBalance,
                    threshold: THRESHOLD,
                    message: `היתרה בסוף חודש ${new Date(monthDateValue).toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })} צפויה להיות ${endingBalance.toFixed(0)} ₪, שהיא מתחת לסף של ${THRESHOLD.toFixed(0)} ₪.`
                });
            }
            prevEndingBalance = endingBalance;
        });

        return warnings;
    }

    /** סה"כ תשלום חודשי פעיל מכל הפריסות */
    totalMonthlyActive(items: Installment[]): number {
        return items
            .filter(i => !this.getStatus(i).isCompleted)
            .reduce((sum, i) => sum + i.monthlyPayment, 0);
    }

}
