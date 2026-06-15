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
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        MatTooltipModule,
        MatIconModule,
        MatButtonModule,
        MatSnackBarModule,
        MatTooltipModule,
        MatIconModule,
        MatButtonModule,
        InstallmentsHeaderComponent,
        // InstallmentConfirmDialogsComponent, // This component is not used directly in the template, but rather its methods are called.
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
    items: Installment[] = [];
    statuses: InstallmentStatus[] = [];
    showForm = false;
    viewMode: InstallmentViewMode = InstallmentViewMode.GRID;
    readonly ViewMode = InstallmentViewMode; // לאפשר גישה מה-Template
    sortKey: string = 'endDate';
    sortDir: 'asc' | 'desc' = 'asc';
    editingId: string | null = null;
    form: Installment | Omit<Installment, 'id'> = EMPTY_FORM();
    pendingDeleteId: string | null = null;
    pendingWarnings: CashFlowWarning[] | null = null;
    // Added milestoneId to pendingUndoAction type
    pendingUndoAction: { item: Installment, loanId?: string, milestoneId?: string } | null = null;
    expandedLoans: Record<string, boolean> = {}; // Track expand state for history

    showMarkAsPaidDialog: boolean = false;
    currentInstallmentToMarkPaid: Installment | null = null;
    currentMilestoneIdToMarkPaid: string | null = null; // New field to store milestoneId
    currentLoanToMarkPaid: LoanComponent | null = null;
    milestonePercentageInput: number = 0;
    milestoneAmountInput: number = 0;
    milestoneDescriptionInput: string = '';
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
            // שימוש ב-requestAnimationFrame נחשב לעיתים קרובות לנקי יותר מ-setTimeout(0)
            // או פשוט לסמוך על ה-Cycle הבא אם ה-Subscription קורה מחוץ ל-Init
            requestAnimationFrame(() => {
                this.cdr.detectChanges();
            });
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
        this.viewMode = this.viewMode === InstallmentViewMode.GRID ? InstallmentViewMode.TABLE : InstallmentViewMode.GRID;
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
        // הבטחת קיום סוג תשלום גם עבור נתונים ישנים
        const paymentType = item.paymentType ||
            (item.loanComponents?.length ? 'loan' :
                (item.milestones?.length ? 'milestone' : 'manual'));

        this.form = { ...item, paymentType };
        this.editingId = item.id;
        this.showForm = true;

        // סנכרון חישובים רלוונטיים לסוג שנבחר
        if (this.form.paymentType === 'loan') {
            this.updateTotalsFromLoans();
        }
    }

    /**
     * Resets form fields that are specific to other payment types when the payment type changes.
     * This prevents data from one type (e.g., loan components) from persisting when switching to another (e.g., milestones).
     */
    onPaymentTypeChange() {
        if (this.form.paymentType === 'manual') {
            this.form.loanComponents = [];
            this.form.milestones = [];
            this.form.milestonePayments = [];
        } else if (this.form.paymentType === 'loan') {
            this.form.payments = [];
            this.form.milestones = [];
            this.form.milestonePayments = [];
        } else if (this.form.paymentType === 'milestone') {
            this.form.payments = [];
            this.form.loanComponents = [];
        }
        // Re-evaluate calculations that might depend on the payment type
        this.updateTotalsFromLoans(); // For loan type
    }

    onInstallmentsCountChange() {
        if (this.form.paymentType === 'manual' && this.form.installmentsCount > 0) {
            const remaining = this.amountAfterDown(this.form);
            // חישוב סכום חודשי לפי מספר תשלומים
            this.form.monthlyPayment = Math.round((remaining / this.form.installmentsCount) * 100) / 100;
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

    addMilestone() {
        const newMilestone = {
            id: Date.now().toString(),
            description: '',
            percentage: 0,
            amount: 0,
            date: new Date().toISOString().slice(0, 7) // YYYY-MM
            // milestoneId is not needed here, it's for milestonePayments
        };
        this.form.milestones = [...(this.form.milestones || []), newMilestone];
    }

    removeMilestone(index: number) {
        this.form.milestones?.splice(index, 1);
    }

    onMilestonePctChange(m: Milestone) {
        const total = Number(this.form.totalAmount) || 0;
        m.amount = Math.round(total * (Number(m.percentage) / 100));
    }

    onMilestoneAmountChange(m: Milestone) {
        const total = Number(this.form.totalAmount) || 0;
        if (total > 0) {
            m.percentage = Number(((m.amount / total) * 100).toFixed(1));
        }
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
        if (this.form.loanComponents) {
            this.form.loanComponents.splice(index, 1);
        }
        this.updateTotalsFromLoans();
    }

    onMonthlyPaymentChange() {
        if (this.form.paymentType === 'manual' && this.form.monthlyPayment > 0) {
            // חישוב מספר תשלומים לפי סכום חודשי
            const remaining = this.amountAfterDown(this.form);
            // נשתמש ב-epsilon קטן (0.001) כדי למנוע קפיצה למספר הבא בגלל עיגול של שקלים/אגורות (toFixed)
            this.form.installmentsCount = Math.ceil((remaining / this.form.monthlyPayment) - 0.001);
        }
    }

    updateTotalsFromLoans() {
        if (this.form.paymentType === 'loan' && this.form.loanComponents?.length) {
            const loansSum = this.form.loanComponents.reduce((s, l) => s + (Number(l.totalLoanAmount) || 0), 0);
            const monthlySum = this.form.loanComponents.reduce((s, l) => s + (Number(l.monthlyPayment) || 0), 0);

            // עדכון אוטומטי רק אם השדה ריק, כדי לאפשר הזנה ידנית של מחיר מוצר מלא
            if (this.form.totalAmount === 0) {
                this.form.totalAmount = loansSum + Number(this.form.downPayment);
            }
            this.form.monthlyPayment = monthlySum;

            // עדכון מספר התשלומים הכולל לפי ההלוואה הארוכה ביותר
            if (this.form.loanComponents.length > 0) {
                this.form.installmentsCount = Math.max(...this.form.loanComponents.map(l => Number(l.installmentsCount) || 0));
            }
        }
    }

    // Opens the dialog to mark a payment as paid (for manual, loans or milestones via generic events)
    markAsPaid(item: Installment, loan?: LoanComponent, milestoneId?: string) {
        if (item.paymentType === 'milestone') {
            // Redirect to milestone-specific dialog to ensure description/percentage are handled
            this.openMarkMilestoneAsPaidDialog(item, milestoneId);
            return;
        }

        this.currentInstallmentToMarkPaid = item;
        this.currentLoanToMarkPaid = loan || null;
        this.currentMilestoneIdToMarkPaid = milestoneId || null;
        this.paymentDateInput = new Date().toISOString().slice(0, 10); // Default to today
        this.showMarkAsPaidDialog = true;
    }

    openMarkMilestoneAsPaidDialog(item: Installment, milestoneId?: string) {
        this.currentInstallmentToMarkPaid = item;
        this.currentLoanToMarkPaid = null; // Not a loan payment for this specific action
        this.paymentDateInput = new Date().toISOString().slice(0, 10); // Default to today's date
        this.currentMilestoneIdToMarkPaid = milestoneId || null; // Store milestoneId, or null for ad-hoc

        // Initialize dialog fields with milestone data
        const milestone = item.milestones?.find(m => m.id === milestoneId);
        if (milestone) {
            this.milestonePercentageInput = milestone.percentage;
            this.milestoneAmountInput = milestone.amount;
            this.milestoneDescriptionInput = milestone.description;
        }
        // For ad-hoc payments, ensure inputs are cleared/defaulted
        if (!milestoneId) {
            this.milestonePercentageInput = 0;
            this.milestoneAmountInput = 0;
            this.milestoneDescriptionInput = ''; // Or a default like 'תשלום פעימה נוסף'
        }

        this.showMarkAsPaidDialog = true;
    }

    onMilestoneDialogPercentageChange() { // Renamed for clarity, was onMilestonePaymentPctChange
        if (!this.currentInstallmentToMarkPaid) return;
        const total = this.currentInstallmentToMarkPaid.totalAmount;
        this.milestoneAmountInput = Math.round(total * (this.milestonePercentageInput / 100));
    }

    confirmMarkAsPaid() {
        if (!this.currentInstallmentToMarkPaid || !this.paymentDateInput) return;

        const milestoneId = this.currentMilestoneIdToMarkPaid;

        if (milestoneId) {
            // Case 1: Marking an existing milestone as paid
            this.svc.markMilestoneAsPaid(
                this.currentInstallmentToMarkPaid,
                milestoneId,
                this.paymentDateInput,
                this.milestoneAmountInput,
                this.milestoneDescriptionInput
            ).subscribe(() => {
                this.onMarkAsPaidSuccess();
            });
        } else if (this.currentInstallmentToMarkPaid.paymentType === 'milestone') {
            // Case 2: Adding an ad-hoc milestone payment (no specific milestoneId provided)
            const newAdHocMilestoneId = Date.now().toString(); // Generate a unique ID for this payment
            this.svc.addAdHocMilestonePayment(
                this.currentInstallmentToMarkPaid,
                newAdHocMilestoneId,
                this.paymentDateInput,
                this.milestoneAmountInput,
                this.milestoneDescriptionInput || 'תשלום פעימה נוסף' // Default description for ad-hoc
            ).subscribe(() => {
                this.translate.get('INSTALLMENTS.MARKED_PAID_SUCCESS')
                    .subscribe(msg => this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-success' }));
                this.cancelMarkAsPaidDialog();
            });
        } else {
            // Existing logic for regular/loan payments
            this.svc.markAsPaid(
                this.currentInstallmentToMarkPaid,
                this.paymentDateInput,
                this.currentLoanToMarkPaid?.id
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
        this.pendingUndoAction = { item, loanId, milestoneId };
    }

    doUndoPayment() {
        if (!this.pendingUndoAction) return;
        const { item, loanId, milestoneId } = this.pendingUndoAction;
        this.pendingUndoAction = null;
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
        this.pendingUndoAction = { item, milestoneId }; // Set pending action for confirmation dialog
    }

    cancelUndoPayment() {
        this.pendingUndoAction = null;
    }

    toggleLoanHistory(loanId: string) {
        this.expandedLoans = {
            ...this.expandedLoans,
            [loanId]: !this.expandedLoans[loanId]
        };
        this.cdr.detectChanges();
    }

    toggleTopHistory(id: string) {
        const key = 'top_' + id;
        this.expandedLoans = {
            ...this.expandedLoans,
            [key]: !this.expandedLoans[key]
        };
        this.cdr.detectChanges();
    }

    // Closes the mark as paid dialog
    cancelMarkAsPaidDialog() {
        this.showMarkAsPaidDialog = false;
        this.currentInstallmentToMarkPaid = null;
        this.currentMilestoneIdToMarkPaid = null; // Clear milestoneId
        this.currentLoanToMarkPaid = null;
        this.milestonePercentageInput = 0;
        this.milestoneAmountInput = 0;
        this.milestoneDescriptionInput = '';
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
        // Ensure loanComponents and milestones are initialized as arrays
        this.form.loanComponents = this.form.loanComponents || [];
        this.form.milestones = this.form.milestones || [];
        this.form.milestonePayments = this.form.milestonePayments || [];

        // Basic validation for name and start date
        const nameValid = !!this.form.name.trim();
        const dateValid = !!this.form.startDate;

        let specificTypeValid = true;
        if (this.form.paymentType === 'manual') {
            const amountsValid = this.form.totalAmount > 0 && (this.form.monthlyPayment > 0 || this.form.installmentsCount > 0);
            const downPaymentValid = this.form.downPayment <= this.form.totalAmount;
            specificTypeValid = amountsValid && downPaymentValid;
        } else if (this.form.paymentType === 'loan') {
            const loansValid = this.form.loanComponents.every(l => l.totalLoanAmount > 0 && l.monthlyPayment > 0 && l.installmentsCount > 0 && !!l.startDate);
            specificTypeValid = loansValid && this.form.loanComponents.length > 0;
        } else if (this.form.paymentType === 'milestone') {
            const milestonesValid = this.form.milestones.every(m => m.amount > 0 && !!m.date);
            specificTypeValid = milestonesValid && this.form.milestones.length > 0;
        }

        return nameValid && dateValid && specificTypeValid;
    }

    amountAfterDown(item: Omit<Installment, 'id'> | Installment): number {
        return Math.max(0, item.totalAmount - item.downPayment);
    }

    submit(ignoreWarnings: boolean = false) {
        // 1. Ensure ID is set for update operations
        if (this.editingId) {
            (this.form as any).id = this.editingId;
        }

        // 2. Type-specific data preparation and numeric conversion
        this.form.totalAmount = Number(this.form.totalAmount) || 0;
        this.form.downPayment = Number(this.form.downPayment) || 0;
        this.form.manualPaidCount = Number(this.form.manualPaidCount) || 0;

        // Clear data for other payment types based on the selected type
        if (this.form.paymentType === 'manual') {
            this.form.loanComponents = [];
            this.form.milestones = [];
            this.form.milestonePayments = [];
            // Ensure monthlyPayment and installmentsCount are consistent for manual type
            const remaining = this.amountAfterDown(this.form);
            if (this.form.installmentsCount === 0 && this.form.monthlyPayment > 0) {
                this.form.installmentsCount = Math.ceil(remaining / this.form.monthlyPayment);
            } else if (this.form.monthlyPayment === 0 && this.form.installmentsCount > 0) {
                this.form.monthlyPayment = Math.round((remaining / this.form.installmentsCount) * 100) / 100;
            }
        } else if (this.form.paymentType === 'loan') {
            this.form.payments = [];
            this.form.milestones = [];
            this.form.milestonePayments = [];
            // Map loan components and recalculate totals
            this.form.loanComponents = (this.form.loanComponents || []).map(loan => ({
                ...loan,
                totalLoanAmount: Number(loan.totalLoanAmount) || 0,
                monthlyPayment: Number(loan.monthlyPayment) || 0,
                installmentsCount: Number(loan.installmentsCount) || 0,
                paidCount: Number(loan.paidCount) || 0,
                interestRate: loan.interestRate !== undefined ? Number(loan.interestRate) : 0,
                payoffAmount: Number(loan.payoffAmount) || 0
            }));
            this.updateTotalsFromLoans();
        } else if (this.form.paymentType === 'milestone') {
            this.form.payments = [];
            this.form.loanComponents = [];
            // Map milestones
            this.form.milestones = (this.form.milestones || []).map(m => ({
                ...m,
                percentage: Number(m.percentage) || 0,
                amount: Number(m.amount) || 0
            }));
            // Calculate installmentsCount based on milestones (duration)
            if (this.form.milestones.length > 0) {
                const start = new Date(this.form.startDate);
                const lastMilestoneDate = new Date(Math.max(...this.form.milestones.map(m => new Date(m.date + '-01').getTime())));
                this.form.installmentsCount = (lastMilestoneDate.getFullYear() - start.getFullYear()) * 12 + (lastMilestoneDate.getMonth() - start.getMonth()) + 1;
            } else {
                this.form.installmentsCount = 0;
            }
            this.form.monthlyPayment = 0; // Milestones don't have a fixed monthly payment
            // totalAmount is user-defined for milestones, so we don't recalculate it here.
        }

        // Milestone payments are always mapped if they exist, regardless of current paymentType
        this.form.milestonePayments = (this.form.milestonePayments || []).map(mp => ({
            ...mp,
            amount: Number(mp.amount) || 0
        }));

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
            ? this.svc.update(this.editingId, this.form as Installment) // Cast to Installment for update
            : this.svc.add(this.form as Omit<Installment, 'id'>); // Cast to Omit<Installment, 'id'> for add

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
