import { ExpenseCategory, getExpenseCategoryConfig } from '../models/expense-category.model';
import { ExpenseItem, normalizeExpenseItem } from '../models/expense.model';

export interface MonthExpensesSource {
  regularExpenses?: Partial<ExpenseItem>[];
  specialExpenses?: Partial<ExpenseItem>[];
}

export interface CategoryTotal {
  category: ExpenseCategory;
  total: number;
}

export interface CategoryPercentage extends CategoryTotal {
  percentage: number;
}

export interface PieChartSlice {
  name: string;
  value: number;
  color: string;
}

export function getAllExpenses(months: MonthExpensesSource[]): ExpenseItem[] {
  return months.flatMap(month => [
    ...(month.regularExpenses ?? []).map(normalizeExpenseItem),
    ...(month.specialExpenses ?? []).map(normalizeExpenseItem),
  ]);
}

export function getExpensesByCategory(months: MonthExpensesSource[]): CategoryTotal[] {
  const totals = new Map<ExpenseCategory, number>();

  for (const expense of getAllExpenses(months)) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  }

  return Array.from(totals.entries())
    .map(([category, total]) => ({ category, total }))
    .filter(item => item.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function calculateCategoryTotals(months: MonthExpensesSource[]): CategoryTotal[] {
  return getExpensesByCategory(months);
}

export function calculateCategoryPercentages(months: MonthExpensesSource[]): CategoryPercentage[] {
  const totals = getExpensesByCategory(months);
  const grandTotal = totals.reduce((sum, item) => sum + item.total, 0);

  if (grandTotal === 0) {
    return [];
  }

  return totals.map(item => ({
    ...item,
    percentage: (item.total / grandTotal) * 100,
  }));
}

export function buildPieChartData(months: MonthExpensesSource[]): PieChartSlice[] {
  return getExpensesByCategory(months).map(({ category, total }) => {
    const config = getExpenseCategoryConfig(category);
    return {
      name: config.label,
      value: total,
      color: config.color,
    };
  });
}
