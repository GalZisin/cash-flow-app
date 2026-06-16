import { Component, OnInit, ChangeDetectorRef, signal, computed, ChangeDetectionStrategy, inject, DestroyRef } from '@angular/core';
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
import { Installment, InstallmentStatus, LoanComponent, CashFlowWarning, MilestonePayment, Milestone } from '../../models/installment.model';
import { CashFlowService } from '../../services/cash-flow.service'; // Import CashFlowService
import { InstallmentsHeaderComponent } from '../installments-header/installments-header.component';
import { InstallmentConfirmDialogsComponent } from '../installment-confirm-dialogs/installment-confirm-dialogs.component';
import { InstallmentFormComponent } from '../installment-form/installment-form.component';
import { InstallmentCardComponent } from '../installment-card/installment-card.component';
import { InstallmentsEmptyStateComponent } from '../installments-empty-state/installments-empty-state.component';
import { InstallmentsTableComponent } from '../installments-table/installments-table.component';

const COLORS = [
    '#4f6ef7', '#1a7a52', '#a05c00', '#6d3fd6',
    '#c0392b', '#0891b2', '#374151', '#9d174d'
];

export enum InstallmentViewMode {
    GRID = 'grid',
    TABLE = 'table'
}

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
    paymentType: 'manual', // Default to manual payments
    loanComponents: [],
    milestonePayments: [],
    milestones: [],
    payments: []
});

@Component({
    selector: 'app-installments',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        MatTooltipModule,
        MatIconModule,
        MatButtonModule,
        MatSnackBarModule,
        InstallmentsHeaderComponent,
        InstallmentConfirmDialogsComponent,
        InstallmentFormComponent,
        InstallmentCardComponent,
        InstallmentsEmptyStateComponent,
        InstallmentsTableComponent
    ],
    templateUrl: './installments.component.html',
    styleUrl: './installments.component.scss'
})
export class InstallmentsComponent implements OnInit {
    private svc = inject(InstallmentService);
    private snackBar = inject(MatSnackBar);
    private translate = inject(TranslateService);
    private cashFlowService = inject(CashFlowService);
    private destroyRef = inject(DestroyRef); // Inject DestroyRef for takeUntilDestroyed

    // State as Signals
    showForm = signal(false);
    viewMode = signal<InstallmentViewMode>(InstallmentViewMode.GRID);
    readonly ViewMode = InstallmentViewMode; // לאפשר גישה מה-Template
    sortKey = signal<string>('endDate');
    sortDir = signal<'asc' | 'desc'>('asc');
    editingId = signal<string | null>(null);
    form = signal<Installment | Omit<Installment, 'id'>>(EMPTY_FORM()); // Form state as a signal
    pendingDeleteId = signal<string | null>(null);
    pendingWarnings: CashFlowWarning[] | null = null;
    // Added milestoneId to pendingUndoAction type
    pendingUndoAction: { item: Installment, loanId?: string, milestoneId?: string } | null = null;
    expandedLoans = signal<Record<string, boolean>>({}); // Track expand state for history

    showMarkAsPaidDialog = signal(false);
    currentInstallmentToMarkPaid = signal<Installment | null>(null);
    currentMilestoneIdToMarkPaid = signal<string | null>(null); // New field to store milestoneId
    currentLoanToMarkPaid = signal<LoanComponent | null>(null);
    milestonePercentageInput = signal(0);
    milestoneAmountInput = signal(0);
    milestoneDescriptionInput = signal('');
    paymentDateInput = signal(new Date().toISOString().slice(0, 10)); // Default to today's date
    readonly COLORS = COLORS;
    readonly Math = Math;

    // Derived State from Service
    items = this.svc.items;
    statuses = computed(() => this.items().map(i => this.svc.getStatus(i)));

    totalMonthly = this.svc.totalMonthlyActive;
    totalRemaining = computed(() => this.statuses().reduce((s, st) => s + st.remainingAmount, 0));
    activeCount = computed(() => this.statuses().filter(s => !s.isCompleted).length);

    constructor() { }

    ngOnInit() {
        this.svc.load().subscribe();
    }

