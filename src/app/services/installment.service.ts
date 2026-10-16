import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of, switchMap } from 'rxjs';
import { Installment, InstallmentStatus, LoanComponentStatus, CashFlowWarning, InstallmentPaymentEntry, PaymentOverride } from '../models/installment.model';
import { getOverrides, overridesAfterPay, overridesAfterReset, overridesAfterUnpay, ResolvedPayment, resolvePayments } from '../utils/installment-schedule.util';
import { environment } from '../../environments/environment';
import { CashFlowService } from './cash-flow.service';

@Injectable({ providedIn: 'root' })
export class InstallmentService {
    private readonly url = `${environment.apiUrl}/installments`;
    private _items = signal<Installment[]>([]);

    // Public readonly signal for components to consume
    items = this._items.asReadonly();

    // Derived state: Total monthly payment of all active installments
    totalMonthlyActive = computed(() =>
        this._items()
            .filter(i => !this.getStatus(i).isCompleted)
            .reduce((sum, i) => sum + i.monthlyPayment, 0)
    );

    constructor(private http: HttpClient, private cashFlowService: CashFlowService) { }

    load() {
        return this.http.get<Installment[]>(this.url).pipe(
            tap(data => {
                const processedData = data.map(item => ({
                    ...item,
                    paymentType: item.paymentType || (item.loanComponents?.length ? 'loan' : (item.milestones?.length ? 'milestone' : 'manual'))
                }));
                this._items.set(processedData);
            })
        );
    }

    add(item: Omit<Installment, 'id'>) {
        return this.http.post<Installment>(this.url, item).pipe(
            tap(created => this._items.update(items => [...items, created]))
        );
    }

    update(id: string, updatedInstallment: Installment) {
        return this.http.put<Installment>(`${this.url}/${id}`, updatedInstallment).pipe(
            tap(updated => this._items.update(items =>
                items.map(i => i.id === id ? updated : i)
            ))
        );
    }

    delete(id: string) {
        const deletedItem = this._items().find(item => item.id === id);
        return this.http.delete(`${this.url}/${id}`).pipe(
            switchMap(response => {
                this._items.update(items => items.filter(i => i.id !== id));
                return deletedItem
                    ? this.removeDeletedItemFromCashFlow(deletedItem).pipe(switchMap(() => of(response)))
                    : of(response);
            })
        );
    }

    private removeDeletedItemFromCashFlow(deletedItem: Installment): Observable<unknown> {
        return this.cashFlowService.load().pipe(
            switchMap(data => {
                const months = data.months.map(month => {
                    const deletedAmount = this.getMonthlyInstallmentsForMonth(
                        this.parseDate(month.month),
                        [deletedItem]
                    ).loans;
                    const manualPayment = Number(month.manualLoanPayment);
                    const isStaleManualCopy = Number.isFinite(manualPayment)
                        && Math.abs(manualPayment - deletedAmount) < 0.01;

                    if (deletedAmount <= 0 || !isStaleManualCopy) return month;

                    return {
                        ...month,
                        loanPayment: Math.max(0, Number(month.loanPayment || 0) - deletedAmount),
                        manualLoanPayment: 0
                    };
                });

                return this.cashFlowService.save({ months });
            })
        );
    }

    /** מסמן תשלום ספציפי כמשולם (גם לפני המועד, או בסכום/תאריך אחר) */
    markPaymentPaid(item: Installment, key: string, paymentDate: string, amount?: number, description?: string): Observable<Installment> {
        const override: PaymentOverride = { key, status: 'paid', date: paymentDate };
        if (amount !== undefined) override.amount = amount;
        if (description) override.description = description;
        return this.saveOverrides(item, overridesAfterPay(item, override));
    }

    /** מסמן תשלום כ"לא שולם" (בוטל / נדחה) */
    markPaymentUnpaid(item: Installment, key: string): Observable<Installment> {
        return this.saveOverrides(item, overridesAfterUnpay(item, key));
    }

    /** מחזיר תשלום לחישוב האוטומטי לפי תאריך */
    resetPayment(item: Installment, key: string): Observable<Installment> {
        return this.saveOverrides(item, overridesAfterReset(item, key));
    }

