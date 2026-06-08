import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, of, map } from 'rxjs';
import { Installment, InstallmentStatus, LoanComponentStatus, CashFlowWarning, MilestonePayment } from '../models/installment.model';
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

    markMilestoneAsPaid(item: Installment, milestoneId: string, paymentDate: string): Observable<any> {
        const milestones = item.milestones || [];
        const milestone = milestones.find(m => m.id === milestoneId);
        if (!milestone) return of(null); // Milestone not found

        const newMilestonePayment: MilestonePayment = {
            date: paymentDate,
            amount: milestone.amount,
            milestoneId: milestone.id,
            description: milestone.description
        };

        const updatedMilestonePayments = [...(item.milestonePayments || []), newMilestonePayment];
        return this.update(item.id, { milestonePayments: updatedMilestonePayments });
    }

    undoMilestonePayment(item: Installment, milestoneId: string): Observable<any> {
        const updatedMilestonePayments = [...(item.milestonePayments || [])];
        const indexToRemove = updatedMilestonePayments.findIndex(mp => mp.milestoneId === milestoneId);
        if (indexToRemove > -1) {
            updatedMilestonePayments.splice(indexToRemove, 1);
        }
        return this.update(item.id, { milestonePayments: updatedMilestonePayments });
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

    private parseDate(dateStr: string): Date {
        if (!dateStr) return new Date(0);
        // אם התאריך הוא בפורמט YYYY-MM, נוסיף יום כדי שיהיה תקין לחישובים
        if (dateStr.length === 7) {
            return new Date(`${dateStr}-01`);
        }
        return new Date(dateStr);
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

        // חישוב פעימות ששולמו (לפי תאריך שעבר)
        const totalMilestonesPaid = (item.milestonePayments || []).reduce((sum, mp) => sum + mp.amount, 0);
        const paidMilestonesCount = (item.milestonePayments || []).length;

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

        const paidAmount = item.downPayment + totalLoansPaid + legacyPaidAmount + totalMilestonesPaid;
        const remainingAmount = Math.max(0, item.totalAmount - paidAmount);
        const progressPct = item.totalAmount > 0
            ? Math.min(100, Math.round((paidAmount / item.totalAmount) * 100))
            : 0;

        let totalInstallments = item.installmentsCount;
        if (item.loanComponents?.length > 0) {
            totalInstallments = Math.max(...item.loanComponents.map(l => l.installmentsCount));
        } else if (item.milestones && item.milestones.length > 0) {
            // אם יש פעימות, משך הזמן הוא עד הפעימה האחרונה
            const dates = item.milestones.map(m => new Date(m.date + '-01'));
            const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
            totalInstallments = Math.max(0, (maxDate.getFullYear() - itemStart.getFullYear()) * 12 + (maxDate.getMonth() - itemStart.getMonth()));
        }

        // חישוב חודשים שנותרו לפי ההלוואה שנשאר לה הכי הרבה זמן
        const maxMonthsLeftInLoans = loanStatuses.length > 0 ? Math.max(...loanStatuses.map(s => s.monthsLeft)) : 0;
        const paidMilestoneIds = new Set((item.milestonePayments || []).map(mp => mp.milestoneId));
        const upcomingMilestones = (item.milestones || []).filter(m => !paidMilestoneIds.has(m.id) && new Date(m.date + '-01') > today);
        const monthsLeft = loanStatuses.length > 0 ? maxMonthsLeftInLoans :
            (upcomingMilestones.length > 0 ? upcomingMilestones.length : Math.max(0, totalInstallments - monthsSinceItemStart));
        const isCompleted = remainingAmount === 0;

        // תאריך סיום צפוי
        const endDate = new Date(itemStart);
        endDate.setMonth(endDate.getMonth() + totalInstallments);

        // Combine all payment types into a single history for display
        const combinedPaymentHistory: { date: string, amount: number, type: 'manual' | 'loan' | 'milestone', description?: string, milestoneId?: string }[] = [];
        const upcomingPayments: { date: string, amount: number, type: 'manual' | 'loan' | 'milestone', description?: string, milestoneId?: string }[] = [];

        // Add manual payments (main installment)
        (item.payments || []).forEach(p => combinedPaymentHistory.push({ ...p, type: 'manual', description: `תשלום חודשי` }));

        // Add loan payments to combined history ONLY if there are no specific loan components defined for this installment.
        // If loan components exist, their payments are displayed in their dedicated section.
        if (!item.loanComponents || item.loanComponents.length === 0) {
            loanStatuses.forEach(ls => {
                (ls.loan.payments || []).forEach(p => combinedPaymentHistory.push({ ...p, type: 'loan', description: ls.loan.description }));
            });
        }

        // Add recorded milestone payments to combined history
        (item.milestonePayments || []).forEach(mp => {
            combinedPaymentHistory.push({ date: mp.date, amount: mp.amount, type: 'milestone', description: mp.description, milestoneId: mp.milestoneId });
        });

        // Add upcoming milestones (not yet paid) to upcoming payments
        (item.milestones || []).filter(m => !paidMilestoneIds.has(m.id)).forEach(m => {
            const mDate = m.date.length === 7 ? `${m.date}-01` : m.date; // Ensure YYYY-MM-DD format for consistency
            const entry = { date: mDate, amount: m.amount, type: 'milestone' as const, description: m.description, milestoneId: m.id };
            upcomingPayments.push(entry);
        });

        // Sort the combined history by date
        combinedPaymentHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        upcomingPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return {
            installment: item,
            paidAmount,
            remainingAmount,
            paidInstallments: (loanStatuses.length > 0 ? loanStatuses.reduce((sum, s) => sum + s.paidInstallments, 0) : legacyPaidCount) + paidMilestonesCount,
            paidMilestonesCount,
            totalInstallments,
            progressPct,
            endDate: endDate.toISOString().slice(0, 7), // YYYY-MM
            isCompleted,
            monthsLeft,
            loanStatuses,
            combinedPaymentHistory,
            upcomingPayments,
            milestonePayments: item.milestonePayments // Include actual milestone payments in status
        };
    }

    /**
     * Calculates the total monthly installment payment for a specific month from a given list of installments.
     * @param targetMonthDate The date representing the month for which to calculate payments (e.g., new Date(YYYY, MM, 1)).
     * @param allInstallments The list of installments to consider for the calculation.
     * @returns The sum of monthly payments for all active installments in that month.
     */
    private toMonthStart(dateStr: string): Date {
        const d = new Date(dateStr);
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), 1);
    }

    getMonthlyInstallmentsForMonth(targetMonthDate: Date, allInstallments: Installment[]): { installments: number, loans: number } {
        let installments = 0;
        let loans = 0;
        const target = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), 1);

        for (const item of allInstallments) {
            // בדיקת פעימות (Milestones)
            if (item.milestones && item.milestones.length > 0) {
                const milestoneForMonth = item.milestones.find(m => {
                    const mDate = new Date(m.date + '-01');
                    return mDate.getFullYear() === target.getFullYear() && mDate.getMonth() === target.getMonth();
                });
                if (milestoneForMonth) {
                    // Check if this milestone has already been paid
                    const isPaid = (item.milestonePayments || []).some(mp => mp.milestoneId === milestoneForMonth.id && this.parseDate(mp.date).getMonth() === target.getMonth() && this.parseDate(mp.date).getFullYear() === target.getFullYear());
                    if (!isPaid) {
                        installments += milestoneForMonth.amount;
                    }
                }
            }

            if (item.loanComponents && item.loanComponents.length > 0) {
                for (const loan of item.loanComponents) {
                    const start = this.toMonthStart(loan.startDate);
                    const end = new Date(start.getFullYear(), start.getMonth() + loan.installmentsCount, 1);

                    let currentPayment = 0;
                    if (loan.payoffDate) {
                        const payoff = this.parseDate(loan.payoffDate);
                        if (target.getFullYear() === payoff.getFullYear() && target.getMonth() === payoff.getMonth()) {
                            currentPayment = loan.payoffAmount || 0;
                        } else if (target > payoff) {
                            currentPayment = 0;
                        } else if (target >= start && target < end) {
                            currentPayment = loan.monthlyPayment;
                        }
                    } else if (target >= start && target < end) {
                        currentPayment = loan.monthlyPayment;
                    }
                    loans += currentPayment;
                }
            } else {
                const start = this.toMonthStart(item.startDate);
                const end = new Date(start.getFullYear(), start.getMonth() + item.installmentsCount, 1);
                if (target >= start && target < end) {
                    installments += item.monthlyPayment;
                }
            }
        }
        return { installments, loans };
    }

    /**
     * מחזירה פירוט של כל הפריטים והסכומים שהם תורמים לחודש מסוים.
     * משמש להצגת Tooltip בתזרים המזומנים.
     */
    getMonthlyBreakdownForMonth(targetMonthDate: Date, allInstallments: Installment[]): { name: string, amount: number, isLoan: boolean }[] {
        const breakdown: { name: string, amount: number, isLoan: boolean }[] = [];
        const target = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), 1);

        for (const item of allInstallments) {
            if (item.loanComponents && item.loanComponents.length > 0) {
                let itemLoanTotal = 0;
                for (const loan of item.loanComponents) {
                    const start = this.toMonthStart(loan.startDate);
                    const end = new Date(start.getFullYear(), start.getMonth() + loan.installmentsCount, 1);

                    if (loan.payoffDate) {
                        const payoff = this.parseDate(loan.payoffDate);
                        if (target.getFullYear() === payoff.getFullYear() && target.getMonth() === payoff.getMonth()) {
                            itemLoanTotal += loan.payoffAmount || 0;
                        } else if (target < payoff && target >= start) {
                            itemLoanTotal += loan.monthlyPayment;
                        }
                    } else if (target >= start && target < end) {
                        itemLoanTotal += loan.monthlyPayment;
                    }
                }
                if (itemLoanTotal > 0) breakdown.push({ name: item.name, amount: itemLoanTotal, isLoan: true });
            } else {
                const start = this.toMonthStart(item.startDate);
                const end = new Date(start.getFullYear(), start.getMonth() + item.installmentsCount, 1);
                if (target >= start && target < end) { // Only if not a loan component
                    // Check if this installment has manual payments for this month
                    const hasManualPaymentForMonth = (item.payments || []).some(p => {
                        const pDate = this.parseDate(p.date);
                        return pDate.getFullYear() === target.getFullYear() && pDate.getMonth() === target.getMonth();
                    });
                    if (!hasManualPaymentForMonth) {
                        breakdown.push({ name: item.name, amount: item.monthlyPayment, isLoan: false });
                    }
                }
            }
        }
        return breakdown;
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
        const SIGNIFICANCE_THRESHOLD = 100; // התעלמות משינויים קטנים ברמת היתרה

        const baselineInstallments = this._items.value;
        const proposedId = (proposedInstallment as Installment).id;

        // יצירת רשימה היפותטית המשלבת את העדכון
        const hypotheticalInstallments = proposedId
            ? baselineInstallments.map(i => String(i.id) === String(proposedId) ? { ...i, ...proposedInstallment } as any : i)
            : [...baselineInstallments, { ...proposedInstallment, id: 'temp-sim-id' } as any];

        let prevBaseBalance = 0;
        let prevSimBalance = 0;

        // דגלים למניעת חזרה על אותה אזהרה לאורך חודשים רצופים
        let warnedNegative = false;
        let warnedThreshold = false;

        currentCashFlowMonths.forEach((month, i) => {
            const targetDate = new Date(month.month);

            // 1. חישוב הוצאות בסיס (לפני השינוי)
            const baseTotals = this.getMonthlyInstallmentsForMonth(targetDate, baselineInstallments);
            const baseManualLoan = Number(month.loanPayment) || 0; // manualLoanPayment מהטבלה
            const baseExpenses = (Number(month.mortgagePayment) || 0) + (baseManualLoan + baseTotals.loans) + baseTotals.installments +
                (month.specialExpenses || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0) +
                (month.regularExpenses || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);

            // 2. חישוב הוצאות מדומות (אחרי השינוי)
            const simTotals = this.getMonthlyInstallmentsForMonth(targetDate, hypotheticalInstallments);
            const simExpenses = (Number(month.mortgagePayment) || 0) + (baseManualLoan + simTotals.loans) + simTotals.installments +
                (month.specialExpenses || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0) +
                (month.regularExpenses || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);

            const income = (Number(month.income) || 0) + (month.additionalIncomes || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);

            // 3. חישוב יתרות
            const startBase = i === 0 ? (Number(month.startingBalance) || 0) : prevBaseBalance;
            const startSim = i === 0 ? (Number(month.startingBalance) || 0) : prevSimBalance;

            const endBase = startBase + income - baseExpenses;
            const endSim = startSim + income - simExpenses;

            prevBaseBalance = endBase;
            prevSimBalance = endSim;

            // 4. לוגיקת אזהרה חכמה - האם השינוי יצר בעיה חדשה?
            const isNewNegative = !warnedNegative && endSim < -1 && endBase >= -1;
            const isNewBelowThreshold = !warnedThreshold && !warnedNegative && endSim < THRESHOLD && endBase >= THRESHOLD;

            // האם המצב הקיים הוחמר משמעותית (למשל תשלום פירעון גדול בתוך חודש שכבר במינוס)
            const isSignificantlyWorse = endSim < -1 && (endBase - endSim) > 500 && !warnedNegative;

            let warningMsg = '';
            if (isNewNegative) {
                warningMsg = `היתרה הופכת לשלילית בעקבות השינוי (${endSim.toFixed(0)} ₪)`;
                warnedNegative = true;
            } else if (isNewBelowThreshold) {
                warningMsg = `היתרה יורדת מתחת לסף האזהרה (${endSim.toFixed(0)} ₪)`;
                warnedThreshold = true;
            } else if (isSignificantlyWorse) {
                warningMsg = `הגירעון הקיים גדל משמעותית בעקבות השינוי (${endSim.toFixed(0)} ₪)`;
                warnedNegative = true;
            }

            if (warningMsg) {
                warnings.push({
                    month: targetDate.toISOString().slice(0, 7),
                    balance: endSim,
                    threshold: THRESHOLD,
                    message: `חודש ${targetDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })}: ${warningMsg}`
                });
            }
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
