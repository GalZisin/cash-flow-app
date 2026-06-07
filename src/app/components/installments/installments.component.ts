import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { InstallmentService } from '../../services/installment.service';
import { Installment, InstallmentStatus, LoanComponent, CashFlowWarning } from '../../models/installment.model';
import { CashFlowService } from '../../services/cash-flow.service'; // Import CashFlowService

const COLORS = [
    '#4f6ef7', '#1a7a52', '#a05c00', '#6d3fd6',
    '#c0392b', '#0891b2', '#374151', '#9d174d'
];

const EMPTY_FORM = (): Omit<Installment, 'id'> => ({
    name: '',
    totalAmount: 0,
    downPayment: 0,
    monthlyPayment: 0,
    installmentsCount: 0, // הוספת ערך ברירת מחדל לשדה החדש
    startDate: new Date().toISOString().slice(0, 10),
    color: '#4f6ef7',
    notes: '',
    manualPaidCount: 0,    // הוספת ערך ברירת מחדל לשדה החדש
    lastManualPaymentDate: undefined, // הוספת ערך ברירת מחדל
    loanComponents: [],
    payments: []
});

@Component({
    selector: 'app-installments',
    standalone: true,
    imports: [
        CommonModule, FormsModule, TranslateModule,
        MatSnackBarModule, MatTooltipModule, MatIconModule, MatButtonModule
    ],
    templateUrl: './installments.component.html',
    styleUrl: './installments.component.scss'
})
export class InstallmentsComponent implements OnInit {
    items: Installment[] = [];
    statuses: InstallmentStatus[] = [];
    showForm = false;
    viewMode: 'grid' | 'table' = 'grid';
    sortKey: string = 'endDate';
    sortDir: 'asc' | 'desc' = 'asc';
    editingId: string | null = null;
    form = EMPTY_FORM();
    pendingDeleteId: string | null = null;
    pendingWarnings: CashFlowWarning[] | null = null; // New state for warnings
    pendingUndoAction: { item: Installment, loanId?: string } | null = null;
    expandedLoans: Record<string, boolean> = {}; // Track expand state for history

    showMarkAsPaidDialog: boolean = false;
    currentInstallmentToMarkPaid: Installment | null = null;
    currentLoanToMarkPaid: LoanComponent | null = null;
    paymentDateInput: string = new Date().toISOString().slice(0, 10); // Default to today's date
    readonly COLORS = COLORS;
    readonly Math = Math;

    constructor(
        private svc: InstallmentService,
        private snackBar: MatSnackBar,
        private translate: TranslateService,
        private cashFlowService: CashFlowService, // Inject CashFlowService
        private cdr: ChangeDetectorRef // Inject ChangeDetectorRef
    ) {
        this.svc.items$.pipe(takeUntilDestroyed()).subscribe(items => {
            this.items = items;
            this.statuses = items.map(i => this.svc.getStatus(i));
            setTimeout(() => this.cdr.detectChanges(), 0); // Defer change detection to avoid assertion error
        });
    }

    ngOnInit() {
        this.svc.load().subscribe();
    }

    get totalMonthly(): number {
        return this.svc.totalMonthlyActive(this.items);
    }

    get totalRemaining(): number {
        return this.statuses.reduce((s, st) => s + st.remainingAmount, 0);
    }

    get activeCount(): number {
        return this.statuses.filter(s => !s.isCompleted).length;
    }

    /** מחזירה את הסטטוסים ממוינים לפי הבחירה בטבלה */
    get sortedStatuses(): InstallmentStatus[] {
        return [...this.statuses].sort((a, b) => {
            let v1: any, v2: any;
            if (this.sortKey === 'name') { v1 = a.installment.name; v2 = b.installment.name; }
            else if (this.sortKey === 'total') { v1 = a.installment.totalAmount; v2 = b.installment.totalAmount; }
            else if (this.sortKey === 'monthly') { v1 = a.installment.monthlyPayment; v2 = b.installment.monthlyPayment; }
            else if (this.sortKey === 'progress') { v1 = a.progressPct; v2 = b.progressPct; }
            else { v1 = a.endDate; v2 = b.endDate; }

            const res = (v1 < v2) ? -1 : (v1 > v2) ? 1 : 0;
            return this.sortDir === 'asc' ? res : -res;
        });
    }

