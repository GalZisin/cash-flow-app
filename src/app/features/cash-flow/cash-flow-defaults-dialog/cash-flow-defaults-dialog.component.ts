import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CashFlowDefaults, CashFlowService } from '../../../services/cash-flow.service';
import { ExpenseItem, normalizeExpenseItem } from '../../../models/expense.model';
import { ExpenseCategorySelectorComponent } from '../expense-category-selector/expense-category-selector.component';

/**
 * דיאלוג "ברירות מחדל לחודש חדש": הכנסה, משכנתה, הלוואה, הכנסות נוספות והוצאות קבועות/מיוחדות.
 * הקומפוננטה טוענת את ברירות המחדל בעצמה, שומרת אותן ומודיעה להורה בסיום.
 */
@Component({
  selector: 'app-cash-flow-defaults-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TranslateModule,
    MatButtonModule, MatIconModule, MatDividerModule, MatTooltipModule,
    ExpenseCategorySelectorComponent
  ],
  templateUrl: './cash-flow-defaults-dialog.component.html',
  styleUrl: './cash-flow-defaults-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CashFlowDefaultsDialogComponent implements OnInit {
  /** נסגר בלי לשמור (או אחרי שמירה מוצלחת, אחרי האירוע saved). */
  readonly closed = output<void>();
  /** ברירות המחדל שנשמרו בשרת. */
  readonly saved = output<CashFlowDefaults>();

  private readonly fb = inject(FormBuilder);
  private readonly cashFlowService = inject(CashFlowService);
  private readonly translate = inject(TranslateService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);

  form: FormGroup | null = null;
  saving = false;

  ngOnInit(): void {
    this.cashFlowService.loadDefaults().subscribe(defaults => {
      this.form = this.buildForm(defaults);
      this.cdr.markForCheck();
    });
  }

  get additionalIncomes(): FormArray { return this.form!.get('additionalIncomes') as FormArray; }
  get regularExpenses(): FormArray { return this.form!.get('regularExpenses') as FormArray; }
  get specialExpenses(): FormArray { return this.form!.get('specialExpenses') as FormArray; }

  addAdditionalIncome(): void { this.additionalIncomes.push(this.fb.group({ description: [''], amount: [0] })); }
  removeAdditionalIncome(i: number): void { this.additionalIncomes.removeAt(i); }
  addRegularExpense(): void { this.regularExpenses.push(this.createExpenseGroup()); }
  removeRegularExpense(i: number): void { this.regularExpenses.removeAt(i); }
  addSpecialExpense(): void { this.specialExpenses.push(this.createExpenseGroup()); }
  removeSpecialExpense(i: number): void { this.specialExpenses.removeAt(i); }

  close(): void { this.closed.emit(); }

  save(): void {
    if (!this.form || this.saving) return;
    this.saving = true;
    const value = this.form.value as CashFlowDefaults;
    this.cashFlowService.saveDefaults(value).subscribe({
      next: saved => {
        this.saving = false;
        this.translate.get('CASH_FLOW.DEFAULTS_SAVED').subscribe(msg =>
          this.snackBar.open(msg, '', { duration: 2500, panelClass: 'snack-success' })
        );
        this.saved.emit(saved);
        this.closed.emit();
      },
      error: () => { this.saving = false; this.cdr.markForCheck(); }
    });
  }

  private buildForm(defaults: CashFlowDefaults): FormGroup {
    const extra = defaults as CashFlowDefaults & { additionalIncomes?: { description: string; amount: number }[] };
    return this.fb.group({
      income: [defaults.income ?? 0],
      mortgagePayment: [defaults.mortgagePayment ?? 0],
      loanPayment: [defaults.loanPayment ?? 0],
      additionalIncomes: this.fb.array(
        (extra.additionalIncomes ?? []).map(e => this.fb.group({ description: [e.description ?? ''], amount: [e.amount ?? 0] }))
      ),
      regularExpenses: this.fb.array((defaults.regularExpenses ?? []).map(e => this.createExpenseGroup(e))),
      specialExpenses: this.fb.array((defaults.specialExpenses ?? []).map(e => this.createExpenseGroup(e)))
    });
  }

  private createExpenseGroup(expense?: Partial<ExpenseItem>): FormGroup {
    const normalized = normalizeExpenseItem(expense ?? {});
    return this.fb.group({
      description: [normalized.description],
      amount: [normalized.amount],
      category: [normalized.category]
    });
  }
}
