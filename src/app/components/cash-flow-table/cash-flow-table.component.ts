import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { registerLocaleData } from '@angular/common';
import localeHe from '@angular/common/locales/he';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CashFlowService, CashFlowDefaults } from '../../services/cash-flow.service';

registerLocaleData(localeHe);

@Component({
  selector: 'app-cash-flow-table',
  imports: [
    CommonModule, ReactiveFormsModule, TranslateModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatSnackBarModule, MatMenuModule,
    MatDividerModule, MatDialogModule, MatTooltipModule
  ],
  providers: [DecimalPipe],
  templateUrl: './cash-flow-table.component.html',
  styleUrl: './cash-flow-table.component.scss'
})
export class CashFlowTableComponent implements OnInit {
  cashFlowForm!: FormGroup;
  dataSource: any[] = [];
  activeRowCtrl: any = null;
  activeRowIndex = 0;
  focusedField: Record<string, boolean> = {};
  displayedColumns = [
    'rowActions',
    'month',
    'startingBalance',
    'income',
    'additionalIncomes',
    'mortgagePayment',
    'loanPayment',
    'regularExpenses',
    'specialExpenses',
    'visualSummary',
    'endingBalance',
  ];

  readonly ROW_COLORS = [
    { labelKey: 'CASH_FLOW.COLOR_RED', value: '#fee2e2' },
    { labelKey: 'CASH_FLOW.COLOR_YELLOW', value: '#fef9c3' },
    { labelKey: 'CASH_FLOW.COLOR_GREEN', value: '#dcfce7' },
  ];

  constructor(private fb: FormBuilder, private cashFlowService: CashFlowService, private snackBar: MatSnackBar, private cdr: ChangeDetectorRef, private translate: TranslateService) { }

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
          const rawDate = new Date(m.month);
          const monthDate = new Date(rawDate.getUTCFullYear(), rawDate.getUTCMonth(), 1);
          const monthGroup = this.createMonth(monthDate, m.startingBalance ?? 0);
          const isGreen = m.rowColor === '#dcfce7';

          monthGroup.get('income')?.setValue(m.income ?? 0, { emitEvent: false });
          monthGroup.get('mortgagePayment')?.setValue(m.mortgagePayment ?? 0, { emitEvent: false });
          monthGroup.get('loanPayment')?.setValue(m.loanPayment ?? 0, { emitEvent: false });
          monthGroup.get('expanded')?.setValue(!isGreen && m.regularExpenses?.length > 0, { emitEvent: false });
          monthGroup.get('expandedSpecial')?.setValue(!isGreen && m.specialExpenses?.length > 0, { emitEvent: false });
          monthGroup.get('expandedAdditionalIncomes')?.setValue(!isGreen && m.additionalIncomes?.length > 0, { emitEvent: false });

