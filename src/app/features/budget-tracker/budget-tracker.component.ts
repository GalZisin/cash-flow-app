import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

import { BudgetService } from '../../services/budget.service';
import { MonthlyBudget, CategoryBudget, BudgetSettings } from '../../models/budget.model';
import { ExpenseCategory, getExpenseCategoryConfig, EXPENSE_CATEGORY_CONFIGS } from '../../models/expense-category.model';

@Component({
  selector: 'app-budget-tracker',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    TranslateModule
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
  hasAlerts = computed(() => this.alerts().length > 0);

  sortedCategories = computed(() => {
    const budget = this.monthlyBudget();
    if (!budget) return [];

    // מיון לפי אחוז ניצול (הגבוה ביותר ראשון)
    return [...budget.categories].sort((a, b) => b.percentage - a.percentage);
  });

  categoryConfigs = EXPENSE_CATEGORY_CONFIGS;

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

  getCategoryConfig(category: ExpenseCategory) {
    return getExpenseCategoryConfig(category);
  }

  getProgressBarColor(percentage: number): string {
    if (percentage >= 100) return 'warn';
    if (percentage >= 90) return 'accent';
    return 'primary';
  }

  getChipColor(percentage: number): string {
    if (percentage >= 100) return 'warn';
    if (percentage >= 90) return 'accent';
    if (percentage >= 75) return '';
    return 'primary';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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
