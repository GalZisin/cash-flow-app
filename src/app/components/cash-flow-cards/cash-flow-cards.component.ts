import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormArray, FormControl } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatInputModule } from '@angular/material/input';
import { InstallmentService } from '../../services/installment.service';
import { ExpenseCategorySelectorComponent } from '../expense-category-selector/expense-category-selector.component';

@Component({
  selector: 'app-cash-flow-cards',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TranslateModule,
    MatButtonModule, MatIconModule, MatTooltipModule, MatMenuModule, MatInputModule,
    ExpenseCategorySelectorComponent
  ],
  providers: [DecimalPipe],
  templateUrl: './cash-flow-cards.component.html',
  styleUrl: './cash-flow-cards.component.scss'
})
export class CashFlowCardsComponent {
  @Input({ required: true }) months!: FormArray;
  @Input() focusedField: Record<string, boolean> = {};

  @Output() calculate = new EventEmitter<void>();
  @Output() duplicate = new EventEmitter<number>();
  @Output() deleteExpense = new EventEmitter<{ monthIndex: number, expenseIndex: number, type: string }>();
  @Output() addExpense = new EventEmitter<{ monthIndex: number, type: string }>();
  @Output() colorRow = new EventEmitter<{ monthCtrl: any, index: number }>();
  @Output() loanChange = new EventEmitter<number>();

  private installmentService = inject(InstallmentService);
  private decimalPipe = inject(DecimalPipe);

  focusField(key: string) {
    this.focusedField[key] = true;
    setTimeout(() => {
      const el = document.querySelector(`input[data-focus-key="${key}"]`) as HTMLInputElement;
      if (el) el.focus();
    }, 0);
  }

  blurField(key: string) { this.focusedField[key] = false; }

  getInstallmentTooltip(monthIndex: number, type: 'installments' | 'loans'): string {
    const monthCtrl = this.months.at(monthIndex);
    const dateValue = monthCtrl.get('month')?.value;
    if (!dateValue) return '';
    const breakdown = this.installmentService.getMonthlyBreakdownForMonth(new Date(dateValue), this.installmentService.items());
    const relevant = breakdown.filter(b => type === 'loans' ? b.isLoan : !b.isLoan);
    return relevant.map(r => `${r.name}: ${this.decimalPipe.transform(r.amount, '1.0-0')} ₪`).join('\n');
  }

  getAdditionalIncomes(index: number) { return this.months.at(index).get('additionalIncomes') as FormArray; }
  getRegularExpenses(index: number) { return this.months.at(index).get('regularExpenses') as FormArray; }
  getSpecialExpenses(index: number) { return this.months.at(index).get('specialExpenses') as FormArray; }

  getSum(array: FormArray): number {
    return array.controls.reduce((sum, ctrl) => sum + (Number(ctrl.get('amount')?.value) || 0), 0);
  }

  getTotalIncome(i: number): number {
    return (Number(this.months.at(i).get('income')?.value) || 0) + this.getSum(this.getAdditionalIncomes(i));
  }

  getTotalExpenses(i: number): number {
    const m = this.months.at(i);
    return (Number(m.get('mortgagePayment')?.value) || 0) +
      (Number(m.get('loanPayment')?.value) || 0) +
      (Number(m.get('installmentsPayment')?.value) || 0) +
      this.getSum(this.getRegularExpenses(i)) +
      this.getSum(this.getSpecialExpenses(i));
  }

  getBarWidth(value: number, i: number): number {
    const max = Math.max(this.getTotalIncome(i), this.getTotalExpenses(i), 1);
    return (value / max) * 100;
  }
}