          m.additionalIncomes?.forEach((e: any) =>
            (monthGroup.get('additionalIncomes') as FormArray).push(
              this.fb.group({ description: [e.description ?? ''], amount: [e.amount ?? 0] })
            )
          );

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
      this.calculateEndingBalances(false);
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
      rowColor: [null],
      month: [month],
      startingBalance: [startingBalance],
      income: [0],
      mortgagePayment: [0],
      loanPayment: [0],
      additionalIncomes: this.fb.array([]),
      regularExpenses: this.fb.array([]),
      specialExpenses: this.fb.array([]),
      endingBalance: [startingBalance],
      expanded: [false],
      expandedSpecial: [false],
      expandedAdditionalIncomes: [false]
    });
  }

  getRegularExpenses(monthIndex: number): FormArray {
    return this.months.at(monthIndex).get('regularExpenses') as FormArray;
  }

  getAdditionalIncomes(monthIndex: number): FormArray {
    return this.months.at(monthIndex).get('additionalIncomes') as FormArray;
  }

  getAdditionalIncomesSum(index: number): number {
    return this.getAdditionalIncomes(index).controls.reduce((sum, control) => {
      return sum + (Number(control.get('amount')?.value) || 0);
    }, 0);
  }

  getRegularExpensesSum(index: number): number {
    return this.getRegularExpenses(index).controls.reduce((sum, control) => {
      return sum + (Number(control.get('amount')?.value) || 0);
    }, 0);
  }

  getSpecialExpenses(monthIndex: number): FormArray {
    return this.months.at(monthIndex).get('specialExpenses') as FormArray;
  }

  getSpecialExpensesSum(index: number): number {
    return this.getSpecialExpenses(index).controls.reduce((sum, control) => {
      return sum + (Number(control.get('amount')?.value) || 0);
    }, 0);
  }

  getTotalIncome(index: number): number {
    const month = this.months.at(index);
    return (Number(month.get('income')?.value) || 0) + this.getAdditionalIncomesSum(index);
  }

  getTotalExpenses(index: number): number {
    const month = this.months.at(index);
    return (Number(month.get('mortgagePayment')?.value) || 0) +
      (Number(month.get('loanPayment')?.value) || 0) +
      this.getRegularExpensesSum(index) +
      this.getSpecialExpensesSum(index);
  }

  getBarWidth(value: number, index: number): number {
    const max = Math.max(this.getTotalIncome(index), this.getTotalExpenses(index), 1);
    return (value / max) * 100;
  }

  addRegularExpense(monthIndex: number) {
    this.getRegularExpenses(monthIndex).push(this.fb.group({ description: [''], amount: [0] }));
    this.calculateEndingBalances();
  }

  addAdditionalIncome(monthIndex: number) {
    this.getAdditionalIncomes(monthIndex).push(this.fb.group({ description: [''], amount: [0] }));
    this.calculateEndingBalances();
  }

  removeRegularExpense(monthIndex: number, expenseIndex: number) {
    this.confirmDeleteExpense(monthIndex, expenseIndex, 'regular');
  }

  pendingDeleteExpense: { monthIndex: number; expenseIndex: number; type: 'regular' | 'special' | 'additionalIncome' } | null = null;

  // --- Defaults dialog ---
  showDefaultsDialog = false;
  defaultsForm!: FormGroup;

  openDefaultsDialog() {
    this.cashFlowService.loadDefaults().subscribe(defaults => {
      this.defaultsForm = this.fb.group({
        income: [defaults.income],
        mortgagePayment: [defaults.mortgagePayment],
        loanPayment: [defaults.loanPayment],
        additionalIncomes: this.fb.array(
          (defaults as any).additionalIncomes?.map((e: any) => this.fb.group({ description: [e.description], amount: [e.amount] })) || []
        ),
        regularExpenses: this.fb.array(
          defaults.regularExpenses.map(e => this.fb.group({ description: [e.description], amount: [e.amount] }))
        ),
        specialExpenses: this.fb.array(
          defaults.specialExpenses.map(e => this.fb.group({ description: [e.description], amount: [e.amount] }))
        )
      });
      this.showDefaultsDialog = true;
    });
  }

  closeDefaultsDialog() { this.showDefaultsDialog = false; }

  get defaultsAdditionalIncomes(): FormArray { return this.defaultsForm.get('additionalIncomes') as FormArray; }
  get defaultsRegularExpenses(): FormArray { return this.defaultsForm.get('regularExpenses') as FormArray; }
  get defaultsSpecialExpenses(): FormArray { return this.defaultsForm.get('specialExpenses') as FormArray; }

  addDefaultRegularExpense() {
    this.defaultsRegularExpenses.push(this.fb.group({ description: [''], amount: [0] }));
  }
  removeDefaultRegularExpense(i: number) { this.defaultsRegularExpenses.removeAt(i); }
  addDefaultAdditionalIncome() {
    this.defaultsAdditionalIncomes.push(this.fb.group({ description: [''], amount: [0] }));
  }
  removeDefaultAdditionalIncome(i: number) { this.defaultsAdditionalIncomes.removeAt(i); }
  addDefaultSpecialExpense() {
    this.defaultsSpecialExpenses.push(this.fb.group({ description: [''], amount: [0] }));
  }
  removeDefaultSpecialExpense(i: number) { this.defaultsSpecialExpenses.removeAt(i); }

  saveDefaults() {
    const val = this.defaultsForm.value as CashFlowDefaults;
    this.cashFlowService.saveDefaults(val).subscribe(() => {
      this.translate.get('CASH_FLOW.DEFAULTS_SAVED').subscribe(msg =>
        this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-success' })
      );
      this.showDefaultsDialog = false;
    });
  }

  // --- Duplicate month ---
  duplicateMonth(monthIndex: number) {
    const src = this.months.at(monthIndex);
    const lastCtrl = this.months.at(this.months.length - 1);
    this.calculateEndingBalances();
    const lastMonthDate: Date = lastCtrl.get('month')?.value;
    const nextMonth = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 1);
    const lastEndingBalance = lastCtrl.get('endingBalance')?.value || 0;
    const isGreen = src.get('rowColor')?.value === '#dcfce7';

    const newMonth = this.createMonth(nextMonth, lastEndingBalance);
    newMonth.get('income')?.setValue(src.get('income')?.value, { emitEvent: false });
    newMonth.get('mortgagePayment')?.setValue(src.get('mortgagePayment')?.value, { emitEvent: false });
    newMonth.get('loanPayment')?.setValue(src.get('loanPayment')?.value, { emitEvent: false });

    const srcAddIncome: { description: string; amount: number }[] = src.get('additionalIncomes')?.value || [];
    srcAddIncome.forEach(e =>
      (newMonth.get('additionalIncomes') as FormArray).push(
        this.fb.group({ description: [e.description], amount: [e.amount] })
      )
    );
    if (!isGreen && srcAddIncome.length > 0) newMonth.get('expandedAdditionalIncomes')?.setValue(true, { emitEvent: false });

    const srcRegular: { description: string; amount: number }[] = src.get('regularExpenses')?.value || [];
    srcRegular.forEach(e =>
      (newMonth.get('regularExpenses') as FormArray).push(
        this.fb.group({ description: [e.description], amount: [e.amount] })
      )
    );
    if (!isGreen && srcRegular.length > 0) newMonth.get('expanded')?.setValue(true, { emitEvent: false });

    const srcSpecial: { description: string; amount: number }[] = src.get('specialExpenses')?.value || [];
    srcSpecial.forEach(e =>
      (newMonth.get('specialExpenses') as FormArray).push(
        this.fb.group({ description: [e.description], amount: [e.amount] })
      )
    );
    if (!isGreen && srcSpecial.length > 0) newMonth.get('expandedSpecial')?.setValue(true, { emitEvent: false });

    this.months.push(newMonth);
    this.calculateEndingBalances();
    this.refreshDataSource();
  }

  confirmDeleteExpense(monthIndex: number, expenseIndex: number, type: 'regular' | 'special' | 'additionalIncome') {
    this.pendingDeleteExpense = { monthIndex, expenseIndex, type };
  }

  doDeleteExpense() {
    if (!this.pendingDeleteExpense) return;
    const { monthIndex, expenseIndex, type } = this.pendingDeleteExpense;
    if (type === 'regular') {
      this.getRegularExpenses(monthIndex).removeAt(expenseIndex);
    } else if (type === 'additionalIncome') {
      this.getAdditionalIncomes(monthIndex).removeAt(expenseIndex);
    } else {
      this.getSpecialExpenses(monthIndex).removeAt(expenseIndex);
    }
    this.calculateEndingBalances();
    this.pendingDeleteExpense = null;
  }

  cancelDeleteExpense() {
    this.pendingDeleteExpense = null;
  }

  addSpecialExpense(monthIndex: number) {
    this.getSpecialExpenses(monthIndex).push(this.fb.group({ description: [''], amount: [0] }));
    this.calculateEndingBalances();
  }

  removeSpecialExpense(monthIndex: number, expenseIndex: number) {
    this.confirmDeleteExpense(monthIndex, expenseIndex, 'special');
  }

  getAdditionalIncomeAmount(monthIndex: number, expenseIndex: number): FormControl<number> {
    const control = this.getAdditionalIncomes(monthIndex).at(expenseIndex).get('amount');
    if (!control) throw new Error('amount control is missing!');
    return control as FormControl<number>;
  }

  getAdditionalIncomeDescription(monthIndex: number, expenseIndex: number): FormControl<string> {
    const control = this.getAdditionalIncomes(monthIndex).at(expenseIndex).get('description');
    if (!control) throw new Error('description control is missing!');
    return control as FormControl<string>;
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

  /**
   * Recalculates ending balances for all months in sequence.
   * @param updateStartingBalances When true (default), also propagates each month's
   *   ending balance as the next month's starting balance. Pass false on initial load
   *   to preserve the starting balances that were saved to the server.
   */
  calculateEndingBalances(updateStartingBalances = true) {
    let prevEndingBalance = 0;
    this.months.controls.forEach((monthCtrl, i) => {
      const startingBalance = Number(monthCtrl.get('startingBalance')?.value) || 0;
      const income = Number(monthCtrl.get('income')?.value) || 0;
      const mortgage = Number(monthCtrl.get('mortgagePayment')?.value) || 0;
      const loanPayment = Number(monthCtrl.get('loanPayment')?.value) || 0;
      const additionalIncomes = (monthCtrl.get('additionalIncomes')?.value || []).reduce(
        (sum: number, r: any) => sum + (Number(r.amount) || 0), 0
      );
      const specialExpenses = (monthCtrl.get('specialExpenses')?.value || []).reduce(
        (sum: number, r: any) => sum + (Number(r.amount) || 0), 0
      );
      const regularExpenses = (monthCtrl.get('regularExpenses')?.value || []).reduce(
        (sum: number, r: any) => sum + (Number(r.amount) || 0), 0
      );

      const totalStarting = i === 0 ? startingBalance : prevEndingBalance;
      const endingBalance = totalStarting + income + additionalIncomes - mortgage - loanPayment - specialExpenses - regularExpenses;

      if (updateStartingBalances && i > 0) {
        monthCtrl.get('startingBalance')?.setValue(prevEndingBalance, { emitEvent: false });
      }
      monthCtrl.get('endingBalance')?.setValue(endingBalance, { emitEvent: false });
      prevEndingBalance = endingBalance;
    });
    this.cdr.detectChanges();
  }

  refreshDataSource() {
    this.dataSource = [...this.months.controls];
  }

  addMonth() {
    const lastCtrl = this.months.at(this.months.length - 1);
    this.calculateEndingBalances();
    const lastMonthDate: Date = lastCtrl.get('month')?.value;
    const nextMonth = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 1);
    const lastEndingBalance = lastCtrl.get('endingBalance')?.value || 0;

    this.cashFlowService.loadDefaults().subscribe(defaults => {
      const newMonth = this.createMonth(nextMonth, lastEndingBalance);
      newMonth.get('income')?.setValue(defaults.income, { emitEvent: false });
      newMonth.get('mortgagePayment')?.setValue(defaults.mortgagePayment, { emitEvent: false });
      newMonth.get('loanPayment')?.setValue(defaults.loanPayment, { emitEvent: false });

      (defaults as any).additionalIncomes?.forEach((e: any) =>
        (newMonth.get('additionalIncomes') as FormArray).push(
          this.fb.group({ description: [e.description], amount: [e.amount] })
        )
      );
      if ((defaults as any).additionalIncomes?.length > 0) newMonth.get('expandedAdditionalIncomes')?.setValue(true, { emitEvent: false });

      defaults.regularExpenses.forEach(e =>
        (newMonth.get('regularExpenses') as FormArray).push(
          this.fb.group({ description: [e.description], amount: [e.amount] })
        )
      );
      if (defaults.regularExpenses.length > 0) newMonth.get('expanded')?.setValue(true, { emitEvent: false });

      defaults.specialExpenses.forEach(e =>
        (newMonth.get('specialExpenses') as FormArray).push(
          this.fb.group({ description: [e.description], amount: [e.amount] })
        )
      );
      if (defaults.specialExpenses.length > 0) newMonth.get('expandedSpecial')?.setValue(true, { emitEvent: false });

      this.months.push(newMonth);
      this.calculateEndingBalances();
      this.refreshDataSource();
    });
  }

  toMonthString(date: Date): string {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`;
  }

  save() {
    const data = {
      months: this.months.controls.map(ctrl => ({
        rowColor: ctrl.get('rowColor')?.value,
        month: this.toMonthString(ctrl.get('month')?.value),
        startingBalance: ctrl.get('startingBalance')?.value,
        income: ctrl.get('income')?.value,
        mortgagePayment: ctrl.get('mortgagePayment')?.value,
        loanPayment: ctrl.get('loanPayment')?.value,
        additionalIncomes: ctrl.get('additionalIncomes')?.value,
        regularExpenses: ctrl.get('regularExpenses')?.value,
        specialExpenses: ctrl.get('specialExpenses')?.value,
        endingBalance: ctrl.get('endingBalance')?.value
      }))
    };
    this.cashFlowService.save(data).subscribe({
      next: () => this.translate.get('CASH_FLOW.SAVED_SUCCESS').subscribe(msg =>
        this.snackBar.open(msg, '', { duration: 3000, panelClass: 'snack-success' })
      )
    });
  }

  setRowColor(monthCtrl: any, color: string | null) {
    const current = monthCtrl.get('rowColor')?.value;
    const next = current === color ? null : color;
    monthCtrl.get('rowColor')?.setValue(next);

    // אם נבחר צבע ירוק, נצמצם את הכל אוטומטית
    if (next === '#dcfce7') {
      monthCtrl.get('expanded')?.setValue(false);
      monthCtrl.get('expandedSpecial')?.setValue(false);
      monthCtrl.get('expandedAdditionalIncomes')?.setValue(false);
    }

    this.refreshDataSource();
    this.cdr.detectChanges();
  }

  focusField(key: string) { this.focusedField[key] = true; }
  blurField(key: string) { this.focusedField[key] = false; }

  print() {
    window.print();
  }

}
