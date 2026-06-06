import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InstallmentService } from '../../services/installment.service';
import { Installment, InstallmentStatus, LoanComponent } from '../../models/installment.model';

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
    loanComponents: []
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
    editingId: string | null = null;
    form = EMPTY_FORM();
    pendingDeleteId: string | null = null;
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
            paidCount: 0,
            lastPaidDate: undefined
        };
        this.form.loanComponents = [...(this.form.loanComponents || []), newLoan];
        this.cdr.detectChanges(); // Force change detection to update the view
    }

    removeLoanComponent(index: number) {
        this.form.loanComponents.splice(index, 1);
        this.updateTotalsFromLoans();
    }

    onMonthlyPaymentChange() {
        const remaining = this.amountAfterDown(this.form);
        if (this.form.monthlyPayment > 0 && !(this.form.loanComponents && this.form.loanComponents.length > 0)) { // Only if no loan components
            // חישוב מספר תשלומים לפי סכום חודשי
            this.form.installmentsCount = Math.ceil(remaining / this.form.monthlyPayment);
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

    undoPayment(item: Installment, loanId: string) {
        this.svc.undoPayment(item, loanId).subscribe(() => {
            this.snackBar.open('התשלום בוטל בהצלחה', '', { duration: 2000 });
        });
    }

    toggleLoanHistory(loanId: string) {
        this.expandedLoans[loanId] = !this.expandedLoans[loanId];
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

    submit() {
        // Ensure all relevant fields are numbers and handle potential NaN from empty inputs
        this.form.totalAmount = Number(this.form.totalAmount) || 0;
        this.form.downPayment = Number(this.form.downPayment) || 0; // Ensure it's a number
        this.form.manualPaidCount = Number(this.form.manualPaidCount) || 0; // Ensure it's a number

        // Ensure loanComponents is always an array and its numeric fields are numbers
        this.form.loanComponents = (this.form.loanComponents || []).map(loan => ({
            ...loan,
            totalLoanAmount: Number(loan.totalLoanAmount) || 0,
            monthlyPayment: Number(loan.monthlyPayment) || 0,
            installmentsCount: Number(loan.installmentsCount) || 0,
            paidCount: Number(loan.paidCount) || 0
        }));

        // The lastManualPaymentDate is updated by markAsPaid, or can be set manually if needed in the form.
        // Basic validation
        if (!this.formValid) {
            this.translate.get('INSTALLMENTS.INVALID_FORM_FIELDS')
                .subscribe(msg => this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-error' }));
            return;
        }

        // If loan components exist, derive main monthlyPayment and installmentsCount from them
        if (this.form.loanComponents && this.form.loanComponents.length > 0) {
            this.form.monthlyPayment = this.form.loanComponents.reduce((sum, l) => sum + Number(l.monthlyPayment || 0), 0);
            this.form.installmentsCount = Math.max(1, ...this.form.loanComponents.map(l => Number(l.installmentsCount || 0))); // Ensure at least 1
        } else {
            // Fallback for legacy/simple installments without loan components
            const remaining = this.amountAfterDown(this.form);
            if (this.form.installmentsCount === 0 && this.form.monthlyPayment > 0) {
                this.form.installmentsCount = Math.ceil(remaining / this.form.monthlyPayment);
            } else if (this.form.monthlyPayment === 0 && this.form.installmentsCount > 0) {
                this.form.monthlyPayment = Number((remaining / this.form.installmentsCount).toFixed(2));
            }
        }

        const obs = this.editingId
            ? this.svc.update(this.editingId, this.form)
            : this.svc.add(this.form);

        obs.subscribe(() => {
            this.translate.get(this.editingId ? 'INSTALLMENTS.UPDATED' : 'INSTALLMENTS.ADDED')
                .subscribe(msg => this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-success' }));
            this.closeForm();
        });
    }
}
