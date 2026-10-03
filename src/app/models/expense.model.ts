import { ExpenseCategory, normalizeExpenseCategory } from './expense-category.model';

export interface ExpenseItem {
  description: string;
  amount: number;
  category: ExpenseCategory;
  goalRelated?: boolean;  // סימון שההוצאה הזו נוספה מיעד
  goalId?: string;        // ID של היעד שהוסיף את ההוצאה
}

export function normalizeExpenseItem(item: Partial<ExpenseItem>): ExpenseItem {
  return {
    description: item.description ?? '',
    amount: Number(item.amount) || 0,
    category: normalizeExpenseCategory(item.category),
  };
}