    /** שינוי עמודת המיון */
    setSort(key: string) {
        if (this.sortKey === key) {
            this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortKey = key;
            this.sortDir = 'asc';
        }
    }

    toggleView() {
        this.viewMode = this.viewMode === 'grid' ? 'table' : 'grid';
    }

    statusOf(id: string): InstallmentStatus {
        return this.statuses.find(s => s.installment.id === id)!;
    }

    openAdd() {
        this.form = EMPTY_FORM();
        this.editingId = null;
        this.showForm = true;
    }

    openEdit(item: Installment) {
        this.form = { ...item };
        this.editingId = item.id;
        this.showForm = true;
    }

    onInstallmentsCountChange() {
        const remaining = this.amountAfterDown(this.form);
        if (this.form.installmentsCount > 0) {
            // חישוב סכום חודשי לפי מספר תשלומים
            this.form.monthlyPayment = Number((remaining / this.form.installmentsCount).toFixed(2));
        }
    }

    addLoanComponent() {
        const newLoan: LoanComponent = {
            id: Date.now().toString(),
            description: '',
            totalLoanAmount: 0,
            monthlyPayment: 0, // Default to 0
            installmentsCount: 12,
            startDate: new Date().toISOString().slice(0, 10), // Default to today's date
            interestRate: 0,
            paidCount: 0,
            lastPaidDate: undefined
        };
        this.form.loanComponents = [...(this.form.loanComponents || []), newLoan];
        this.cdr.detectChanges(); // Force change detection to update the view
    }

    calculateLoanPMT(loan: LoanComponent) {
        const total = Math.max(0, Number(loan.totalLoanAmount) || 0);
        const count = Math.max(1, Number(loan.installmentsCount) || 0);
        const rate = Number(loan.interestRate) || 0;

        if (rate > 0 && total > 0 && count > 0) {
            // נוסחת PMT: [r*PV] / [1 - (1+r)^-n]
            const annualRate = rate / 100;
            const monthlyRate = annualRate / 12;
            const pmt = (monthlyRate * total) / (1 - Math.pow(1 + monthlyRate, -count));
            loan.monthlyPayment = Math.round(pmt * 100) / 100;
        } else {
            // הלוואה ללא ריבית (או ריבית 0) - חלוקה פשוטה של הקרן
            loan.monthlyPayment = Math.round((total / count) * 100) / 100;
        }

        // אם כבר הוגדר תאריך פירעון, נעדכן את הסכום שלו בהתאם לנתונים החדשים
        if (loan.payoffDate) {
            this.calculatePayoffAmount(loan);
        }

        this.updateTotalsFromLoans();
    }

    calculatePayoffAmount(loan: LoanComponent) {
        if (!loan.payoffDate || !loan.startDate || !loan.totalLoanAmount) return;

        const start = new Date(loan.startDate);
        const payoff = new Date(loan.payoffDate + "-01");

        // חישוב מספר התשלומים שיבוצעו עד חודש הפירעון (כולל)
        const p = (payoff.getFullYear() - start.getFullYear()) * 12 + (payoff.getMonth() - start.getMonth());

        if (p < 0) return;
        if (p >= loan.installmentsCount) {
            loan.payoffAmount = 0;
            return;
        }

        const total = Number(loan.totalLoanAmount);
        const rate = Number(loan.interestRate) || 0;
        const n = Number(loan.installmentsCount);

        if (rate > 0) {
            const r = (rate / 100) / 12;
            // נוסחת יתרת קרן שפיצר: PV * [(1+r)^n - (1+r)^p] / [(1+r)^n - 1]
            const powN = Math.pow(1 + r, n);
            const powP = Math.pow(1 + r, p);
            const balance = total * (powN - powP) / (powN - 1);
            loan.payoffAmount = Math.round(balance);
        } else {
            // הלוואה ללא ריבית - יתרה לינארית פשוטה
            const monthly = total / n;
            loan.payoffAmount = Math.round(total - (p * monthly));
        }
    }

