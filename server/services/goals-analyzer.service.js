const cashFlowRepository = require('../repositories/cashFlow.repository');
const goalsRepository = require('../repositories/goals.repository');

class GoalsAnalyzerService {
    static SAFETY_BUFFER = 65000;
    static MINIMUM_SAFETY_BUFFER = 61200;

    async analyzeGoal(goal) {
        const cashFlowData = await cashFlowRepository.read();
        const allGoals = await goalsRepository.getActive();
        if (!cashFlowData?.months?.length) return this.getEmptyAnalysis('אין נתוני תזרים מזומנים');

        const currentBalance = this.getCurrentBalance(cashFlowData);
        const months = cashFlowData.months.map(month => ({ ...month, month: this.normalizeMonth(month.month) }))
            .filter(month => month.month).sort((a, b) => a.month.localeCompare(b.month));
        const currentMonth = this.getCurrentMonth();
        const otherGoals = allGoals.filter(item => item.id !== goal.id);
        const projection = this.projectBalance(months, currentMonth, goal.targetDate, currentBalance, otherGoals, goal);
        const requiredAtTarget = this.getRequiredAmountAtTarget(goal);
        // The target cost is already deducted by projectBalance.
        const conflicts = this.findGoalConflicts(goal, allGoals, months, currentMonth, currentBalance);
        const fixedGoalConflict = !goal.isFixed && conflicts.some(conflict => conflict.protectedGoal);
        const achievable = projection.finalBalance >= GoalsAnalyzerService.MINIMUM_SAFETY_BUFFER && !fixedGoalConflict;
        let suggestedDate = null;
        let monthsDelay = 0;
        if (!achievable) {
            const suggestion = this.findSuggestedDate(months, goal.targetDate, currentBalance, GoalsAnalyzerService.SAFETY_BUFFER, otherGoals, goal);
            suggestedDate = suggestion.date;
            monthsDelay = suggestion.monthsDelay;
        }

        const monthsUntilGoal = this.calculateMonthsDifference(currentMonth, goal.targetDate);
        const shortfall = Math.max(0, GoalsAnalyzerService.MINIMUM_SAFETY_BUFFER - projection.finalBalance);
        const monthlySavingsNeeded = monthsUntilGoal > 0 ? Math.ceil(shortfall / monthsUntilGoal) : shortfall;
        const status = !achievable
            ? 'NOT_ACHIEVABLE'
            : projection.finalBalance < GoalsAnalyzerService.SAFETY_BUFFER ? 'WARNING' : 'ACHIEVABLE';
        const statusMessage = this.getStatusMessage(status, projection.finalBalance, requiredAtTarget, monthlySavingsNeeded, conflicts);

        // החזרת הניתוח הבסיסי (מהיר)
        return {
            achievable,
            projectedBalance: Math.round(projection.finalBalance),
            currentBalance: Math.round(currentBalance),
            requiredAtTarget: Math.round(requiredAtTarget),
            safetyBuffer: GoalsAnalyzerService.SAFETY_BUFFER,
            minimumSafetyBuffer: GoalsAnalyzerService.MINIMUM_SAFETY_BUFFER,
            monthsUntilGoal,
            monthlySavingsNeeded: Math.round(monthlySavingsNeeded),
            suggestedDate,
            monthsDelay,
            reasons: this.calculateReasons(goal, projection),
            recommendations: this.generateRecommendations(goal, monthlySavingsNeeded),
            impactOnOtherGoals: this.analyzeImpactOnOtherGoals(goal, allGoals),
            conflicts,
            statusMessage,
            status
        };
    }

    getCurrentBalance(cashFlowData) {
        const currentMonth = this.getCurrentMonth();
        const months = cashFlowData.months.map(month => ({ ...month, month: this.normalizeMonth(month.month) }))
            .filter(month => month.month && month.month <= currentMonth).sort((a, b) => b.month.localeCompare(a.month));
        return months[0]?.endingBalance ?? cashFlowData.months[0]?.startingBalance ?? 0;
    }

    projectBalance(months, startMonth, endMonth, startBalance, otherGoals, currentGoal) {
        let balance = startBalance;
        const monthlyData = [];
        for (const month of months) {
            if (month.month <= startMonth) continue;
            if (month.month > endMonth) break;
            const income = this.calculateIncome(month);
            const expenses = this.calculateExpenses(month);
            const goalExpenses = this.calculateGoalsExpenses(month.month, otherGoals) + this.calculateGoalExpense(month.month, currentGoal);
            balance += income - expenses - goalExpenses;
            monthlyData.push({ month: month.month, balance: Math.round(balance), income, expenses });
        }
        return { finalBalance: balance, monthlyData };
    }

