import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CashFlowWarning, Installment } from '../../models/installment.model';
// import { CashFlowWarning, Installment, LoanComponent } from '../../../models/installment.model';

@Component({
  selector: 'app-installment-confirm-dialogs',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './installment-confirm-dialogs.component.html',
  styleUrl: './installment-confirm-dialogs.component.scss'
})
export class InstallmentConfirmDialogsComponent {
  @Input() pendingDeleteId: string | null = null;
  @Input() pendingUndoAction: { item: Installment, loanId?: string, milestoneId?: string } | null = null;
  @Input() pendingWarnings: CashFlowWarning[] | null = null;
  @Input() showMarkAsPaidDialog: boolean = false;
  @Input() paymentDateInput: string = '';
  @Input() milestonePercentageInput: number = 0;
  @Input() milestoneAmountInput: number = 0;
  @Input() milestoneDescriptionInput: string = '';

  @Output() doDelete = new EventEmitter<void>();
  @Output() cancelDelete = new EventEmitter<void>();
  @Output() doUndoPayment = new EventEmitter<void>();
  @Output() cancelUndoPayment = new EventEmitter<void>();
  @Output() confirmWarnings = new EventEmitter<void>();
  @Output() cancelWarnings = new EventEmitter<void>();
  @Output() cancelMarkAsPaidDialog = new EventEmitter<void>();
  @Output() confirmMarkAsPaid = new EventEmitter<void>();
  @Output() paymentDateInputChange = new EventEmitter<string>();
  @Output() milestonePercentageInputChange = new EventEmitter<number>();
  @Output() milestoneAmountInputChange = new EventEmitter<number>();
  @Output() milestoneDescriptionInputChange = new EventEmitter<string>();

  constructor() { }

  onPaymentDateInputChange(value: string) {
    this.paymentDateInput = value;
    this.paymentDateInputChange.emit(value);
  }

  onMilestonePercentageInputChange(value: number) {
    this.milestonePercentageInput = value;
    this.milestonePercentageInputChange.emit(value);
  }

  onMilestoneAmountInputChange(value: number) {
    this.milestoneAmountInput = value;
    this.milestoneAmountInputChange.emit(value);
  }

  onMilestoneDescriptionInputChange(value: string) {
    this.milestoneDescriptionInput = value;
    this.milestoneDescriptionInputChange.emit(value);
  }

  // Helper to access item name for undo dialog
  get undoItemName(): string {
    return this.pendingUndoAction?.item?.name || '';
  }
}