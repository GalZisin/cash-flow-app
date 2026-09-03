const cashFlowRepository = require('../repositories/cashFlow.repository');
const installmentsService = require('./installments.service');

/**
 * שירות לאינטגרציה מלאה בין תזרים מזומנים, פריסות תשלומים ויעדים פיננסיים
 */
class GoalsIntegrationService {
    /**
     * מוצא את כל ההוצאות המיוחדות מתזרים המזומנים שרלוונטיות ליעד
     */
    async getRelatedCashFlowExpenses(goal) {
        try {
            const cashFlowData = await cashFlowRepository.read();
            if (!cashFlowData?.months?.length) return [];

            const relatedExpenses = [];
            const currentMonth = this.getCurrentMonth();
            const targetMonth = this.normalizeMonth(goal.targetDate);

            for (const month of cashFlowData.months) {
                const monthNorm = this.normalizeMonth(month.month);
                if (!monthNorm || monthNorm < currentMonth || monthNorm > targetMonth) continue;

                // בדוק הוצאות מיוחדות
                if (month.specialExpenses && Array.isArray(month.specialExpenses)) {
                    for (const expense of month.specialExpenses) {
                        if (!expense.amount || expense.amount <= 0) continue;

                        // אם יש תיאור ברור, נסה להבין אם זה קשור ליעד
                        const description = (expense.description || '').trim();
                        const isRelated = description && this.isExpenseRelatedToGoal(description, goal);

                        relatedExpenses.push({
                            month: monthNorm,
                            description: description || 'הוצאה מיוחדת ללא תיאור',
                            amount: Number(expense.amount),
                            isSpecial: true,
                            impactOnGoal: this.calculateExpenseImpact(Number(expense.amount), monthNorm, targetMonth),
                            confidence: isRelated ? 'high' : (description ? 'medium' : 'low')
                        });
                    }
                }

                // בדוק גם הוצאות רגילות גדולות שעשויות להיות רלוונטיות
                if (month.regularExpenses && Array.isArray(month.regularExpenses)) {
                    for (const expense of month.regularExpenses) {
                        if (!expense.amount || expense.amount < 5000) continue; // רק הוצאות משמעותיות

                        const description = (expense.description || '').trim();
                        if (description && this.isExpenseRelatedToGoal(description, goal)) {
                            relatedExpenses.push({
                                month: monthNorm,
                                description: description,
                                amount: Number(expense.amount),
                                isSpecial: false,
                                impactOnGoal: this.calculateExpenseImpact(Number(expense.amount), monthNorm, targetMonth),
                                confidence: 'medium'
                            });
                        }
                    }
                }
            }

            return relatedExpenses.sort((a, b) => a.month.localeCompare(b.month));
        } catch (error) {
            console.error('Error getting related cash flow expenses:', error);
            return [];
        }
    }

    /**
     * מוצא את כל פריסות התשלומים הרלוונטיות ליעד
     */
    async getRelatedInstallments(goal) {
        try {
            const installments = await installmentsService.getAll();
            if (!installments?.length) return [];

            const relatedInstallments = [];
            const currentMonth = this.getCurrentMonth();
            const targetMonth = this.normalizeMonth(goal.targetDate);

            for (const installment of installments) {
                const status = installmentsService.calculateStatus(installment);
                if (status.isCompleted) continue;

                const startMonth = this.normalizeMonth(installment.startDate);
                const endMonth = this.normalizeMonth(status.endDate);

                // בדוק חפיפה בין תקופת הפריסה לתקופת היעד
                const overlapStart = startMonth > currentMonth ? startMonth : currentMonth;
                const overlapEnd = endMonth < targetMonth ? endMonth : targetMonth;

                if (overlapStart <= overlapEnd) {
                    const overlapMonths = this.calculateMonthsDifference(overlapStart, overlapEnd) + 1;
                    const monthlyImpact = installment.monthlyPayment || 0;
                    const totalImpact = monthlyImpact * overlapMonths;

                    // בדוק אם יש קישור ישיר
                    const isDirectlyLinked = installment.linkedGoalId === goal.id;

                    relatedInstallments.push({
                        id: installment.id,
                        name: installment.name,
                        monthlyPayment: monthlyImpact,
                        startDate: startMonth,
                        endDate: endMonth,
                        remainingAmount: status.remainingAmount,
                        paymentType: installment.paymentType || 'manual',
                        impactOnGoal: totalImpact,
                        overlapMonths: overlapMonths,
                        isDirectlyLinked: isDirectlyLinked,
                        loanComponents: installment.loanComponents || []
                    });
                }
            }

            return relatedInstallments.sort((a, b) => b.impactOnGoal - a.impactOnGoal);
        } catch (error) {
            console.error('Error getting related installments:', error);
            return [];
        }
    }