    /** מחזירה את הסטטוסים ממוינים לפי הבחירה בטבלה */
    sortedStatuses = computed(() => {
        const key = this.sortKey();
        const dir = this.sortDir();
        return [...this.statuses()].sort((a, b) => {
            let v1: string | number, v2: string | number;
            if (key === 'name') { v1 = a.installment.name; v2 = b.installment.name; }
            else if (key === 'total') { v1 = a.installment.totalAmount; v2 = b.installment.totalAmount; }
            else if (key === 'monthly') { v1 = a.installment.monthlyPayment; v2 = b.installment.monthlyPayment; }
            else if (key === 'progress') { v1 = a.progressPct; v2 = b.progressPct; }
            else { v1 = a.endDate; v2 = b.endDate; }

            const res = (v1 < v2) ? -1 : (v1 > v2) ? 1 : 0;
            return dir === 'asc' ? res : -res;
        });
    });

    /** שינוי עמודת המיון */
    setSort(key: string) {
        if (this.sortKey() === key) {
            this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            this.sortKey.set(key);
            this.sortDir.set('asc');
        }
    }

    toggleView() {
        this.viewMode.update(v => v === InstallmentViewMode.GRID ? InstallmentViewMode.TABLE : InstallmentViewMode.GRID);
    }

    statusOf(id: string): InstallmentStatus {
        return this.statuses().find(s => s.installment.id === id)!;
    }

    openAdd() {
        this.form.set(EMPTY_FORM());
        this.editingId.set(null);
        this.showForm.set(true);
    }

    openEdit(item: Installment) {
        // הבטחת קיום סוג תשלום גם עבור נתונים ישנים
        const paymentType = item.paymentType ||
            (item.loanComponents?.length ? 'loan' :
                (item.milestones?.length ? 'milestone' : 'manual'));

        this.form.set({ ...item, paymentType });
        this.editingId.set(item.id);
        this.showForm.set(true);

        // סנכרון חישובים רלוונטיים לסוג שנבחר
        if (this.form().paymentType === 'loan') {
            this.updateTotalsFromLoans();
        }
    }

    /**
     * Resets form fields that are specific to other payment types when the payment type changes.
     * This prevents data from one type (e.g., loan components) from persisting when switching to another (e.g., milestones).
     */
    onPaymentTypeChange() {
        this.form.update(currentForm => {
            const newForm = { ...currentForm };
            if (newForm.paymentType === 'manual') {
                newForm.loanComponents = [];
                newForm.milestones = [];
                newForm.milestonePayments = [];
            } else if (newForm.paymentType === 'loan') {
                newForm.payments = [];
                newForm.milestones = [];
                newForm.milestonePayments = [];
            } else if (newForm.paymentType === 'milestone') {
                newForm.payments = [];
                newForm.loanComponents = [];
            }
            return newForm;
        });
        this.updateTotalsFromLoans();
    }

    onInstallmentsCountChange() {
        this.form.update(currentForm => {
            const newForm = { ...currentForm };
            if (newForm.paymentType === 'manual' && newForm.installmentsCount > 0) {
                const remaining = this.amountAfterDown(newForm);
                newForm.monthlyPayment = Math.round((remaining / newForm.installmentsCount) * 100) / 100;
            }
            return newForm;
        });
    }

    addLoanComponent() {
        this.form.update(currentForm => {
            const newLoan: LoanComponent = {
                id: Date.now().toString(),
                description: '',
                totalLoanAmount: 0,
                monthlyPayment: 0,
                installmentsCount: 12,
                startDate: new Date().toISOString().slice(0, 10),
                interestRate: 0,
                paidCount: 0,
                lastPaidDate: undefined
            };
            return {
                ...currentForm,
                loanComponents: [...(currentForm.loanComponents || []), newLoan]
            };
        });
        this.updateTotalsFromLoans();
    }

    addMilestone() {
        this.form.update(currentForm => {
            const newMilestone: Milestone = {
                id: Date.now().toString(),
                description: '',
                percentage: 0,
                amount: 0,
                date: new Date().toISOString().slice(0, 7)
            };
            return {
                ...currentForm,
                milestones: [...(currentForm.milestones || []), newMilestone]
            };
        });
    }

    removeMilestone(index: number) {
        this.form.update(currentForm => {
            const newMilestones = [...(currentForm.milestones || [])];
            newMilestones.splice(index, 1);
            return { ...currentForm, milestones: newMilestones };
        });
        this.updateTotalsFromLoans();
    }

