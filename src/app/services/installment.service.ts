import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Installment, InstallmentStatus, LoanComponentStatus } from '../models/installment.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class InstallmentService {
    private readonly url = `${environment.apiUrl}/installments`;
    private _items = new BehaviorSubject<Installment[]>([]);
    items$ = this._items.asObservable();

    constructor(private http: HttpClient) { }

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

        const newCount = (item.manualPaidCount || 0) + 1;
        return this.update(item.id, {
            manualPaidCount: newCount,
            lastManualPaymentDate: paymentDate
        });
    }

    undoPayment(item: Installment, loanId: string): Observable<any> {
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
        const legacyPaidCount = item.loanComponents?.length > 0 ? 0 : Math.min(item.installmentsCount, Math.max(monthsSinceItemStart, item.manualPaidCount || 0));
        const legacyPaidAmount = legacyPaidCount * item.monthlyPayment;

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

    /** סה"כ תשלום חודשי פעיל מכל הפריסות */
    totalMonthlyActive(items: Installment[]): number {
        return items
            .filter(i => !this.getStatus(i).isCompleted)
            .reduce((sum, i) => sum + i.monthlyPayment, 0);
    }

    /**
     * Calculates the total monthly installment payment for a specific month.
     * @param targetMonthDate The date representing the month for which to calculate payments (e.g., new Date(YYYY, MM, 1)).
     * @returns The sum of monthly payments for all active installments in that month.
     */
    getMonthlyInstallmentsForMonth(targetMonthDate: Date): number {
        let total = 0;
        const currentItems = this._items.value;

        for (const item of currentItems) {
            if (item.loanComponents && item.loanComponents.length > 0) {
                // סכימת תשלומים מכל רכיבי ההלוואה
                for (const loan of item.loanComponents) {
                    const start = new Date(loan.startDate);
                    const end = new Date(start.getFullYear(), start.getMonth() + loan.installmentsCount, 1);
                    if (targetMonthDate >= start && targetMonthDate < end) {
                        total += loan.monthlyPayment;
                    }
                }
            } else {
                // לוגיקת תאימות אחורה לפריסות פשוטות
                const start = new Date(item.startDate);
                const end = new Date(start.getFullYear(), start.getMonth() + item.installmentsCount, 1);
                if (targetMonthDate >= start && targetMonthDate < end) {
                    total += item.monthlyPayment;
                }
            }
        }
        return total;
    }
}