    /**
     * מחשב את כל ההתחייבויות העתידיות המשפיעות על היעד
     */
    async getFutureCommitments(goal) {
        const commitments = [];
        const currentMonth = this.getCurrentMonth();
        const targetMonth = this.normalizeMonth(goal.targetDate);

        // הוצאות מתזרים
        const cashFlowExpenses = await this.getRelatedCashFlowExpenses(goal);
        for (const expense of cashFlowExpenses) {
            commitments.push({
                type: 'special_expense',
                description: expense.description,
                monthlyImpact: expense.amount, // חד פעמי
                totalImpact: expense.amount,
                startDate: expense.month,
                endDate: expense.month,
                source: 'תזרים מזומנים',
                confidence: expense.confidence
            });
        }

        // פריסות תשלומים
        const installments = await this.getRelatedInstallments(goal);
        for (const installment of installments) {
            const hasLoans = installment.loanComponents && installment.loanComponents.length > 0;

            commitments.push({
                type: hasLoans ? 'loan' : 'installment',
                description: installment.name,
                monthlyImpact: installment.monthlyPayment,
                totalImpact: installment.impactOnGoal,
                startDate: installment.startDate,
                endDate: installment.endDate,
                source: `פריסת תשלומים - ${installment.paymentType}`,
                isDirectlyLinked: installment.isDirectlyLinked,
                loanDetails: hasLoans ? installment.loanComponents : undefined
            });
        }

        return commitments.sort((a, b) => b.totalImpact - a.totalImpact);
    }

    /**
     * מייצר תובנות מבוססות על כל המידע המשולב
     */
    async generateInsights(goal, analysis) {
        const insights = [];
        const commitments = await this.getFutureCommitments(goal);

        if (!commitments.length) {
            insights.push('✅ אין התחייבויות עתידיות משמעותיות שמשפיעות על היעד הזה');
        } else {
            const totalCommitmentImpact = commitments.reduce((sum, c) => sum + c.totalImpact, 0);
            insights.push(`📊 סה"כ התחייבויות עתידיות: ${totalCommitmentImpact.toLocaleString('he-IL')} ₪`);

            // פרק לפי סוגים
            const loans = commitments.filter(c => c.type === 'loan');
            const installments = commitments.filter(c => c.type === 'installment');
            const expenses = commitments.filter(c => c.type === 'special_expense');

            if (loans.length > 0) {
                const loanImpact = loans.reduce((sum, l) => sum + l.totalImpact, 0);
                insights.push(`💳 ${loans.length} הלוואות פעילות: ${loanImpact.toLocaleString('he-IL')} ₪`);
            }

            if (installments.length > 0) {
                const installmentImpact = installments.reduce((sum, i) => sum + i.totalImpact, 0);
                insights.push(`📅 ${installments.length} פריסות תשלומים: ${installmentImpact.toLocaleString('he-IL')} ₪`);
            }

            if (expenses.length > 0) {
                const expenseImpact = expenses.reduce((sum, e) => sum + e.totalImpact, 0);
                const highConfidence = expenses.filter(e => e.confidence === 'high');
                insights.push(`💰 ${expenses.length} הוצאות מיוחדות מתוכננות: ${expenseImpact.toLocaleString('he-IL')} ₪`);
                
                if (highConfidence.length > 0) {
                    insights.push(`⚠️ ${highConfidence.length} הוצאות מזוהות כקשורות ישירות ליעד זה`);
                }
            }

            // המלצות ספציפיות
            if (analysis.status === 'NOT_ACHIEVABLE' && totalCommitmentImpact > goal.targetAmount * 0.5) {
                insights.push('⚡ התחייבויות קיימות משפיעות משמעותית על היכולת להגיע ליעד - שקול לדחות או לשנות את מבנה התשלומים');
            }

            // זיהוי פריסות קשורות ישירות
            const linked = commitments.filter(c => c.isDirectlyLinked);
            if (linked.length > 0) {
                insights.push(`🔗 ${linked.length} פריסות מקושרות ישירות ליעד זה - עדכונים יסונכרנו אוטומטית`);
            }
        }

        return insights;
    }

    /**
     * בדיקה אם הוצאה קשורה ליעד לפי תיאור
     */
    isExpenseRelatedToGoal(description, goal) {
        const descLower = description.toLowerCase();
        const goalNameLower = goal.name.toLowerCase();
        const goalDescLower = (goal.description || '').toLowerCase();

        // בדיקות פשוטות
        const keywords = [goalNameLower, ...goalNameLower.split(' ')];
        if (goalDescLower) {
            keywords.push(...goalDescLower.split(' ').filter(w => w.length > 3));
        }

        return keywords.some(keyword => descLower.includes(keyword));
    }

    /**
     * מחשב השפעה של הוצאה על יעד
     */
    calculateExpenseImpact(amount, expenseMonth, targetMonth) {
        const monthsToGoal = this.calculateMonthsDifference(expenseMonth, targetMonth);
        // ככל שההוצאה קרובה יותר ליעד, ההשפעה גדולה יותר
        return amount * (1 + (1 / Math.max(monthsToGoal, 1)));
    }

    normalizeMonth(value) {
        const match = String(value || '').match(/^(\d{4}-\d{2})/);
        return match ? match[1] : null;
    }

    getCurrentMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    calculateMonthsDifference(start, end) {
        const [sy, sm] = start.split('-').map(Number);
        const [ey, em] = end.split('-').map(Number);
        return (ey - sy) * 12 + em - sm;
    }
}

module.exports = new GoalsIntegrationService();
