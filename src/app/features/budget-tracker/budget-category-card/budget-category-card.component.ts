import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { CategoryBudget } from '../../../models/budget.model';
import { ExpenseCategoryConfig } from '../../../models/expense-category.model';
import { budgetProgressColor, formatBudgetCurrency } from '../budget-format';

/**
 * One category card of the budget tracker.
 * View mode shows the category's usage; edit mode (when `control` is set) shows the monthly limit input.
 */
@Component({
  selector: 'app-budget-category-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, ReactiveFormsModule, MatCardModule, MatChipsModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule
  ],
  templateUrl: './budget-category-card.component.html',
  styleUrl: './budget-category-card.component.scss'
})
export class BudgetCategoryCardComponent {
  config = input.required<ExpenseCategoryConfig>();
  budget = input<CategoryBudget | null>(null);
  control = input<FormControl<number> | null>(null);

  readonly formatCurrency = formatBudgetCurrency;
  readonly progressColor = budgetProgressColor;
}