    onMilestonePctChange(m: Milestone) {
        this.form.update(currentForm => {
            const newForm = { ...currentForm };
            const total = Number(newForm.totalAmount) || 0;
            const updatedMilestones = (newForm.milestones || []).map(mil =>
                mil.id === m.id ? { ...mil, amount: Math.round(total * (Number(m.percentage) / 100)) } : mil
            );
            return { ...newForm, milestones: updatedMilestones };
        });
    }

    onMilestoneAmountChange(m: Milestone) {
        this.form.update(currentForm => {
            const newForm = { ...currentForm };
            const total = Number(newForm.totalAmount) || 0;
            const updatedMilestones = (newForm.milestones || []).map(mil => {
                if (mil.id === m.id) {
                    return { ...mil, percentage: total > 0 ? Number(((m.amount / total) * 100).toFixed(1)) : 0 };
                }
                return mil;
            });
            return { ...newForm, milestones: updatedMilestones };
        });
    }

    calculateLoanPMT(loan: LoanComponent) {
        this.form.update(currentForm => {
            const newForm = { ...currentForm };
            const updatedLoans = (newForm.loanComponents || []).map(l => {
                if (l.id === loan.id) {
                    const total = Math.max(0, Number(loan.totalLoanAmount) || 0);
                    const count = Math.max(1, Number(loan.installmentsCount) || 0);
                    const rate = Number(loan.interestRate) || 0;

                    let monthlyPayment = 0;
                    if (rate > 0 && total > 0 && count > 0) {
                        const annualRate = rate / 100;
                        const monthlyRate = annualRate / 12;
                        const pmt = (monthlyRate * total) / (1 - Math.pow(1 + monthlyRate, -count));
                        monthlyPayment = Math.round(pmt * 100) / 100;
                    } else {
                        monthlyPayment = Math.round((total / count) * 100) / 100;
                    }
                    const updatedLoan = { ...l, monthlyPayment };
                    // If payoffDate is set, recalculate payoff amount
                    if (updatedLoan.payoffDate) {
                        this.calculatePayoffAmount(updatedLoan); // This will update the loan within the signal
                    }
                    return updatedLoan;
                }
                return l;
            });
            return { ...newForm, loanComponents: updatedLoans };
        });
        this.updateTotalsFromLoans();
    }

    calculatePayoffAmount(loan: LoanComponent) {
        this.form.update(currentForm => {
            const newForm = { ...currentForm };
            const updatedLoans = (newForm.loanComponents || []).map(l => {
                if (l.id === loan.id) {
                    if (!loan.payoffDate || !loan.startDate || !loan.totalLoanAmount) return l;

                    const start = new Date(loan.startDate);
                    const payoff = new Date(loan.payoffDate + "-01");

                    const p = (payoff.getFullYear() - start.getFullYear()) * 12 + (payoff.getMonth() - start.getMonth());

                    if (p < 0) return l;
                    if (p >= loan.installmentsCount) {
                        return { ...l, payoffAmount: 0 };
                    }

                    const total = Number(loan.totalLoanAmount);
                    const rate = Number(loan.interestRate) || 0;
                    const n = Number(loan.installmentsCount);

                    let payoffAmount = 0;
                    if (rate > 0) {
                        const r = (rate / 100) / 12;
                        const powN = Math.pow(1 + r, n);
                        const powP = Math.pow(1 + r, p);
                        const balance = total * (powN - powP) / (powN - 1);
                        payoffAmount = Math.round(balance);
                    } else {
                        const monthly = total / n;
                        payoffAmount = Math.round(total - (p * monthly));
                    }
                    return { ...l, payoffAmount };
                }
                return l;
            });
            return { ...newForm, loanComponents: updatedLoans };
        });
    }

    removeLoanComponent(index: number) {
        this.form.update(currentForm => {
            const newLoans = [...(currentForm.loanComponents || [])];
            newLoans.splice(index, 1);
            return { ...currentForm, loanComponents: newLoans };
        });
        this.updateTotalsFromLoans();
    }

    onMonthlyPaymentChange() {
        this.form.update(currentForm => {
            const newForm = { ...currentForm };
            if (newForm.paymentType === 'manual' && newForm.monthlyPayment > 0) {
                const remaining = this.amountAfterDown(newForm);
                newForm.installmentsCount = Math.ceil((remaining / newForm.monthlyPayment) - 0.001);
            }
            return newForm;
        });
    }

