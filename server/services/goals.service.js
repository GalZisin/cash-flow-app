const goalsRepository = require('../repositories/goals.repository');
const goalsAnalyzer = require('./goals-analyzer.service');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

/**
 * Service for financial goals business logic
 */
class GoalsService {
    /**
     * קבלת כל היעדים
     */
    async getAllGoals() {
        return await goalsRepository.read();
    }

    /**
     * קבלת יעד לפי ID
     */
    async getGoalById(id) {
        const goal = await goalsRepository.findById(id);
        if (!goal) {
            throw new NotFoundError(`Goal with id ${id} not found`);
        }
        return goal;
    }

    /**
     * יצירת יעד חדש
     */
    async createGoal(goalData) {
        goalData = this.normalizeScheduleTargetDate(goalData);
        // Validation
        this.validateGoalData(goalData);

        const now = new Date().toISOString();
        const goal = {
            id: uuidv4(),
            ...goalData,
            priority: goalData.priority || 999,
            completed: false,
            createdDate: now,
            updatedDate: now
        };

        // ניתוח אוטומטי
        const analysis = await goalsAnalyzer.analyzeGoal(goal);
        goal.analysis = analysis;
        goal.lastAnalyzed = now;

        await goalsRepository.create(goal);
        await this.analyzeAllGoals();
        return await goalsRepository.findById(goal.id);
    }

    /**
     * עדכון יעד
     */
    async updateGoal(id, updates) {
        const existingGoal = await this.getGoalById(id);

        // Validation
        if (updates.targetAmount !== undefined || updates.targetDate !== undefined || updates.loanDetails !== undefined) {
            this.validateGoalData({ ...existingGoal, ...updates });
        }

        const updated = await goalsRepository.update(id, updates);

        // ניתוח מחדש אם השתנו פרמטרים משמעותיים
        if (updates.targetAmount || updates.targetDate || updates.loanDetails) {
            const analysis = await goalsAnalyzer.analyzeGoal(updated);
            updated.analysis = analysis;
            updated.lastAnalyzed = new Date().toISOString();
            await goalsRepository.update(id, { analysis: updated.analysis, lastAnalyzed: updated.lastAnalyzed });
        }

        await this.analyzeAllGoals();

        return await goalsRepository.findById(id);
    }

    /**
     * מחיקת יעד
     */
    async deleteGoal(id) {
        const deleted = await goalsRepository.delete(id);
        if (!deleted) {
            throw new NotFoundError(`Goal with id ${id} not found`);
        }
        await this.analyzeAllGoals();
        return { success: true };
    }

    /**
     * ניתוח יעד מחדש
     */
    async analyzeGoal(id) {
        const goal = await this.getGoalById(id);
        const analysis = await goalsAnalyzer.analyzeGoal(goal);

        goal.analysis = analysis;
        goal.lastAnalyzed = new Date().toISOString();

        await goalsRepository.update(id, {
            analysis: goal.analysis,
            lastAnalyzed: goal.lastAnalyzed
        });

        return analysis;
    }

    /**
     * ניתוח כל היעדים מחדש
     */
    async analyzeAllGoals() {
        const goals = await goalsRepository.getActive();

        for (const goal of goals) {
            const analysis = await goalsAnalyzer.analyzeGoal(goal);
            await goalsRepository.update(goal.id, {
                analysis,
                lastAnalyzed: new Date().toISOString()
            });
        }

        return { analyzed: goals.length };
    }

    /**
     * קבלת סקירה כללית
     */
    async getOverview() {
        const goals = await goalsRepository.read();
        const activeGoals = goals.filter(g => !g.completed);

        const overview = {
            totalGoals: goals.length,
            activeGoals: activeGoals.length,
            completedGoals: goals.filter(g => g.completed).length,
            totalTargetAmount: activeGoals.reduce((sum, g) => sum + g.targetAmount, 0),
            achievableGoals: activeGoals.filter(g => g.analysis?.status === 'ACHIEVABLE').length,
            warningGoals: activeGoals.filter(g => g.analysis?.status === 'WARNING').length,
            notAchievableGoals: activeGoals.filter(g => g.analysis?.status === 'NOT_ACHIEVABLE').length
        };

        // מציאת היעד הקרוב ביותר
        if (activeGoals.length > 0) {
            const sorted = activeGoals.sort((a, b) => a.targetDate.localeCompare(b.targetDate));
            overview.nextGoal = sorted[0];
        }

        return overview;
    }