    /** ✅ : מסמן את התשלום הבא שטרם שולם (של ההלוואה, או של הפריסה) כמשולם */
    markAsPaid(item: Installment, paymentDate: string, loanId?: string): Observable<Installment | null> {
        const next = resolvePayments(item).find(p => !p.paid && p.type !== 'down' && (loanId ? p.loanId === loanId : true));
        return next ? this.markPaymentPaid(item, next.key, paymentDate) : of(null);
    }

    markMilestoneAsPaid(item: Installment, milestoneId: string, paymentDate: string, amount?: number, description?: string): Observable<Installment | null> {
        const milestone = (item.milestones || []).find(m => m.id === milestoneId);
        if (!milestone) return of(null);
        const changedDescription = description && description !== milestone.description ? description : undefined;
        return this.markPaymentPaid(item, `ms:${milestoneId}`, paymentDate, amount, changedDescription);
    }

    /** תשלום נוסף שלא מופיע בלוח התשלומים */
    addAdHocMilestonePayment(item: Installment, paymentId: string, paymentDate: string, amount: number, description: string): Observable<Installment> {
        return this.markPaymentPaid(item, `x:${paymentId}`, paymentDate, amount, description);
    }

    undoMilestonePayment(item: Installment, milestoneId: string): Observable<Installment> {
        const key = (item.milestones || []).some(m => m.id === milestoneId) ? `ms:${milestoneId}` : `x:${milestoneId}`;
        return this.undoPaymentByKey(item, key);
    }

    /** ↺ : ביטול התשלום האחרון ששולם (של ההלוואה, או של הפריסה) */
    undoPayment(item: Installment, loanId?: string): Observable<Installment | null> {
        const paid = resolvePayments(item).filter(p => p.paid && p.type !== 'down' && (loanId ? p.loanId === loanId : true));
        const last = paid.sort((a, b) => (a.paidDate || '').localeCompare(b.paidDate || '')).pop();
        return last ? this.undoPaymentByKey(item, last.key) : of(null);
    }

    /** ↺ על תשלום ספציפי: תשלום נוסף נמחק, תשלום מהלוח מסומן "לא שולם" */
    undoPaymentByKey(item: Installment, key: string): Observable<Installment> {
        return key.startsWith('x:') ? this.resetPayment(item, key) : this.markPaymentUnpaid(item, key);
    }

    private saveOverrides(item: Installment, paymentOverrides: PaymentOverride[]): Observable<Installment> {
        // milestonePayments הומרו ל-paymentOverrides (getOverrides), לכן מנקים את המודל הישן
        return this.update(item.id, { ...item, paymentOverrides, milestonePayments: [] });
    }

    /** תזרים: פעימה ששולמה בפועל עד תחילת החודש שלה לא נספרת שוב באותו חודש */
    private isMilestonePaidEarly(item: Installment, milestoneId: string, targetMonthDate: Date): boolean {
        return getOverrides(item).some(o =>
            o.key === `ms:${milestoneId}` && o.status === 'paid' && !!o.date && this.parseDate(o.date) <= targetMonthDate);
    }

    private parseDate(dateStr: string): Date {
        if (!dateStr) return new Date(0);
        // ניקוי רווחים מיותרים
        const trimmed = dateStr.trim();
        // אם התאריך הוא בפורמט YYYY-MM, נוסיף יום כדי שיהיה תקין לחישובים
        if (trimmed.length === 7 && trimmed.includes('-')) {
            return new Date(`${trimmed}-01`);
        }
        return new Date(trimmed);
    }