    updateTotalsFromLoans() {
        this.form.update(currentForm => {
            const newForm = { ...currentForm };
            if (newForm.paymentType === 'loan' && newForm.loanComponents?.length) {
                const loansSum = newForm.loanComponents.reduce((s, l) => s + (Number(l.totalLoanAmount) || 0), 0);
                const monthlySum = newForm.loanComponents.reduce((s, l) => s + (Number(l.monthlyPayment) || 0), 0);

                if (newForm.totalAmount === 0) {
                    newForm.totalAmount = loansSum + Number(newForm.downPayment);
                }
                newForm.monthlyPayment = monthlySum;

                if (newForm.loanComponents.length > 0) {
                    newForm.installmentsCount = Math.max(...newForm.loanComponents.map(l => Number(l.installmentsCount) || 0));
                }
            }
            return newForm;
        });
    }

    markAsPaid(item: Installment, loan?: LoanComponent, milestoneId?: string) {
        if (item.paymentType === 'milestone') {
            this.openMarkMilestoneAsPaidDialog(item, milestoneId);
            return;
        }

        this.currentInstallmentToMarkPaid.set(item);
        this.currentLoanToMarkPaid.set(loan || null);
        this.currentMilestoneIdToMarkPaid.set(milestoneId || null);
        this.paymentDateInput.set(new Date().toISOString().slice(0, 10));
        this.showMarkAsPaidDialog.set(true);
    }

    openMarkMilestoneAsPaidDialog(item: Installment, milestoneId?: string) {
        this.currentInstallmentToMarkPaid.set(item);
        this.currentLoanToMarkPaid.set(null);
        this.paymentDateInput.set(new Date().toISOString().slice(0, 10));
        this.currentMilestoneIdToMarkPaid.set(milestoneId || null);

        const milestone = item.milestones?.find(m => m.id === milestoneId);
        if (milestone) {
            this.milestonePercentageInput.set(milestone.percentage);
            this.milestoneAmountInput.set(milestone.amount);
            this.milestoneDescriptionInput.set(milestone.description);
        }
        if (!milestoneId) {
            this.milestonePercentageInput.set(0);
            this.milestoneAmountInput.set(0);
            this.milestoneDescriptionInput.set('');
        }

        this.showMarkAsPaidDialog.set(true);
    }

    onMilestoneDialogPercentageChange() {
        const currentInstallment = this.currentInstallmentToMarkPaid();
        if (!currentInstallment) return;
        const total = currentInstallment.totalAmount;
        this.milestoneAmountInput.set(Math.round(total * (this.milestonePercentageInput() / 100)));
    }