    /**
     * קבלת ציר זמן
     */
    async getTimeline() {
        const goals = await goalsRepository.getActive();
        const events = [];

        goals.forEach(goal => {
            // אירוע תאריך יעד
            events.push({
                date: goal.targetDate,
                goalId: goal.id,
                goalName: goal.name,
                type: 'target',
                amount: goal.targetAmount,
                color: this.getColorByStatus(goal.analysis?.status)
            });

            // אירוע תאריך מוצע (אם קיים)
            if (goal.analysis?.suggestedDate) {
                events.push({
                    date: goal.analysis.suggestedDate,
                    goalId: goal.id,
                    goalName: goal.name,
                    type: 'suggested',
                    amount: goal.targetAmount,
                    color: '#f59e0b'
                });
            }
        });

        // מיון לפי תאריך
        events.sort((a, b) => a.date.localeCompare(b.date));

        return events;
    }

    /**
     * Validation
     */
    validateGoalData(data) {
        if (!data.name || data.name.trim().length === 0) {
            throw new ValidationError('Goal name is required');
        }

        if (!data.type) {
            throw new ValidationError('Goal type is required');
        }

        if (!data.targetAmount || data.targetAmount <= 0) {
            throw new ValidationError('Target amount must be positive');
        }

        if (!data.targetDate) {
            throw new ValidationError('Target date is required');
        }

        if (data.schedule?.type === 'milestone') {
            if (!Array.isArray(data.schedule.milestones) || data.schedule.milestones.length === 0) {
                throw new ValidationError('At least one milestone is required');
            }
            const totalPercentage = data.schedule.milestones.reduce((sum, milestone) => sum + (Number(milestone.percentage) || 0), 0);
            const totalAmount = data.schedule.milestones.reduce((sum, milestone) => sum + (Number(milestone.amount) || 0), 0);
            const usesAmounts = data.schedule.milestones.some(milestone => Number(milestone.amount) > 0);
            if (usesAmounts ? Math.abs(totalAmount - Number(data.targetAmount)) > 0.01 : Math.abs(totalPercentage - 100) > 0.01) {
                throw new ValidationError(usesAmounts ? 'Milestone amounts must equal target amount' : 'Milestone percentages must total 100');
            }
            if (data.schedule.milestones.some(milestone => !/^\d{4}-\d{2}$/.test(milestone.date) || (Number(milestone.percentage) <= 0 && Number(milestone.amount) <= 0))) {
                throw new ValidationError('Each milestone needs a valid date and a positive amount or percentage');
            }
        }

        // בדיקת פורמט תאריך YYYY-MM
        if (!/^\d{4}-\d{2}$/.test(data.targetDate)) {
            throw new ValidationError('Target date must be in YYYY-MM format');
        }

        // בדיקת פרטי הלוואה
        if (data.loanDetails) {
            if (!data.loanDetails.loanAmount || data.loanDetails.loanAmount <= 0) {
                throw new ValidationError('Loan amount must be positive');
            }
            if (!data.loanDetails.monthlyPayment || data.loanDetails.monthlyPayment <= 0) {
                throw new ValidationError('Monthly payment must be positive');
            }
            if (!data.loanDetails.months || data.loanDetails.months <= 0) {
                throw new ValidationError('Number of months must be positive');
            }
        }
    }

    normalizeScheduleTargetDate(data) {
        if (data.schedule?.type !== 'milestone' || data.targetDate) return data;
        const dates = (data.schedule.milestones || []).map(milestone => milestone.date).filter(Boolean).sort();
        return dates.length ? { ...data, targetDate: dates[dates.length - 1] } : data;
    }

    /**
     * קבלת צבע לפי סטטוס
     */
    getColorByStatus(status) {
        switch (status) {
            case 'ACHIEVABLE': return '#10b981';
            case 'WARNING': return '#f59e0b';
            case 'NOT_ACHIEVABLE': return '#ef4444';
            default: return '#6b7280';
        }
    }
}

module.exports = new GoalsService();
