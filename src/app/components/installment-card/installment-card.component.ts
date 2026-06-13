import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Installment, InstallmentStatus, LoanComponent, MilestonePayment } from '../../models/installment.model'; // Updated path
// JsonPipe
@Component({
  selector: 'app-installment-card',
  standalone: true,
  imports: [CommonModule, TranslateModule, MatTooltipModule],
  templateUrl: './installment-card.component.html',
  styleUrl: './installment-card.component.scss'
})
export class InstallmentCardComponent {
  @Input() item!: Installment;
  @Input() st!: InstallmentStatus; // Changed to 'st' as per HTML usage
  @Input() expandedLoans: Record<string, boolean> = {};

  @Output() undoPayment = new EventEmitter<{ item: Installment, loanId?: string }>();
  @Output() markAsPaid = new EventEmitter<{ item: Installment, loan?: LoanComponent, milestoneId?: string }>();
  @Output() openEdit = new EventEmitter<Installment>();
  @Output() confirmDelete = new EventEmitter<string>();
  @Output() toggleTopHistory = new EventEmitter<string>();
  @Output() toggleLoanHistory = new EventEmitter<string>();
  @Output() undoMilestonePayment = new EventEmitter<{ item: Installment, milestoneId: string }>();
  @Output() markMilestoneAsPaid = new EventEmitter<{ item: Installment, milestoneId?: string }>(); // milestoneId is now optional

  constructor() { }

  // Getter למציאת ההלוואה הבאה שטרם שולמה
  get nextUnpaidLoan(): LoanComponent | undefined {
    return this.st?.loanStatuses?.find(ls => !ls.isCompleted)?.loan;
  }

  // Getter לקבלת התשלום האחרון שבוצע
  get lastPayment() {
    const history = this.st?.combinedPaymentHistory;
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  // Helper to emit markAsPaid for main installment
  undoInstallmentPayment(item: Installment) {
    this.undoPayment.emit({ item });
  }

  markInstallmentAsPaid(item: Installment) {
    this.markAsPaid.emit({ item });
  }
  // Helper to emit markAsPaid for loan components
  markLoanAsPaid(item: Installment, loan: LoanComponent) {
    this.markAsPaid.emit({ item, loan });
  }

  // Helper to emit undoMilestonePayment
  emitUndoMilestonePayment(item: Installment, milestoneId: string) {
    this.undoMilestonePayment.emit({ item, milestoneId });
  }

  // Helper to emit markMilestoneAsPaid
  emitMarkMilestoneAsPaid(item: Installment, milestoneId: string) {
    this.markMilestoneAsPaid.emit({ item, milestoneId });
  }

  isMilestonePaid(milestoneId: string): boolean {
    return !!this.st?.milestonePayments?.some(p => p.milestoneId === milestoneId);
  }

  getMilestonePayment(milestoneId: string): MilestonePayment | undefined {
    return this.st?.milestonePayments?.find(p => p.milestoneId === milestoneId);
  }
}