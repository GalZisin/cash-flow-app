import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  EXPENSE_CATEGORY_CONFIGS,
  ExpenseCategory,
  ExpenseCategoryConfig,
  getExpenseCategoryConfig,
} from '../../models/expense-category.model';

@Component({
  selector: 'app-expense-category-selector',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './expense-category-selector.component.html',
  styleUrl: './expense-category-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseCategorySelectorComponent {
  readonly selectedCategory = input<ExpenseCategory>(ExpenseCategory.OTHER);
  readonly selectedCategoryChange = output<ExpenseCategory>();

  readonly categories: ExpenseCategoryConfig[] = EXPENSE_CATEGORY_CONFIGS;
  readonly isExpanded = signal(false);

  get selectedConfig(): ExpenseCategoryConfig {
    return getExpenseCategoryConfig(this.selectedCategory());
  }

  toggleExpanded(): void {
    this.isExpanded.update(v => !v);
  }

  select(category: ExpenseCategory): void {
    if (category !== this.selectedCategory()) {
      this.selectedCategoryChange.emit(category);
    }
  }
}
