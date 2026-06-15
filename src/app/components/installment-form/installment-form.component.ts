import { Component, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Installment, LoanComponent, Milestone } from '../../models/installment.model';
import { MatIconModule } from '@angular/material/icon';
// import { Installment, LoanComponent, Milestone } from '../../../models/installment.model';

@Component({
  selector: 'app-installment-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MatTooltipModule, MatIconModule],
  templateUrl: './installment-form.component.html',
  styleUrl: './installment-form.component.scss'
})
export class InstallmentFormComponent {
  @Input() showForm: boolean = false;
  @Input() form!: Installment | Omit<Installment, 'id'>;
  @Input() editingId: string | null = null; // Keep this for form title logic
  @Input() COLORS: string[] = [];
  @Input() amountAfterDown!: (item: Omit<Installment, 'id'> | Installment) => number;

  constructor(private cdr: ChangeDetectorRef, private translate: TranslateService) { }

  readonly Math = Math; // Make Math available in template

  /** סה"כ סכום הפעימות שהוגדרו */
  get milestonesTotal(): number {
    return (this.form?.milestones || []).reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  }

  /** האם סכום הפעימות חורג מהסכום הכולל? */
  get isMilestonesTotalExceeded(): boolean {
    return this.form?.paymentType === 'milestone' && this.milestonesTotal > (Number(this.form?.totalAmount) || 0);
  }

  /** היתרה שנותרה לחלוקה לפעימות (יכול להיות שלילי) */
  get milestonesRemaining(): number {
    const total = Number(this.form?.totalAmount) || 0;
    return total - this.milestonesTotal;
  }

  get formValid(): boolean {
    if (!this.form) return false;

    const nameValid = !!this.form.name?.trim();
    const dateValid = !!this.form.startDate;
    const totalAmountValid = (Number(this.form.totalAmount) || 0) > 0;

    return nameValid && dateValid && totalAmountValid && !this.isMilestonesTotalExceeded;
  }

  @Output() closeForm = new EventEmitter<void>();
  @Output() submit = new EventEmitter<void>();
  @Output() updateParentTotals = new EventEmitter<void>();
  @Output() onInstallmentsCountChange = new EventEmitter<void>();
  @Output() addLoanComponent = new EventEmitter<void>();
  @Output() removeLoanComponent = new EventEmitter<number>();
  @Output() calculateLoanPMT = new EventEmitter<LoanComponent>();
  @Output() onPaymentTypeChange = new EventEmitter<void>();
  @Output() calculatePayoffAmount = new EventEmitter<LoanComponent>();
  @Output() onMonthlyPaymentChange = new EventEmitter<void>();
  @Output() addMilestone = new EventEmitter<void>();
  @Output() removeMilestone = new EventEmitter<number>();
  @Output() onMilestonePctChange = new EventEmitter<Milestone>();
  @Output() onMilestoneAmountChange = new EventEmitter<Milestone>();

  // Helper to emit calculateLoanPMT
  emitCalculateLoanPMT(loan: LoanComponent) {
    this.calculateLoanPMT.emit(loan);
    this.updateParentTotals.emit(); // Ensure totals are updated after loan changes
  }

  // Helper to emit calculatePayoffAmount
  emitCalculatePayoffAmount(loan: LoanComponent) {
    this.calculatePayoffAmount.emit(loan);
    this.updateParentTotals.emit(); // Ensure totals are updated after payoff amount changes
  }

  // Helper to emit onMilestonePctChange
  emitOnMilestonePctChange(milestone: Milestone) {
    this.onMilestonePctChange.emit(milestone);
    this.updateParentTotals.emit(); // Ensure totals are updated after milestone changes
  }

  // Helper to emit onMilestoneAmountChange
  emitOnMilestoneAmountChange(milestone: Milestone) {
    this.onMilestoneAmountChange.emit(milestone);
    this.updateParentTotals.emit(); // Ensure totals are updated after milestone changes
  }

  // Helper to emit removeLoanComponent
  emitRemoveLoanComponent(index: number) {
    this.removeLoanComponent.emit(index);
    this.updateParentTotals.emit(); // Ensure totals are updated after loan removal
  }

  // Helper to emit removeMilestone
  emitRemoveMilestone(index: number) {
    this.removeMilestone.emit(index);
    this.updateParentTotals.emit(); // Ensure totals are updated after milestone removal
  }

  // Helper to emit addLoanComponent
  emitAddLoanComponent() {
    this.addLoanComponent.emit();
    this.cdr.detectChanges(); // Force change detection to update the view
    this.updateParentTotals.emit();
  }

  // Helper to emit addMilestone
  emitAddMilestone() {
    this.addMilestone.emit();
    this.cdr.detectChanges(); // Force change detection to update the view
    this.updateParentTotals.emit();
  }

  // Helper to emit onMonthlyPaymentChange
  emitOnMonthlyPaymentChange() {
    this.onMonthlyPaymentChange.emit();
    this.updateParentTotals.emit(); // Recalculate parent totals if monthly payment changes
  }

  // Helper to emit onInstallmentsCountChange
  emitOnInstallmentsCountChange() {
    this.onInstallmentsCountChange.emit();
    this.updateParentTotals.emit(); // Recalculate parent totals if installments count changes
  }

  // Helper to emit updateParentTotals
  emitUpdateParentTotals() {
    this.updateParentTotals.emit();
  }
}