    findSuggestedDate(months, originalDate, startBalance, requiredAmount, otherGoals, goal) {
        let balance = startBalance;
        let monthsDelay = 0;
        const candidates = months.filter(month => month.month >= originalDate).slice(0, 36);
        for (const month of candidates) {
            balance += this.calculateIncome(month) - this.calculateExpenses(month) - this.calculateGoalsExpenses(month.month, otherGoals) - this.calculateGoalExpense(month.month, goal);
            monthsDelay++;
            if (balance >= requiredAmount) return { date: month.month, monthsDelay };
        }
        const averageFlow = candidates.length ? candidates.reduce((sum, month) => sum + this.calculateIncome(month) - this.calculateExpenses(month), 0) / candidates.length : 1000;
        const additionalMonths = averageFlow > 0 ? Math.ceil(Math.max(0, requiredAmount - balance) / averageFlow) : 1;
        return { date: this.addMonths(originalDate, additionalMonths), monthsDelay: additionalMonths };
    }

    calculateReasons(goal, projection) {
        const reasons = [];
        const shortage = GoalsAnalyzerService.MINIMUM_SAFETY_BUFFER - projection.finalBalance;
        if (shortage > 0) reasons.push(`חסר ${Math.round(shortage).toLocaleString('he-IL')} ₪ להשגת היעד`);
        if (goal.loanDetails) reasons.push(`הלוואה תוסיף ${Math.round((Number(goal.loanDetails.monthlyPayment) || 0) * (Number(goal.loanDetails.months) || 0)).toLocaleString('he-IL')} ₪ תשלומים`);
        return reasons;
    }

    getStatusMessage(status, projectedBalance, requiredAtTarget, monthlySavingsNeeded, conflicts = []) {
        const projected = Math.round(projectedBalance).toLocaleString('he-IL');
        const required = Math.round(requiredAtTarget).toLocaleString('he-IL');
        if (status === 'ACHIEVABLE') {
            return `בר השגה: לאחר התחייבות של ${required} ₪ צפויים להישאר ${projected} ₪, מעל מרווח הביטחון של ${GoalsAnalyzerService.SAFETY_BUFFER.toLocaleString('he-IL')} ₪ לחצי שנה.`;
        }
        if (status === 'WARNING') {
            return `גבולי: צפויים להישאר ${projected} ₪, מתחת למרווח הביטחון של ${GoalsAnalyzerService.SAFETY_BUFFER.toLocaleString('he-IL')} ₪ לחצי שנה${conflicts.length ? ` ויש השפעה על ${conflicts.length} יעד נוסף` : ''}.`;
        }
        return `לא ריאלי: היתרה הצפויה היא ${projected} ₪, מתחת לרף המינימום של ${GoalsAnalyzerService.MINIMUM_SAFETY_BUFFER.toLocaleString('he-IL')} ₪${conflicts.length ? ` בגלל ${conflicts[0].goalName}` : ''}${monthlySavingsNeeded > 0 ? `; נדרש חיסכון נוסף של ${Math.round(monthlySavingsNeeded).toLocaleString('he-IL')} ₪` : ''}.`;
    }

