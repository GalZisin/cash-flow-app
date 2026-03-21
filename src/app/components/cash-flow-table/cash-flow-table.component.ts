import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { registerLocaleData } from '@angular/common';
import localeHe from '@angular/common/locales/he';
import { CashFlowService } from '../../services/cash-flow.service';

registerLocaleData(localeHe);

export interface MonthlyCashFlow {
  month: Date;
  startingBalance: number;
  income: number;
  loanPayment: number;
  regularExpenses: { description: string; amount: number }[];
  specialExpenses: number;
  endingBalance?: number;
  expanded?: boolean; // בשביל Expandable row
}

@Component({
  selector: 'app-cash-flow-table',
  imports: [CommonModule, ReactiveFormsModule, MatTableModule, MatButtonModule, MatIconModule, MatInputModule, MatSnackBarModule, MatMenuModule],
  providers: [{ provide: DatePipe, useFactory: () => new DatePipe('he') }, DecimalPipe],
  templateUrl: './cash-flow-table.component.html',
  styleUrl: './cash-flow-table.component.scss'
})
export class CashFlowTableComponent implements OnInit {
  cashFlowForm!: FormGroup;
  dataSource: any[] = [];
  activeRowCtrl: any = null;
  displayedColumns = [
    'rowActions',
    'month',
    'startingBalance',
    'income',
    'mortgagePayment',
    'loanPayment',
    'regularExpenses',
    'specialExpenses',
    'endingBalance',
  ];

  readonly ROW_COLORS = [
    { label: 'אדום', value: '#fee2e2', icon: '🔴' },
    { label: 'צהוב', value: '#fef9c3', icon: '🟡' },
    { label: 'ירוק', value: '#dcfce7', icon: '🟢' },
  ];

  constructor(private fb: FormBuilder, private datePipe: DatePipe, private cashFlowService: CashFlowService, private snackBar: MatSnackBar, private cdr: ChangeDetectorRef) { }

  getExpenseAmount(monthIndex: number, expenseIndex: number): FormControl<number> {
    const control = this.getRegularExpenses(monthIndex)
      .at(expenseIndex)
      .get('amount');

    if (!control) throw new Error('amount control is missing!');
    return control as FormControl<number>;
  }

  getExpenseDescription(monthIndex: number, expenseIndex: number): FormControl<string> {
    const control = this.getRegularExpenses(monthIndex)
      .at(expenseIndex)
      .get('description');

    if (!control) throw new Error('description control is missing!');
    return control as FormControl<string>;
  }

  ngOnInit(): void {
    this.cashFlowForm = this.fb.group({
      months: this.fb.array([]),
    });

    this.cashFlowService.load().subscribe(data => {
      if (data && data.months?.length) {
        data.months.forEach((m: any) => {
          const monthGroup = this.createMonth(new Date(m.month), m.startingBalance ?? 0);
          monthGroup.get('income')?.setValue(m.income ?? 0, { emitEvent: false });
          monthGroup.get('mortgagePayment')?.setValue(m.mortgagePayment ?? 0, { emitEvent: false });
          monthGroup.get('loanPayment')?.setValue(m.loanPayment ?? 0, { emitEvent: false });
          monthGroup.get('expanded')?.setValue(m.regularExpenses?.length > 0, { emitEvent: false });
          monthGroup.get('expandedSpecial')?.setValue(m.specialExpenses?.length > 0, { emitEvent: false });

          m.regularExpenses?.forEach((e: any) =>
            (monthGroup.get('regularExpenses') as FormArray).push(
              this.fb.group({ description: [e.description ?? ''], amount: [e.amount ?? 0] })
            )
          );

          m.specialExpenses?.forEach((e: any) =>
            (monthGroup.get('specialExpenses') as FormArray).push(
              this.fb.group({ description: [e.description ?? ''], amount: [e.amount ?? 0] })
            )
          );

          if (m.rowColor) monthGroup.get('rowColor')?.setValue(m.rowColor, { emitEvent: false });
          this.months.push(monthGroup, { emitEvent: false });
        });
      } else {
        this.months.push(this.createMonth(new Date(2026, 2, 1)), { emitEvent: false });
      }
      this.calculateEndingBalancesOnLoad();
      this.refreshDataSource();
      this.cashFlowForm.updateValueAndValidity();
      this.cdr.detectChanges();
    });
  }

  get months(): FormArray {
    return this.cashFlowForm.get('months') as FormArray;
  }

  createMonth(month: Date, startingBalance: number = 0): FormGroup {
    return this.fb.group({
      month: [month],
      startingBalance: [startingBalance],
      income: [0],
      mortgagePayment: [0],
      loanPayment: [0],
      regularExpenses: this.fb.array([]),
      specialExpenses: this.fb.array([]),
      endingBalance: [startingBalance],
      expanded: [false],
      expandedSpecial: [false],
      rowColor: [null]
    });
  }

  getRegularExpenses(monthIndex: number): FormArray {
    return this.months.at(monthIndex).get('regularExpenses') as FormArray;
  }

  getSpecialExpenses(monthIndex: number): FormArray {
    return this.months.at(monthIndex).get('specialExpenses') as FormArray;
  }

  addRegularExpense(monthIndex: number) {
    this.getRegularExpenses(monthIndex).push(this.fb.group({ description: [''], amount: [0] }));
    this.calculateEndingBalances();
  }

