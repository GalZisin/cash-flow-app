import { ExpenseCategory, normalizeExpenseCategory } from './expense-category.model';

export interface ExpenseItem {
  description: string;
  amount: number;
  category: ExpenseCategory;
}

export function normalizeExpenseItem(item: Partial<ExpenseItem>): ExpenseItem {
  return {
    description: item.description ?? '',
    amount: Number(item.amount) || 0,
    category: normalizeExpenseCategory(item.category),
  };
}
