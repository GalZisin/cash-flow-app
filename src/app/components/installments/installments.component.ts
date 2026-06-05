import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InstallmentService } from '../../services/installment.service';
import { Installment, InstallmentStatus } from '../../models/installment.model';

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
    lastManualPaymentDate: undefined // הוספת ערך ברירת מחדל
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

    showMarkAsPaidDialog: boolean = false;
    currentInstallmentToMarkPaid: Installment | null = null;
    paymentDateInput: string = new Date().toISOString().slice(0, 10); // Default to today's date
    readonly COLORS = COLORS;
    readonly Math = Math;

    constructor(
        private svc: InstallmentService,
        private snackBar: MatSnackBar,
        private translate: TranslateService
    ) {
        this.svc.items$.pipe(takeUntilDestroyed()).subscribe(items => {
            this.items = items;
            this.statuses = items.map(i => this.svc.getStatus(i));
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

    onMonthlyPaymentChange() {
        const remaining = this.amountAfterDown(this.form);
        if (this.form.monthlyPayment > 0) {
            // חישוב מספר תשלומים לפי סכום חודשי
            this.form.installmentsCount = Math.ceil(remaining / this.form.monthlyPayment);
        }
    }

    // Opens the dialog to mark a payment as paid
    markAsPaid(item: Installment) {
        this.currentInstallmentToMarkPaid = item;
        this.paymentDateInput = new Date().toISOString().slice(0, 10); // Reset to today's date
        this.showMarkAsPaidDialog = true;
    }

    // Confirms marking a payment as paid with the selected date
    confirmMarkAsPaid() {
        if (!this.currentInstallmentToMarkPaid || !this.paymentDateInput) return;

        this.svc.markAsPaid(this.currentInstallmentToMarkPaid, this.paymentDateInput).subscribe(() => {
            this.translate.get('INSTALLMENTS.MARKED_PAID_SUCCESS')
                .subscribe(msg => this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-success' }));
            this.cancelMarkAsPaidDialog();
        });
    }

    // Closes the mark as paid dialog
    cancelMarkAsPaidDialog() {
        this.showMarkAsPaidDialog = false;
        this.currentInstallmentToMarkPaid = null;
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
        this.form.downPayment = Number(this.form.downPayment) || 0;
        this.form.monthlyPayment = Number(this.form.monthlyPayment) || 0;
        this.form.installmentsCount = Number(this.form.installmentsCount) || 0;
        this.form.manualPaidCount = Number(this.form.manualPaidCount) || 0;

        // The lastManualPaymentDate is updated by markAsPaid, or can be set manually if needed in the form.
        // Basic validation
        if (!this.formValid) {
            this.translate.get('INSTALLMENTS.INVALID_FORM_FIELDS')
                .subscribe(msg => this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-error' }));
            return;
        }

        // Re-evaluate consistency before sending to server if one of the fields was 0
        const remaining = this.amountAfterDown(this.form);
        if (this.form.installmentsCount === 0 && this.form.monthlyPayment > 0) {
            this.form.installmentsCount = Math.ceil(remaining / this.form.monthlyPayment);
        } else if (this.form.monthlyPayment === 0 && this.form.installmentsCount > 0) {
            this.form.monthlyPayment = Number((remaining / this.form.installmentsCount).toFixed(2));
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
