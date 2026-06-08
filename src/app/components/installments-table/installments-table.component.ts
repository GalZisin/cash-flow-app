import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Installment, InstallmentStatus, LoanComponent } from '../../models/installment.model';
// import { Installment, InstallmentStatus, LoanComponent } from '../../../models/installment.model';

@Component({
  selector: 'app-installments-table',
  standalone: true,
  imports: [CommonModule, TranslateModule, MatTooltipModule],
  templateUrl: './installments-table.component.html',
  styleUrl: './installments-table.component.scss'
})
export class InstallmentsTableComponent {
  @Input() sortedStatuses: InstallmentStatus[] = [];
  @Input() expandedLoans: Record<string, boolean> = {};
  @Input() sortKey: string = 'endDate';
  @Input() sortDir: 'asc' | 'desc' = 'asc';

  @Output() setSort = new EventEmitter<string>();
  @Output() toggleTopHistory = new EventEmitter<string>();
  @Output() undoPayment = new EventEmitter<{ item: Installment, loanId?: string, milestoneId?: string }>();
  @Output() markAsPaid = new EventEmitter<{ item: Installment, loan?: LoanComponent, milestoneId?: string }>();
  @Output() openEdit = new EventEmitter<Installment>();
  @Output() confirmDelete = new EventEmitter<string>();
  @Output() toggleLoanHistory = new EventEmitter<string>();
  @Output() undoMilestonePayment = new EventEmitter<{ item: Installment, milestoneId: string }>();
  @Output() markMilestoneAsPaid = new EventEmitter<{ item: Installment, milestoneId: string }>();

  constructor() { }

  // Helper to emit markAsPaid for main installment
  markInstallmentAsPaid(item: Installment) {
    this.markAsPaid.emit({ item });
  }
  // Helper to emit markAsPaid for loan components
  markLoanAsPaid(item: Installment, loan: LoanComponent) {
    this.markAsPaid.emit({ item, loan });
  }

  // Helper to emit undoPayment for loan components
  undoLoanPayment(item: Installment, loanId: string) {
    this.undoPayment.emit({ item, loanId });
  }
  
  // Helper to emit undoPayment for main installment
  undoInstallmentPayment(item: Installment) {
    this.undoPayment.emit({ item });
  }
  
  // Helper to emit undoMilestonePayment
  emitUndoMilestonePayment(item: Installment, milestoneId: string) {
    this.undoMilestonePayment.emit({ item, milestoneId });
  }

  // Helper to emit markMilestoneAsPaid
  emitMarkMilestoneAsPaid(item: Installment, milestoneId: string) {
    this.markMilestoneAsPaid.emit({ item, milestoneId });
  }
}