    confirmMarkAsPaid() {
        const currentInstallment = this.currentInstallmentToMarkPaid();
        const paymentDate = this.paymentDateInput();
        const milestoneId = this.currentMilestoneIdToMarkPaid();
        const milestoneAmount = this.milestoneAmountInput();
        const milestoneDescription = this.milestoneDescriptionInput();
        const currentLoan = this.currentLoanToMarkPaid();

        if (!currentInstallment || !paymentDate) return;

        if (milestoneId) {
            this.svc.markMilestoneAsPaid(
                currentInstallment,
                milestoneId,
                paymentDate,
                milestoneAmount,
                milestoneDescription
            ).subscribe(() => {
                this.onMarkAsPaidSuccess();
            });
        } else if (currentInstallment.paymentType === 'milestone') {
            const newAdHocMilestoneId = Date.now().toString();
            this.svc.addAdHocMilestonePayment(
                currentInstallment,
                newAdHocMilestoneId,
                paymentDate,
                milestoneAmount,
                milestoneDescription || 'תשלום פעימה נוסף'
            ).subscribe(() => {
                this.translate.get('INSTALLMENTS.MARKED_PAID_SUCCESS')
                    .subscribe(msg => this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-success' }));
                this.cancelMarkAsPaidDialog();
            });
        } else {
            this.svc.markAsPaid(
                currentInstallment,
                paymentDate,
                currentLoan?.id
            ).subscribe(() => {
                this.onMarkAsPaidSuccess();
            });
        }
    }

    private onMarkAsPaidSuccess() {
        this.translate.get('INSTALLMENTS.MARKED_PAID_SUCCESS')
            .subscribe(msg => this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-success' }));
        this.cancelMarkAsPaidDialog();
    }

    undoPayment(item: Installment, loanId?: string, milestoneId?: string) {
        this.pendingUndoAction = { item, loanId, milestoneId }; // Still using object for this specific dialog state
    }

    doUndoPayment() {
        if (!this.pendingUndoAction) return;
        const { item, loanId, milestoneId } = this.pendingUndoAction;
        this.pendingUndoAction = null; // Clear after use
        if (milestoneId) {
            this.svc.undoMilestonePayment(item, milestoneId).subscribe(() => {
                this.snackBar.open('תשלום הפעימה בוטל בהצלחה', '', { duration: 2000 });
            });
        } else {
            this.svc.undoPayment(item, loanId).subscribe(() => {
                this.snackBar.open('התשלום בוטל בהצלחה', '', { duration: 2000 });
            });
        }
    }

    undoMilestonePayment(item: Installment, milestoneId: string) {
        this.pendingUndoAction = { item, milestoneId };
    }

    cancelUndoPayment() {
        this.pendingUndoAction = null;
    }

    toggleLoanHistory(loanId: string) {
        this.expandedLoans.update(current => ({
            ...current,
            [loanId]: !current[loanId]
        }));
    }

    toggleTopHistory(id: string) {
        const key = 'top_' + id;
        this.expandedLoans.update(current => ({
            ...current,
            [key]: !current[key]
        }));
    }

    cancelMarkAsPaidDialog() {
        this.showMarkAsPaidDialog.set(false);
        this.currentInstallmentToMarkPaid.set(null);
        this.currentMilestoneIdToMarkPaid.set(null);
        this.currentLoanToMarkPaid.set(null);
        this.milestonePercentageInput.set(0);
        this.milestoneAmountInput.set(0);
        this.milestoneDescriptionInput.set('');
        this.paymentDateInput.set(new Date().toISOString().slice(0, 10));
    }

    closeForm() {
        this.showForm.set(false);
        this.editingId.set(null);
    }

    confirmDelete(id: string) {
        this.pendingDeleteId.set(id);
    }

    doDelete() {
        const id = this.pendingDeleteId();
        if (!id) return;
        this.pendingDeleteId.set(null);
        this.svc.delete(id).subscribe(() => {
            this.translate.get('INSTALLMENTS.DELETED')
                .subscribe(msg => this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-success' }));
        });
    }

    cancelDelete() { this.pendingDeleteId.set(null); }

    get formValid(): boolean {
        const currentForm = this.form();
        // Ensure loanComponents and milestones are initialized as arrays
        currentForm.loanComponents = currentForm.loanComponents || [];
        currentForm.milestones = currentForm.milestones || [];
        currentForm.milestonePayments = currentForm.milestonePayments || [];

        // Basic validation for name and start date
        const nameValid = !!currentForm.name.trim();
        const dateValid = !!currentForm.startDate;

        let specificTypeValid = true;
        if (currentForm.paymentType === 'manual') {
            const amountsValid = currentForm.totalAmount > 0 && (currentForm.monthlyPayment > 0 || currentForm.installmentsCount > 0);
            const downPaymentValid = currentForm.downPayment <= currentForm.totalAmount;
            specificTypeValid = amountsValid && downPaymentValid;
        } else if (currentForm.paymentType === 'loan') {
            const loansValid = currentForm.loanComponents.every(l => l.totalLoanAmount > 0 && l.monthlyPayment > 0 && l.installmentsCount > 0 && !!l.startDate);
            specificTypeValid = loansValid && currentForm.loanComponents.length > 0;
        } else if (currentForm.paymentType === 'milestone') {
            const milestonesValid = currentForm.milestones.every(m => m.amount > 0 && !!m.date);
            specificTypeValid = milestonesValid && currentForm.milestones.length > 0;
        }

        return nameValid && dateValid && specificTypeValid;
    }

    amountAfterDown(item: Omit<Installment, 'id'> | Installment): number {
        return Math.max(0, item.totalAmount - item.downPayment);
    }

    submit(ignoreWarnings: boolean = false) {
        let currentForm = this.form();

        // 1. Ensure ID is set for update operations
        if (this.editingId()) {
            (currentForm as Installment).id = this.editingId()!;
        }

        // 2. Type-specific data preparation and numeric conversion
        currentForm.totalAmount = Number(currentForm.totalAmount) || 0;
        currentForm.downPayment = Number(currentForm.downPayment) || 0;
        currentForm.manualPaidCount = Number(currentForm.manualPaidCount) || 0;

        // Clear data for other payment types based on the selected type
        if (currentForm.paymentType === 'manual') {
            currentForm.loanComponents = [];
            currentForm.milestones = [];
            currentForm.milestonePayments = [];
            // Ensure monthlyPayment and installmentsCount are consistent for manual type
            const remaining = this.amountAfterDown(currentForm);
            if (currentForm.installmentsCount === 0 && currentForm.monthlyPayment > 0) {
                currentForm.installmentsCount = Math.ceil(remaining / currentForm.monthlyPayment);
            } else if (currentForm.monthlyPayment === 0 && currentForm.installmentsCount > 0) {
                currentForm.monthlyPayment = Math.round((remaining / currentForm.installmentsCount) * 100) / 100;
            }
        } else if (currentForm.paymentType === 'loan') {
            currentForm.payments = [];
            currentForm.milestones = [];
            currentForm.milestonePayments = [];
            // Map loan components and recalculate totals
            currentForm.loanComponents = (currentForm.loanComponents || []).map(loan => ({
                ...loan,
                totalLoanAmount: Number(loan.totalLoanAmount) || 0,
                monthlyPayment: Number(loan.monthlyPayment) || 0,
                installmentsCount: Number(loan.installmentsCount) || 0,
                paidCount: Number(loan.paidCount) || 0,
                interestRate: loan.interestRate !== undefined ? Number(loan.interestRate) : 0,
                payoffAmount: Number(loan.payoffAmount) || 0
            }));
            // סנכרון תאריך התחלה ראשי עם ההלוואה המוקדמת ביותר
            if (currentForm.loanComponents.length > 0) {
                const startDates = currentForm.loanComponents.map(l => l.startDate).sort();
                currentForm.startDate = startDates[0];
            }
            this.updateTotalsFromLoans(); // This will update the form signal
            currentForm = this.form(); // Get updated form after updateTotalsFromLoans
        } else if (currentForm.paymentType === 'milestone') {
            currentForm.payments = [];
            currentForm.loanComponents = [];
            // Map milestones
            currentForm.milestones = (currentForm.milestones || []).map(m => ({
                ...m,
                percentage: Number(m.percentage) || 0,
                amount: Number(m.amount) || 0
            }));
            // סנכרון תאריך התחלה ראשי עם הפעימה המוקדמת ביותר
            if (currentForm.milestones.length > 0) {
                const dates = currentForm.milestones.map(m => m.date).sort();
                currentForm.startDate = dates[0].length === 7 ? `${dates[0]}-01` : dates[0];
            }
            // Calculate installmentsCount based on milestones (duration)
            if (currentForm.milestones.length > 0) {
                const start = new Date(currentForm.startDate);
                const lastMilestoneDate = new Date(Math.max(...currentForm.milestones.map(m => new Date(m.date + '-01').getTime())));
                currentForm.installmentsCount = (lastMilestoneDate.getFullYear() - start.getFullYear()) * 12 + (lastMilestoneDate.getMonth() - start.getMonth()) + 1;
            } else {
                currentForm.installmentsCount = 0;
            }
            currentForm.monthlyPayment = 0; // Milestones don't have a fixed monthly payment
        }

        // Milestone payments are always mapped if they exist, regardless of current paymentType
        currentForm.milestonePayments = (currentForm.milestonePayments || []).map(mp => ({
            ...mp,
            amount: Number(mp.amount) || 0
        }));

        // Update the form signal with the prepared data
        this.form.set(currentForm);

        // --- Simulation for warnings ---
        if (!ignoreWarnings) {
            this.cashFlowService.cashFlowMonths$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((cashFlowMonths: any[]) => {
                const warnings = this.svc.simulateInstallmentImpact(this.form(), cashFlowMonths);
                if (warnings.length > 0) {
                    this.pendingWarnings = warnings;
                    return;
                } else {
                    this.executeSubmit();
                }
            });
        } else {
            this.executeSubmit();
        }
    }

    private executeSubmit() {
        const currentForm = this.form();
        const obs = this.editingId()
            ? this.svc.update(this.editingId()!, currentForm as Installment)
            : this.svc.add(currentForm as Omit<Installment, 'id'>);

        obs.subscribe(() => {
            this.translate.get(this.editingId() ? 'INSTALLMENTS.UPDATED' : 'INSTALLMENTS.ADDED')
                .subscribe(msg => this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-success' }));
            this.closeForm();
        });
    }

    confirmWarnings() {
        this.pendingWarnings = null; // Clear warnings
        this.submit(true);
    }

    cancelWarnings() {
        this.pendingWarnings = null;
    }
}
