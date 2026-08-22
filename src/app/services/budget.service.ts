import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
    MonthlyBudget,
    CategoryBudget,
    BudgetSettings,
    BudgetAlert
} from '../models/budget.model';
import { ExpenseCategory, EXPENSE_CATEGORY_CONFIGS } from '../models/expense-category.model';

@Injectable({
    providedIn: 'root'
})
export class BudgetService {
    private readonly apiUrl = `${environment.apiUrl}/budget`;

    // Signals
    private budgetSettings = signal<BudgetSettings | null>(null);
    private currentMonthBudget = signal<MonthlyBudget | null>(null);

    // Computed
    readonly alerts = computed(() => this.calculateAlerts());
    readonly hasOverBudgetCategories = computed(() =>
        this.alerts().some(alert => alert.severity === 'danger')
    );

    constructor(private http: HttpClient) { }

    /**
     * טעינת הגדרות תקציב
     */
    loadBudgetSettings(): Observable<BudgetSettings> {
        return this.http.get<BudgetSettings>(`${this.apiUrl}/settings`).pipe(
            map(settings => {
                this.budgetSettings.set(settings);
                return settings;
            })
        );
    }

    /**
     * שמירת הגדרות תקציב
     */
    saveBudgetSettings(settings: BudgetSettings): Observable<BudgetSettings> {
        return this.http.post<BudgetSettings>(`${this.apiUrl}/settings`, settings).pipe(
            map(saved => {
                this.budgetSettings.set(saved);
                return saved;
            })
        );
    }

    /**
     * קבלת תקציב לחודש ספציפי
     */
    getMonthlyBudget(month: string): Observable<MonthlyBudget> {
        return this.http.get<MonthlyBudget>(`${this.apiUrl}/monthly/${month}`).pipe(
            map(budget => {
                this.currentMonthBudget.set(budget);
                return budget;
            })
        );
    }

    /**
     * חישוב תקציב עבור חודש מנתוני תזרים
     */
    calculateMonthlyBudget(
        month: string,
        expenses: Array<{ category?: ExpenseCategory; amount: number }>,
        budgetSettings: BudgetSettings
    ): MonthlyBudget {
        // חישוב הוצאות לפי קטגוריה
        const spentByCategory = new Map<ExpenseCategory, number>();

        expenses.forEach(expense => {
            const category = expense.category || ExpenseCategory.OTHER;
            const current = spentByCategory.get(category) || 0;
            spentByCategory.set(category, current + expense.amount);
        });

        // יצירת CategoryBudget לכל קטגוריה
        const categories: CategoryBudget[] = EXPENSE_CATEGORY_CONFIGS.map(config => {
            const category = config.id;
            const monthlyLimit = budgetSettings[category] || 0;
            const spent = spentByCategory.get(category) || 0;
            const remaining = monthlyLimit - spent;
            const percentage = monthlyLimit > 0 ? (spent / monthlyLimit) * 100 : 0;
            const isOverBudget = spent > monthlyLimit && monthlyLimit > 0;
            const overBudgetAmount = isOverBudget ? spent - monthlyLimit : undefined;

            return {
                category,
                monthlyLimit,
                spent,
                remaining,
                percentage,
                isOverBudget,
                overBudgetAmount
            };
        });

        // חישוב סיכומים
        const totalBudget = Object.values(budgetSettings).reduce((sum, val) => sum + val, 0);
        const totalSpent = Array.from(spentByCategory.values()).reduce((sum, val) => sum + val, 0);
        const totalRemaining = totalBudget - totalSpent;
        const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

        return {
            month,
            totalBudget,
            totalSpent,
            totalRemaining,
            overallPercentage,
            categories: categories.filter(c => c.monthlyLimit > 0 || c.spent > 0) // רק קטגוריות רלוונטיות
        };
    }

    /**
     * חישוב התראות
     */
    private calculateAlerts(): BudgetAlert[] {
        const budget = this.currentMonthBudget();
        if (!budget) return [];

        return budget.categories
            .filter(cat => cat.isOverBudget || cat.percentage >= 90)
            .map(cat => ({
                category: cat.category,
                month: budget.month,
                budgetLimit: cat.monthlyLimit,
                actualSpent: cat.spent,
                overAmount: cat.overBudgetAmount || 0,
                percentage: cat.percentage,
                severity: cat.isOverBudget ? 'danger' : 'warning'
            }));
    }

    /**
     * קבלת הגדרות תקציב ברירת מחדל
     */
    getDefaultBudgetSettings(): BudgetSettings {
        return {
            [ExpenseCategory.FOOD]: 3000,
            [ExpenseCategory.CAR]: 1500,
            [ExpenseCategory.HOME]: 2000,
            [ExpenseCategory.VACATION]: 1000,
            [ExpenseCategory.ENTERTAINMENT]: 800,
            [ExpenseCategory.GIFTS]: 500,
            [ExpenseCategory.HEALTH]: 600,
            [ExpenseCategory.PROFESSIONAL]: 400,
            [ExpenseCategory.INVESTMENTS]: 2000,
            [ExpenseCategory.EDUCATION]: 500,
            [ExpenseCategory.SHOPPING]: 1000,
            [ExpenseCategory.OTHER]: 500
        };
    }

    /**
     * חישוב מגמה (Trend) - ממוצע 3 חודשים אחרונים
     */
    calculateTrend(
        category: ExpenseCategory,
        recentMonths: MonthlyBudget[]
    ): { average: number; trend: 'up' | 'down' | 'stable' } {
        const spentAmounts = recentMonths
            .map(month => month.categories.find(c => c.category === category)?.spent || 0)
            .slice(0, 3); // 3 חודשים אחרונים

        if (spentAmounts.length === 0) {
            return { average: 0, trend: 'stable' };
        }

        const average = spentAmounts.reduce((sum, val) => sum + val, 0) / spentAmounts.length;

        // השוואה לחודש הנוכחי
        const current = spentAmounts[0] || 0;
        const diff = current - average;
        const threshold = average * 0.1; // 10% סטייה

        let trend: 'up' | 'down' | 'stable';
        if (diff > threshold) {
            trend = 'up';
        } else if (diff < -threshold) {
            trend = 'down';
        } else {
            trend = 'stable';
        }

        return { average, trend };
    }
}