    removeLoanComponent(index: number) {
        this.form.loanComponents.splice(index, 1);
        this.updateTotalsFromLoans();
    }

    onMonthlyPaymentChange() {
        const remaining = this.amountAfterDown(this.form);
        if (this.form.monthlyPayment > 0 && !(this.form.loanComponents && this.form.loanComponents.length > 0)) { // Only if no loan components
            // חישוב מספר תשלומים לפי סכום חודשי
            // נשתמש ב-epsilon קטן (0.001) כדי למנוע קפיצה למספר הבא בגלל עיגול של שקלים/אגורות (toFixed)
            this.form.installmentsCount = Math.ceil((remaining / this.form.monthlyPayment) - 0.001);
        }
    }

    updateTotalsFromLoans() {
        // אם אין הלוואות, אנחנו לא דורסים את הערכים הידניים
        if (!this.form.loanComponents || this.form.loanComponents.length === 0) return;

        const loansSum = this.form.loanComponents.reduce((s, l) => s + (Number(l.totalLoanAmount) || 0), 0);
        const monthlySum = this.form.loanComponents.reduce((s, l) => s + (Number(l.monthlyPayment) || 0), 0);

        this.form.totalAmount = loansSum + Number(this.form.downPayment);
        this.form.monthlyPayment = monthlySum;

        // עדכון מספר התשלומים הכולל לפי ההלוואה הארוכה ביותר
        if (this.form.loanComponents.length > 0) {
            this.form.installmentsCount = Math.max(...this.form.loanComponents.map(l => Number(l.installmentsCount) || 0));
        }
    }

    // Opens the dialog to mark a payment as paid
    markAsPaid(item: Installment, loan?: LoanComponent) {
        this.currentInstallmentToMarkPaid = item;
        this.currentLoanToMarkPaid = loan || null;
        this.paymentDateInput = new Date().toISOString().slice(0, 10); // Reset to today's date
        this.showMarkAsPaidDialog = true;
    }

