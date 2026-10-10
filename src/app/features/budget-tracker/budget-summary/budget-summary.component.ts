import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { BudgetAlert, MonthlyBudget } from '../../../models/budget.model';
import { getExpenseCategoryConfig } from '../../../models/expense-category.model';
import { budgetProgressColor, formatBudgetCurrency } from '../budget-format';

/** Left column of the budget tracker: alerts, summary cards and overall progress. */
@Component({
  selector: 'app-budget-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatCardModule, MatIconModule, MatProgressBarModule],
  templateUrl: './budget-summary.component.html',
  styleUrl: './budget-summary.component.scss'
})
export class BudgetSummaryComponent {
  budget = input<MonthlyBudget | null>(null);
  alerts = input<BudgetAlert[]>([]);

  readonly categoryConfig = getExpenseCategoryConfig;
  readonly formatCurrency = formatBudgetCurrency;
  readonly progressColor = budgetProgressColor;
}