    getRequiredAmountAtTarget(goal) { return goal.loanDetails ? Math.max(0, Number(goal.loanDetails.downPayment) || 0) : Math.max(0, Number(goal.targetAmount) || 0); }
    generateRecommendations(goal, monthlySavingsNeeded) { return monthlySavingsNeeded > 0 ? [`חסוך ${Math.round(monthlySavingsNeeded).toLocaleString('he-IL')} ₪ בחודש`] : []; }
    analyzeImpactOnOtherGoals(newGoal, existingGoals) {
        const laterGoals = existingGoals.filter(goal => !goal.completed && goal.id !== newGoal.id && this.normalizeMonth(goal.targetDate) > this.normalizeMonth(newGoal.targetDate));
        return laterGoals.length ? [`עלול להשפיע על ${laterGoals.length} יעדים נוספים`, ...laterGoals.map(goal => `• ${goal.name} עלול להידחות`)] : [];
    }
    calculateIncome(month) { return (Number(month.income) || 0) + (month.additionalIncomes || []).reduce((sum, income) => sum + (Number(income.amount) || 0), 0); }
    calculateExpenses(month) { return (Number(month.mortgagePayment ?? month.mortgage) || 0) + (Number(month.loanPayment ?? month.loan) || 0) + (Number(month.installmentsPayment) || 0) + (month.regularExpenses || []).reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0) + (month.specialExpenses || []).reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0); }
    calculateGoalsExpenses(month, goals) { return goals.reduce((sum, goal) => sum + this.calculateGoalExpense(month, goal), 0); }
    calculateGoalExpense(month, goal) {
        if (!goal) return 0;
        if (goal.schedule?.type === 'milestone') {
            return (goal.schedule.milestones || []).filter(milestone => this.normalizeMonth(milestone.date) === month)
                .reduce((sum, milestone) => sum + this.getMilestoneAmount(goal, milestone), 0)
                + this.calculateLoanPayment(month, goal);
        }
        if (goal.schedule?.type === 'single') {
            const singleDate = this.normalizeMonth(goal.schedule.date || goal.targetDate);
            return month === singleDate ? Number(goal.schedule.amount || goal.targetAmount) || 0 : 0;
        }
        const targetMonth = this.normalizeMonth(goal.targetDate);
        const targetCost = month === targetMonth ? this.getRequiredAmountAtTarget(goal) : 0;
        return targetCost + this.calculateLoanPayment(month, goal, targetMonth);
    }

    getMilestoneAmount(goal, milestone) {
        return Number(milestone.amount) || (Number(goal.targetAmount) || 0) * (Number(milestone.percentage) || 0) / 100;
    }
    getGoalPaymentAtTarget(goal, month) { return this.calculateGoalExpense(month, goal); }
    calculateLoanPayment(month, goal, targetMonth = this.normalizeMonth(goal?.targetDate)) {
        if (!goal?.loanDetails) return 0;
        const elapsed = this.calculateMonthsDifference(targetMonth, month);
        const count = Number(goal.loanDetails.months) || 0;
        return elapsed >= 0 && elapsed < count ? Number(goal.loanDetails.monthlyPayment) || 0 : 0;
    }
    normalizeMonth(value) { const match = String(value || '').match(/^(\d{4}-\d{2})/); return match ? match[1] : null; }
    getCurrentMonth() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; }
    calculateMonthsDifference(start, end) { const [sy, sm] = start.split('-').map(Number); const [ey, em] = end.split('-').map(Number); return (ey - sy) * 12 + em - sm; }
    addMonths(dateString, months) { const [year, month] = dateString.split('-').map(Number); const date = new Date(year, month - 1); date.setMonth(date.getMonth() + months); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }
    findGoalConflicts(goal, allGoals, months, currentMonth, currentBalance) {
        const relevantGoals = allGoals.filter(other => other.id !== goal.id && !other.completed);
        const laterConflicts = relevantGoals.filter(other => this.normalizeMonth(other.targetDate) > this.normalizeMonth(goal.targetDate)).map(other => {
            const withGoal = this.projectBalance(months, currentMonth, other.targetDate, currentBalance, allGoals.filter(item => item.id !== other.id), other).finalBalance;
            const withoutGoal = this.projectBalance(months, currentMonth, other.targetDate, currentBalance, allGoals.filter(item => item.id !== other.id && item.id !== goal.id), other).finalBalance;
            if (withGoal >= 0 || withoutGoal < 0) return null;
            return {
                goalId: other.id,
                goalName: other.name,
                targetDate: other.targetDate,
                shortfall: Math.round(-withGoal),
                protectedGoal: Boolean(other.isFixed),
                recommendation: goal.isFixed
                    ? `היעד ${goal.name} מוגדר כקבוע. כדי להשאיר מספיק הון ל${other.name} בתאריך ${other.targetDate}, צריך להזיז או לבטל את היעד הגמיש.`
                    : `כדי להשאיר מספיק הון ל${other.name} בתאריך ${other.targetDate}, כדאי להזיז את ${goal.name} לתאריך חלופי או לבטל אותו.`
            };
        }).filter(Boolean);

        const fixedEarlierConflicts = relevantGoals.filter(other => other.isFixed && this.normalizeMonth(other.targetDate) < this.normalizeMonth(goal.targetDate)).map(other => {
            const withFixedGoal = this.projectBalance(months, currentMonth, goal.targetDate, currentBalance, allGoals.filter(item => item.id !== goal.id), goal).finalBalance;
            const withoutFixedGoal = this.projectBalance(months, currentMonth, goal.targetDate, currentBalance, allGoals.filter(item => item.id !== goal.id && item.id !== other.id), goal).finalBalance;
            if (withFixedGoal >= 0 || withoutFixedGoal < 0) return null;
            return {
                goalId: other.id,
                goalName: other.name,
                targetDate: other.targetDate,
                shortfall: Math.round(-withFixedGoal),
                protectedGoal: true,
                recommendation: `היעד ${other.name} מוגדר כקבוע ולכן משפיע על ${goal.name}. אי אפשר להזיז אותו; יש להגדיל תזרים או לדחות את ${goal.name}.`
            };
        }).filter(Boolean);

        return [...laterConflicts, ...fixedEarlierConflicts];
    }
    getEmptyAnalysis(reason) { return { achievable: false, projectedBalance: 0, currentBalance: 0, requiredAtTarget: 0, safetyBuffer: GoalsAnalyzerService.SAFETY_BUFFER, minimumSafetyBuffer: GoalsAnalyzerService.MINIMUM_SAFETY_BUFFER, monthsUntilGoal: 0, monthlySavingsNeeded: 0, reasons: [reason], recommendations: ['הוסף נתוני תזרים מזומנים'], impactOnOtherGoals: [], conflicts: [], statusMessage: reason, status: 'NOT_ACHIEVABLE' }; }
    getEmptyAnalysis(reason) { return { achievable: false, projectedBalance: 0, currentBalance: 0, requiredAtTarget: 0, safetyBuffer: GoalsAnalyzerService.SAFETY_BUFFER, minimumSafetyBuffer: GoalsAnalyzerService.MINIMUM_SAFETY_BUFFER, monthsUntilGoal: 0, monthlySavingsNeeded: 0, reasons: [reason], recommendations: ['הוסף נתוני תזרים מזומנים'], impactOnOtherGoals: [], conflicts: [], statusMessage: reason, status: 'NOT_ACHIEVABLE' }; }
}

module.exports = new GoalsAnalyzerService();
