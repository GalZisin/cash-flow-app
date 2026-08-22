const budgetRepository = require('../repositories/budget.repository');
const cashFlowRepository = require('../repositories/cashFlow.repository');
const { ValidationError } = require('../utils/errors');

/**
 * Service for budget tracking business logic
 */
class BudgetService {
    /**
     * קבלת הגדרות תקציב
     */
    async getBudgetSettings() {
        let settings = await budgetRepository.readSettings();

        // אם אין הגדרות, החזר ברירת מחדל
        if (!settings) {
            settings = this.getDefaultSettings();
        }

        return settings;
    }

    /**
     * שמירת הגדרות תקציב
     */
    async saveBudgetSettings(settings) {
        // Validation
        this.validateSettings(settings);

        // שמירה
        await budgetRepository.writeSettings(settings);

        return settings;
    }

    /**
     * חישוב תקציב חודשי
     */
    async getMonthlyBudget(month) {
        // קבלת הגדרות תקציב
        const settings = await this.getBudgetSettings();

        // קבלת נתוני תזרים לחודש
        const cashFlowData = await cashFlowRepository.read();

        if (!cashFlowData || !cashFlowData.months) {
            return this.getEmptyBudget(month, settings);
        }

        // מציאת החודש הספציפי
        const monthData = cashFlowData.months.find(m => m.month?.startsWith(month));

        if (!monthData) {
            return this.getEmptyBudget(month, settings);
        }

        // חישוב הוצאות לפי קטגוריה
        const spentByCategory = this.calculateSpentByCategory(monthData);

        // בניית תקציב חודשי
        return this.buildMonthlyBudget(month, settings, spentByCategory);
    }

    /**
     * קבלת התראות לחודש
     */
    async getAlerts(month) {
        const monthlyBudget = await this.getMonthlyBudget(month);

        return monthlyBudget.categories
            .filter(cat => cat.isOverBudget || cat.percentage >= 90)
            .map(cat => ({
                category: cat.category,
                month: monthlyBudget.month,
                budgetLimit: cat.monthlyLimit,
                actualSpent: cat.spent,
                overAmount: cat.overBudgetAmount || 0,
                percentage: cat.percentage,
                severity: cat.isOverBudget ? 'danger' : 'warning'
            }));
    }

    /**
     * חישוב הוצאות לפי קטגוריה מנתוני חודש
     */
    calculateSpentByCategory(monthData) {
        const spentByCategory = {};

        // הוצאות קבועות
        if (monthData.regularExpenses) {
            monthData.regularExpenses.forEach(expense => {
                const category = expense.category || 'OTHER';
                spentByCategory[category] = (spentByCategory[category] || 0) + (expense.amount || 0);
            });
        }

        // הוצאות מיוחדות
        if (monthData.specialExpenses) {
            monthData.specialExpenses.forEach(expense => {
                const category = expense.category || 'OTHER';
                spentByCategory[category] = (spentByCategory[category] || 0) + (expense.amount || 0);
            });
        }

        return spentByCategory;
    }

    /**
     * בניית אובייקט תקציב חודשי
     */
    buildMonthlyBudget(month, settings, spentByCategory) {
        const categories = [];
        let totalBudget = 0;
        let totalSpent = 0;

        // בניית תקציב לכל קטגוריה
        Object.keys(settings).forEach(category => {
            const monthlyLimit = settings[category] || 0;
            const spent = spentByCategory[category] || 0;
            const remaining = monthlyLimit - spent;
            const percentage = monthlyLimit > 0 ? (spent / monthlyLimit) * 100 : 0;
            const isOverBudget = spent > monthlyLimit && monthlyLimit > 0;
            const overBudgetAmount = isOverBudget ? spent - monthlyLimit : undefined;

            totalBudget += monthlyLimit;
            totalSpent += spent;

            // רק קטגוריות עם תקציב או הוצאות
            if (monthlyLimit > 0 || spent > 0) {
                categories.push({
                    category,
                    monthlyLimit,
                    spent,
                    remaining,
                    percentage,
                    isOverBudget,
                    overBudgetAmount
                });
            }
        });

        const totalRemaining = totalBudget - totalSpent;
        const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

        return {
            month,
            totalBudget,
            totalSpent,
            totalRemaining,
            overallPercentage,
            categories
        };
    }

    /**
     * תקציב ריק
     */
    getEmptyBudget(month, settings) {
        const totalBudget = Object.values(settings).reduce((sum, val) => sum + val, 0);

        return {
            month,
            totalBudget,
            totalSpent: 0,
            totalRemaining: totalBudget,
            overallPercentage: 0,
            categories: Object.keys(settings).map(category => ({
                category,
                monthlyLimit: settings[category],
                spent: 0,
                remaining: settings[category],
                percentage: 0,
                isOverBudget: false
            })).filter(c => c.monthlyLimit > 0)
        };
    }

    /**
     * ברירת מחדל להגדרות תקציב
     */
    getDefaultSettings() {
        return {
            FOOD: 3000,
            CAR: 1500,
            HOME: 2000,
            VACATION: 1000,
            ENTERTAINMENT: 800,
            GIFTS: 500,
            HEALTH: 600,
            PROFESSIONAL: 400,
            INVESTMENTS: 2000,
            EDUCATION: 500,
            SHOPPING: 1000,
            OTHER: 500
        };
    }

    /**
     * Validation של הגדרות
     */
    validateSettings(settings) {
        if (!settings || typeof settings !== 'object') {
            throw new ValidationError('Invalid settings object');
        }

        // בדיקה שכל הערכים חיוביים
        Object.entries(settings).forEach(([key, value]) => {
            if (typeof value !== 'number' || value < 0) {
                throw new ValidationError(`Invalid budget value for category ${key}`);
            }
        });
    }
}

module.exports = new BudgetService();