    // Confirms marking a payment as paid with the selected date
    confirmMarkAsPaid() {
        if (!this.currentInstallmentToMarkPaid || !this.paymentDateInput) return;

        this.svc.markAsPaid(
            this.currentInstallmentToMarkPaid,
            this.paymentDateInput,
            this.currentLoanToMarkPaid?.id
        ).subscribe(() => {
            this.translate.get('INSTALLMENTS.MARKED_PAID_SUCCESS')
                .subscribe(msg => this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-success' }));
            this.cancelMarkAsPaidDialog();
        });
    }

    undoPayment(item: Installment, loanId?: string) {
        this.pendingUndoAction = { item, loanId };
    }

    doUndoPayment() {
        if (!this.pendingUndoAction) return;
        const { item, loanId } = this.pendingUndoAction;
        this.pendingUndoAction = null;
        this.svc.undoPayment(item, loanId).subscribe(() => {
            this.snackBar.open('התשלום בוטל בהצלחה', '', { duration: 2000 });
        });
    }

    cancelUndoPayment() {
        this.pendingUndoAction = null;
    }

    toggleLoanHistory(loanId: string) {
        this.expandedLoans[loanId] = !this.expandedLoans[loanId];
    }

    toggleTopHistory(id: string) {
        this.expandedLoans['top_' + id] = !this.expandedLoans['top_' + id];
    }

    // Closes the mark as paid dialog
    cancelMarkAsPaidDialog() {
        this.showMarkAsPaidDialog = false;
        this.currentInstallmentToMarkPaid = null;
        this.currentLoanToMarkPaid = null;
        this.paymentDateInput = new Date().toISOString().slice(0, 10);
    }

    closeForm() {
        this.showForm = false;
        this.editingId = null;
    }

    confirmDelete(id: string) {
        this.pendingDeleteId = id;
    }

    doDelete() {
        if (!this.pendingDeleteId) return;
        const id = this.pendingDeleteId;
        this.pendingDeleteId = null;
        this.svc.delete(id).subscribe(() => {
            this.translate.get('INSTALLMENTS.DELETED')
                .subscribe(msg => this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-success' }));
        });
    }

    cancelDelete() { this.pendingDeleteId = null; }

    get formValid(): boolean {
        const nameValid = !!this.form.name.trim();
        // Allow either monthlyPayment > 0 OR installmentsCount > 0
        const amountsValid = this.form.totalAmount > 0 && (this.form.monthlyPayment > 0 || this.form.installmentsCount > 0);
        const dateValid = !!this.form.startDate;
        const downPaymentValid = this.form.downPayment <= this.form.totalAmount;

        return nameValid && amountsValid && dateValid && downPaymentValid;
    }

    amountAfterDown(item: Omit<Installment, 'id'> | Installment): number {
        return Math.max(0, item.totalAmount - item.downPayment);
    }

    submit(ignoreWarnings: boolean = false) {
        console.log("submit ignoreWarnings: ", ignoreWarnings)
        // 1. קיבוע ה-ID עבור הסימולטור והשרת
        if (this.editingId) {
            (this.form as any).id = this.editingId;
        }

        // 2. המרה למספרים
        this.form.totalAmount = Number(this.form.totalAmount) || 0;
        this.form.downPayment = Number(this.form.downPayment) || 0;
        this.form.manualPaidCount = Number(this.form.manualPaidCount) || 0;

        this.form.loanComponents = (this.form.loanComponents || []).map(loan => ({
            ...loan,
            totalLoanAmount: Number(loan.totalLoanAmount) || 0,
            monthlyPayment: Number(loan.monthlyPayment) || 0,
            installmentsCount: Number(loan.installmentsCount) || 0,
            paidCount: Number(loan.paidCount) || 0,
            interestRate: loan.interestRate !== undefined ? Number(loan.interestRate) : 0,
            payoffAmount: Number(loan.payoffAmount) || 0
        }));

        if (!this.formValid) {
            this.translate.get('INSTALLMENTS.INVALID_FORM_FIELDS').subscribe(msg => this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-error' }));
            return;
        }

        // 3. עדכון סופי של סכומי האב לפני הסימולציה
        if (this.form.loanComponents && this.form.loanComponents.length > 0) {
            this.form.monthlyPayment = Math.round(this.form.loanComponents.reduce((sum, l) => sum + Number(l.monthlyPayment || 0), 0) * 100) / 100;
            this.form.installmentsCount = Math.max(1, ...this.form.loanComponents.map(l => Number(l.installmentsCount || 0))); // Ensure at least 1
        } else {
            const remaining = this.amountAfterDown(this.form);
            if (this.form.installmentsCount === 0 && this.form.monthlyPayment > 0) {
                this.form.installmentsCount = Math.ceil(remaining / this.form.monthlyPayment);
            } else if (this.form.monthlyPayment === 0 && this.form.installmentsCount > 0) {
                this.form.monthlyPayment = Number((remaining / this.form.installmentsCount).toFixed(2));
            }
        }

        // --- Simulation for warnings ---
        if (!ignoreWarnings) {
            this.cashFlowService.cashFlowMonths$.pipe(take(1)).subscribe((cashFlowMonths: any[]) => {
                const warnings = this.svc.simulateInstallmentImpact(this.form, cashFlowMonths);
                if (warnings.length > 0) {
                    this.pendingWarnings = warnings;
                    // Display warning dialog (handled by HTML @if)
                    return; // Stop submission, wait for user confirmation
                } else {
                    this.executeSubmit(); // No warnings, proceed
                }
            });
        } else {
            this.executeSubmit(); // Warnings ignored, proceed
        }
    }

    private executeSubmit() {
        const obs = this.editingId
            ? this.svc.update(this.editingId, this.form)
            : this.svc.add(this.form);

        obs.subscribe(() => {
            this.translate.get(this.editingId ? 'INSTALLMENTS.UPDATED' : 'INSTALLMENTS.ADDED')
                .subscribe(msg => this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-success' }));
            this.closeForm();
            // After successful submission, recalculate cash flow to reflect changes
            // This is handled by CashFlowTableComponent subscribing to installmentService.items$
        });
    }

    confirmWarnings() {
        this.pendingWarnings = null;
        this.submit(true); // Proceed with submission, ignoring warnings
    }

    cancelWarnings() {
        this.pendingWarnings = null;
        // User chose not to proceed, form remains open
    }
}