    /** מחשב את סטטוס הפריסה נכון להיום: תשלום נחשב כמשולם כשמגיע מועד החיוב שלו, אלא אם תוקן ידנית */
    getStatus(item: Installment, today: Date = new Date()): InstallmentStatus {
        const payments = resolvePayments(item, today);
        const toEntry = (p: ResolvedPayment): InstallmentPaymentEntry => ({
            key: p.key,
            date: p.paid ? p.paidDate! : p.dueDate,
            dueDate: p.dueDate,
            amount: p.paid ? p.paidAmount : p.amount,
            type: p.type,
            source: p.source,
            skipped: p.skipped || undefined,
            index: p.index,
            description: p.description,
            milestoneId: p.milestoneId,
            loanId: p.loanId
        });
        const byDate = (a: InstallmentPaymentEntry, b: InstallmentPaymentEntry) => a.date.localeCompare(b.date);
        const progressOf = (paid: number, total: number) => total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

        // 1. סטטוס לכל הלוואה
        const loanStatuses: LoanComponentStatus[] = (item.loanComponents || []).map(loan => {
            const loanPayments = payments.filter(p => p.loanId === loan.id);
            const paidAmount = loanPayments.reduce((sum, p) => sum + p.paidAmount, 0);
            const scheduledTotal = loanPayments.reduce((sum, p) => sum + p.amount, 0);
            const unpaid = loanPayments.filter(p => !p.paid);
            return {
                loan,
                paidAmount,
                remainingAmount: Math.max(0, scheduledTotal - paidAmount),
                progressPct: progressOf(paidAmount, scheduledTotal),
                paidInstallments: loanPayments.filter(p => p.paid).length,
                monthsLeft: unpaid.length,
                isCompleted: loanPayments.length > 0 && unpaid.length === 0,
                history: loanPayments.filter(p => p.paid).map(toEntry).sort(byDate),
                upcoming: unpaid.map(toEntry)
            };
        });

        // 2. סטטוס כללי: התקדמות = מה ששולם מתוך כל הלוח (כולל מקדמה ותשלומים נוספים)
        const scheduled = payments.filter(p => p.type !== 'extra');
        const installmentsOnly = scheduled.filter(p => p.type !== 'down');
        const paidAmount = payments.reduce((sum, p) => sum + p.paidAmount, 0);
        const scheduledTotal = scheduled.length > 0 ? scheduled.reduce((sum, p) => sum + p.amount, 0) : (Number(item.totalAmount) || 0);
        const remainingAmount = Math.max(0, scheduledTotal - paidAmount);
        const progressPct = progressOf(paidAmount, scheduledTotal);
        const isCompleted = scheduled.length > 0 ? scheduled.every(p => p.paid) : remainingAmount === 0;
        const monthsLeft = loanStatuses.length > 0
            ? Math.max(...loanStatuses.map(s => s.monthsLeft))
            : installmentsOnly.filter(p => !p.paid).length;

        // 3. תאריך סיום צפוי = מועד התשלום האחרון בלוח
        const lastDue = installmentsOnly.reduce((max, p) => p.dueDate > max ? p.dueDate : max, '');

        return {
            installment: item,
            paidAmount,
            remainingAmount,
            paidInstallments: installmentsOnly.filter(p => p.paid).length,
            paidMilestonesCount: payments.filter(p => p.type === 'milestone' && p.paid).length,
            totalInstallments: loanStatuses.length > 0
                ? Math.max(...loanStatuses.map(s => s.paidInstallments + s.monthsLeft))
                : installmentsOnly.length,
            progressPct,
            endDate: (lastDue || item.startDate || '').slice(0, 7), // YYYY-MM
            isCompleted,
            monthsLeft,
            loanStatuses,
            combinedPaymentHistory: payments.filter(p => p.paid).map(toEntry).sort(byDate),
            upcomingPayments: payments.filter(p => !p.paid).map(toEntry)
        };
    }

