import { ExpenseCategory } from './expense-category.model';

/**
 * תקציב חודשי לקטגוריה
 */
export interface CategoryBudget {
    category: ExpenseCategory;
    monthlyLimit: number;        // סכום תקציב מקסימלי
    spent: number;                // כמה הוצא בפועל
    remaining: number;            // כמה נשאר
    percentage: number;           // אחוז ניצול (0-100+)
    isOverBudget: boolean;        // האם חרג מהתקציב
    overBudgetAmount?: number;    // כמה חרג (אם רלוונטי)
}

/**
 * תקציב חודשי מלא
 */
export interface MonthlyBudget {
    month: string;                // YYYY-MM
    totalBudget: number;          // סך כל התקציב
    totalSpent: number;           // סך כל ההוצאות
    totalRemaining: number;       // סך כל מה שנשאר
    overallPercentage: number;    // אחוז ניצול כללי
    categories: CategoryBudget[]; // תקציב לפי קטגוריה
}

/**
 * הגדרות תקציב ברירת מחדל לחודש
 */
export interface BudgetSettings {
    [ExpenseCategory.FOOD]: number;
    [ExpenseCategory.CAR]: number;
    [ExpenseCategory.HOME]: number;
    [ExpenseCategory.VACATION]: number;
    [ExpenseCategory.ENTERTAINMENT]: number;
    [ExpenseCategory.GIFTS]: number;
    [ExpenseCategory.HEALTH]: number;
    [ExpenseCategory.PROFESSIONAL]: number;
    [ExpenseCategory.INVESTMENTS]: number;
    [ExpenseCategory.EDUCATION]: number;
    [ExpenseCategory.SHOPPING]: number;
    [ExpenseCategory.OTHER]: number;
}

/**
 * התראת חריגה מתקציב
 */
export interface BudgetAlert {
    category: ExpenseCategory;
    month: string;
    budgetLimit: number;
    actualSpent: number;
    overAmount: number;
    percentage: number;
    severity: 'warning' | 'danger'; // warning: 90-100%, danger: >100%
}