  removeRegularExpense(monthIndex: number, expenseIndex: number) {
    this.getRegularExpenses(monthIndex).removeAt(expenseIndex);
    this.calculateEndingBalances();
  }

  addSpecialExpense(monthIndex: number) {
    this.getSpecialExpenses(monthIndex).push(this.fb.group({ description: [''], amount: [0] }));
    this.calculateEndingBalances();
  }

  removeSpecialExpense(monthIndex: number, expenseIndex: number) {
    this.getSpecialExpenses(monthIndex).removeAt(expenseIndex);
    this.calculateEndingBalances();
  }

  getSpecialExpenseAmount(monthIndex: number, expenseIndex: number): FormControl<number> {
    const control = this.getSpecialExpenses(monthIndex).at(expenseIndex).get('amount');
    if (!control) throw new Error('amount control is missing!');
    return control as FormControl<number>;
  }

  getSpecialExpenseDescription(monthIndex: number, expenseIndex: number): FormControl<string> {
    const control = this.getSpecialExpenses(monthIndex).at(expenseIndex).get('description');
    if (!control) throw new Error('description control is missing!');
    return control as FormControl<string>;
  }

  calculateEndingBalances() {
    let prevEndingBalance = 0;
    this.months.controls.forEach((monthCtrl, i) => {
      const startingBalance = Number(monthCtrl.get('startingBalance')?.value) || 0;
      const income = Number(monthCtrl.get('income')?.value) || 0;
      const mortgage = Number(monthCtrl.get('mortgagePayment')?.value) || 0;
      const loanPayment = Number(monthCtrl.get('loanPayment')?.value) || 0;
      const specialExpenses = (monthCtrl.get('specialExpenses')?.value || []).reduce(
        (sum: number, r: any) => sum + (Number(r.amount) || 0), 0
      );
      const regularExpenses = (monthCtrl.get('regularExpenses')?.value || []).reduce(
        (sum: number, r: any) => sum + (Number(r.amount) || 0), 0
      );

      const totalStarting = i === 0 ? startingBalance : prevEndingBalance;
      const endingBalance = totalStarting + income - mortgage - loanPayment - specialExpenses - regularExpenses;

      if (i > 0) monthCtrl.get('startingBalance')?.setValue(prevEndingBalance, { emitEvent: false });
      monthCtrl.get('endingBalance')?.setValue(endingBalance, { emitEvent: false });
      prevEndingBalance = endingBalance;
    });
    this.cdr.detectChanges();
  }

  calculateEndingBalancesOnLoad() {
    let prevEndingBalance = 0;
    this.months.controls.forEach((monthCtrl, i) => {
      const startingBalance = Number(monthCtrl.get('startingBalance')?.value) || 0;
      const income = Number(monthCtrl.get('income')?.value) || 0;
      const mortgage = Number(monthCtrl.get('mortgagePayment')?.value) || 0;
      const loanPayment = Number(monthCtrl.get('loanPayment')?.value) || 0;
      const specialExpenses = (monthCtrl.get('specialExpenses')?.value || []).reduce(
        (sum: number, r: any) => sum + (Number(r.amount) || 0), 0
      );
      const regularExpenses = (monthCtrl.get('regularExpenses')?.value || []).reduce(
        (sum: number, r: any) => sum + (Number(r.amount) || 0), 0
      );

      const totalStarting = i === 0 ? startingBalance : prevEndingBalance;
      const endingBalance = totalStarting + income - mortgage - loanPayment - specialExpenses - regularExpenses;

      monthCtrl.get('endingBalance')?.setValue(endingBalance, { emitEvent: false });
      prevEndingBalance = endingBalance;
    });
  }

  refreshDataSource() {
    this.dataSource = [...this.months.controls];
  }

  addMonth() {
    const lastCtrl = this.months.at(this.months.length - 1);
    this.calculateEndingBalances();
    const lastMonthDate: Date = lastCtrl.get('month')?.value;
    const nextMonth = new Date(lastMonthDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const lastEndingBalance = lastCtrl.get('endingBalance')?.value || 0;
    this.months.push(this.createMonth(nextMonth, lastEndingBalance));
    this.refreshDataSource();
  }

  save() {
    const data = {
      months: this.months.controls.map(ctrl => ({
        month: ctrl.get('month')?.value,
        startingBalance: ctrl.get('startingBalance')?.value,
        income: ctrl.get('income')?.value,
        mortgagePayment: ctrl.get('mortgagePayment')?.value,
        loanPayment: ctrl.get('loanPayment')?.value,
        regularExpenses: ctrl.get('regularExpenses')?.value,
        specialExpenses: ctrl.get('specialExpenses')?.value,
        endingBalance: ctrl.get('endingBalance')?.value,
        rowColor: ctrl.get('rowColor')?.value,
      }))
    };
    this.cashFlowService.save(data).subscribe({
      next: () => this.snackBar.open('הנתונים נשמרו בהצלחה ✅', '', { duration: 3000, panelClass: 'snack-success' })
    });
  }

  setRowColor(monthCtrl: any, color: string | null) {
    const current = monthCtrl.get('rowColor')?.value;
    const next = current === color ? null : color;
    monthCtrl.get('rowColor')?.setValue(next);
    this.refreshDataSource();
    this.cdr.detectChanges();
  }

  exportPdf() {
    window.print();
  }

}