    /**
     * Calculates the total monthly installment payment for a specific month from a given list of installments.
     * @param targetMonthDate The date representing the month for which to calculate payments (e.g., new Date(YYYY, MM, 1)).
     * @param allInstallments The list of installments to consider for the calculation.
     * @returns The sum of monthly payments for all active installments in that month.
     */
    private toMonthStart(dateStr: string): Date {
        const [y, m] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, 1);
    }

    getMonthlyInstallmentsForMonth(targetMonthDate: Date, allInstallments: Installment[]): { installments: number, loans: number } {
        let installments = 0;
        let loans = 0;
        const target = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), 1);

        for (const item of allInstallments) {
            // בדיקת פעימות (Milestones)
            if (item.paymentType === 'milestone' && item.milestones && item.milestones.length > 0) {
                const milestoneForMonth = item.milestones.find(m => {
                    const [y, mStr] = m.date.split('-').map(Number);
                    return y === target.getFullYear() && (mStr - 1) === target.getMonth();
                });
                if (milestoneForMonth) {
                    if (!this.isMilestonePaidEarly(item, milestoneForMonth.id, targetMonthDate)) {
                        installments += milestoneForMonth.amount;
                    }
                }
            }

            if (item.loanComponents && item.loanComponents.length > 0) {
                if (item.paymentType === 'loan') {
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
            if (item.paymentType === 'loan') {
                if (item.loanComponents && item.loanComponents.length > 0) {
                    for (const loan of item.loanComponents) {
                        const start = this.toMonthStart(loan.startDate);
                        const end = new Date(start.getFullYear(), start.getMonth() + loan.installmentsCount, 1);

                        let amount = 0;
                        if (loan.payoffDate) {
                            const payoff = this.parseDate(loan.payoffDate);
                            if (target.getFullYear() === payoff.getFullYear() && target.getMonth() === payoff.getMonth()) {
                                amount = loan.payoffAmount || 0;
                            } else if (target < payoff && target >= start) {
                                amount = loan.monthlyPayment;
                            }
                        } else if (target >= start && target < end) {
                            amount = loan.monthlyPayment;
                        }

                        if (amount > 0) {
                            breakdown.push({
                                name: `${item.name} (${loan.description || 'הלוואה'})`,
                                amount: amount,
                                isLoan: true
                            });
                        }
                    }
                }
            } else if (item.paymentType === 'manual') {
                const start = this.toMonthStart(item.startDate);
                const end = new Date(start.getFullYear(), start.getMonth() + item.installmentsCount, 1);
                if (target >= start && target < end) { // Only if not a loan component
                    // Check if this installment has manual payments for this month
                    // This logic is for the main installment's monthly payment, not for loan components
                    const hasManualPaymentForMonth = (item.payments || []).some(p => {
                        const pDate = this.parseDate(p.date);
                        return pDate.getFullYear() === target.getFullYear() && pDate.getMonth() === target.getMonth();
                    });
                    if (!hasManualPaymentForMonth) {
                        breakdown.push({ name: item.name, amount: item.monthlyPayment, isLoan: false });
                    }
                }
            } else if (item.paymentType === 'milestone') {
                const milestoneForMonth = item.milestones?.find(m => {
                    const [y, mStr] = m.date.split('-').map(Number);
                    return y === target.getFullYear() && (mStr - 1) === target.getMonth();
                });
                if (milestoneForMonth) {
                    if (!this.isMilestonePaidEarly(item, milestoneForMonth.id, targetMonthDate)) {
                        breakdown.push({ name: `${item.name} (${milestoneForMonth.description})`, amount: milestoneForMonth.amount, isLoan: false });
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
    simulateInstallmentImpact(proposedInstallment: Omit<Installment, 'id'> | Installment, currentCashFlowMonths: Array<{ month: string, startingBalance: number, income: number, mortgagePayment: number, loanPayment: number, specialExpenses: any[], regularExpenses: any[], additionalIncomes: any[] }>): CashFlowWarning[] {
        const warnings: CashFlowWarning[] = [];
        const THRESHOLD = 30000; // סף האזהרה

        const baselineInstallments = this._items();
        const proposedId = (proposedInstallment as Installment).id;

        // יצירת רשימה היפותטית המשלבת את העדכון
        const hypotheticalInstallments = proposedId
            ? baselineInstallments.map(i => String(i.id) === String(proposedId) ? { ...i, ...proposedInstallment } as Installment : i)
            : [...baselineInstallments, { ...proposedInstallment, id: 'temp-sim-id' } as Installment];

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
                (month.specialExpenses || []).reduce((s: number, r: { amount: number }) => s + (Number(r.amount) || 0), 0) +
                (month.regularExpenses || []).reduce((s: number, r: { amount: number }) => s + (Number(r.amount) || 0), 0);

            // 2. חישוב הוצאות מדומות (אחרי השינוי)
            const simTotals = this.getMonthlyInstallmentsForMonth(targetDate, hypotheticalInstallments);
            const simExpenses = (Number(month.mortgagePayment) || 0) + (baseManualLoan + simTotals.loans) + simTotals.installments +
                (month.specialExpenses || []).reduce((s: number, r: { amount: number }) => s + (Number(r.amount) || 0), 0) +
                (month.regularExpenses || []).reduce((s: number, r: { amount: number }) => s + (Number(r.amount) || 0), 0);

            const income = (Number(month.income) || 0) + (month.additionalIncomes || []).reduce((s: number, r: { amount: number }) => s + (Number(r.amount) || 0), 0);

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
}
