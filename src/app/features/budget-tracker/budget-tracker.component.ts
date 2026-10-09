import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

import { BudgetService } from '../../services/budget.service';
import { MonthlyBudget, CategoryBudget, BudgetSettings } from '../../models/budget.model';
import { ExpenseCategory, getExpenseCategoryConfig, EXPENSE_CATEGORY_CONFIGS } from '../../models/expense-category.model';
import { BudgetSummaryComponent } from './budget-summary/budget-summary.component';
import { BudgetCategoryCardComponent } from './budget-category-card/budget-category-card.component';

@Component({
  selector: 'app-budget-tracker',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    TranslateModule,
    BudgetSummaryComponent,
    BudgetCategoryCardComponent
  ],
  templateUrl: './budget-tracker.component.html',
  styleUrl: './budget-tracker.component.scss'
})
export class BudgetTrackerComponent implements OnInit {
  // Signals
  currentMonth = signal<string>(this.getCurrentMonth());
  monthlyBudget = signal<MonthlyBudget | null>(null);
  budgetSettings = signal<BudgetSettings | null>(null);
  isEditMode = signal(false);
  isLoading = signal(false);

  // Form
  budgetForm!: FormGroup;

  // Computed
  alerts = computed(() => this.budgetService.alerts());

  sortedCategories = computed(() => {
    const budget = this.monthlyBudget();
    if (!budget) return [];

    // מיון לפי אחוז ניצול (הגבוה ביותר ראשון)
    return [...budget.categories].sort((a, b) => b.percentage - a.percentage);
  });

  // Edit mode shows every category; the spent amount comes from the month's budget when present
  categoryBudgetById = computed(() =>
    new Map((this.monthlyBudget()?.categories ?? []).map(c => [c.category, c] as const)));

  categoryConfigs = EXPENSE_CATEGORY_CONFIGS;
  readonly categoryConfig = getExpenseCategoryConfig;

  constructor(
    private budgetService: BudgetService,
    private fb: FormBuilder
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadData();
  }

  private initForm(): void {
    const formControls: any = {};
    EXPENSE_CATEGORY_CONFIGS.forEach(config => {
      formControls[config.id] = [0, [Validators.min(0)]];
    });
    this.budgetForm = this.fb.group(formControls);
  }

  private async loadData(): Promise<void> {
    this.isLoading.set(true);
    try {
      // טעינת הגדרות תקציב
      this.budgetService.loadBudgetSettings().subscribe({
        next: (settings) => {
          this.budgetSettings.set(settings);
          this.budgetForm.patchValue(settings);
        },
        error: () => {
          // אם אין הגדרות, השתמש בברירת מחדל
          const defaultSettings = this.budgetService.getDefaultBudgetSettings();
          this.budgetSettings.set(defaultSettings);
          this.budgetForm.patchValue(defaultSettings);
        }
      });

      // טעינת תקציב חודשי
      this.budgetService.getMonthlyBudget(this.currentMonth()).subscribe({
        next: (budget) => {
          this.monthlyBudget.set(budget);
        },
        error: () => {
          // אם אין נתונים, חשב מקומית
          // TODO: integrate with cash-flow service
        },
        complete: () => {
          this.isLoading.set(false);
        }
      });
    } catch (error) {
      console.error('Failed to load budget data:', error);
      this.isLoading.set(false);
    }
  }

  toggleEditMode(): void {
    if (this.isEditMode()) {
      // שמירה ויציאה ממצב עריכה
      this.saveBudgetSettings();
      this.isEditMode.set(false);
    } else {
      // כניסה למצב עריכה
      this.isEditMode.set(true);
    }
  }

  saveBudgetSettings(): void {
    if (this.budgetForm.valid) {
      const settings = this.budgetForm.value as BudgetSettings;
      this.budgetService.saveBudgetSettings(settings).subscribe({
        next: (saved) => {
          this.budgetSettings.set(saved);
          this.loadData(); // רענון נתונים
        },
        error: (err) => {
          console.error('Failed to save budget settings:', err);
        }
      });
    }
  }

  limitControl(category: ExpenseCategory): FormControl<number> {
    return this.budgetForm.get(category) as FormControl<number>;
  }

  getChipColor(percentage: number): string {
    if (percentage >= 100) return 'warn';
    if (percentage >= 90) return 'accent';
    if (percentage >= 75) return '';
    return 'primary';
  }

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  changeMonth(direction: 'prev' | 'next'): void {
    const [year, month] = this.currentMonth().split('-').map(Number);
    const date = new Date(year, month - 1);

    if (direction === 'prev') {
      date.setMonth(date.getMonth() - 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }

    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    this.currentMonth.set(newMonth);
    this.loadData();
  }

  getMonthDisplay(): string {
    const [year, month] = this.currentMonth().split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });
  }
}
