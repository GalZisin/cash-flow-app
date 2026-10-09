import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { CashFlowService, MonthData } from './cash-flow.service';
import { GoalsService } from './goals.service';
import { FinancialGoal, GoalMilestone } from '../models/goal.model';
import { ExpenseItem } from '../models/expense.model';
import { ExpenseCategory } from '../models/expense-category.model';

/**
 * שירות לניהול סימולציית תזרים מזומנים
 * 
 * השירות יוצר עותק של התזרים המקורי ומוסיף אליו באופן אוטומטי
 * את ההשפעה של כל היעדים (הלוואות, פריסות, תשלומים חד-פעמיים)
 */
@Injectable({ providedIn: 'root' })
export class CashFlowSimulationService {
    private cashFlowService = inject(CashFlowService);
    private goalsService = inject(GoalsService);

    // התזרים המשוכפל עם היעדים
    private _simulationMonths = new BehaviorSubject<MonthData[]>([]);
    public simulationMonths$ = this._simulationMonths.asObservable();

    // סימון של שורות שהתווספו מיעדים
    private _goalAddedExpenses = new BehaviorSubject<Map<string, string[]>>(new Map());
    public goalAddedExpenses$ = this._goalAddedExpenses.asObservable();

    constructor() {
        // האזנה לשינויים בתזרים המקורי וביעדים
        combineLatest([
            this.cashFlowService.cashFlowMonths$,
            toObservable(this.goalsService.goals)
        ]).subscribe(([months, goals]) => {
            this.updateSimulation(months, goals);
        });
    }

    /**
     * טעינת התזרים המקורי מהשרת. נקרא מהמסך שמשתמש בסימולציה (יעדים),
     * ולא מהבנאי, כדי שהזרקת השירות לא תפעיל בקשת רשת במסכים שלא צריכים אותה.
     */
    loadOriginal(): void {
        this.cashFlowService.load().subscribe();
    }

    /**
     * עדכון הסימולציה - שכפול התזרים המקורי והוספת יעדים
     */
    private updateSimulation(originalMonths: MonthData[], goals: FinancialGoal[]): void {
        if (!originalMonths || originalMonths.length === 0) {
            this._simulationMonths.next([]);
            return;
        }

        // שכפול עמוק של התזרים
        const simulatedMonths: MonthData[] = JSON.parse(JSON.stringify(originalMonths));
        const addedExpensesMap = new Map<string, string[]>();

        // הוספת כל יעד לסימולציה
        goals.forEach(goal => {
            if (!goal.completed) {
                this.applyGoalToSimulation(goal, simulatedMonths, addedExpensesMap);
            }
        });

        // חישוב מחדש של היתרות
        this.recalculateBalances(simulatedMonths);

        this._simulationMonths.next(simulatedMonths);
        this._goalAddedExpenses.next(addedExpensesMap);
    }

    /**
     * איתור או יצירת חודש בתזרים לפי פורמט YYYY-MM
     */
    private findOrCreateMonth(months: MonthData[], targetYearMonth: string): MonthData | undefined {
        if (!targetYearMonth) return undefined;
        const ym = targetYearMonth.substring(0, 7); // e.g. "2026-10"

        // 1. חיפוש חודש קיים בתזרים שתואם ל-YYYY-MM
        let existing = months.find(m => m.month && m.month.substring(0, 7) === ym);
        if (existing) return existing;

        if (months.length === 0) return undefined;

        // 2. אם היעד בעתיד מעבר לחודשים הקיימים, יצירת חודשים נוספים עד הגעה לחודש היעד
        const lastMonthStr = months[months.length - 1].month;
        let lastDate = new Date(lastMonthStr);
        if (isNaN(lastDate.getTime())) {
            lastDate = new Date();
        }

        const targetDate = new Date(`${ym}-01T00:00:00.000Z`);

        while (lastDate < targetDate) {
            lastDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1);
            const newMonthStr = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`;
            const prevEnding = months[months.length - 1].endingBalance || 0;

            const newMonthData: MonthData = {
                month: newMonthStr,
                startingBalance: prevEnding,
                income: 0,
                mortgagePayment: 0,
                loanPayment: 0,
                manualLoanPayment: 0,
                regularExpenses: [],
                specialExpenses: [],
                endingBalance: prevEnding
            };
            months.push(newMonthData);

            if (newMonthStr.substring(0, 7) === ym) {
                existing = newMonthData;
                break;
            }
        }

        return existing;
    }

    /**
     * החלת יעד בודד על הסימולציה
     */
    private applyGoalToSimulation(
        goal: FinancialGoal,
        months: MonthData[],
        addedExpensesMap: Map<string, string[]>
    ): void {
        const scheduleType = goal.schedule?.type || (goal.loanDetails ? 'loan' : (goal.schedule?.milestones?.length ? 'milestone' : 'single'));

        switch (scheduleType) {
            case 'loan':
                this.applyLoanToSimulation(goal, months, addedExpensesMap);
                break;
            case 'milestone':
                this.applyMilestonesToSimulation(goal, months, addedExpensesMap);
                break;
            case 'single':
            default:
                this.applySinglePaymentToSimulation(goal, months, addedExpensesMap);
                break;
        }
    }

    /**
     * הוספת הלוואה - מקדמה בהוצאות מיוחדות והחזרים חודשיים בעמודת הלוואות
     */
    private applyLoanToSimulation(
        goal: FinancialGoal,
        months: MonthData[],
        addedExpensesMap: Map<string, string[]>
    ): void {
        const loanDetails = goal.loanDetails || goal.schedule?.loan;
        if (!loanDetails) return;

        const { loanAmount, downPayment, monthlyPayment: providedMonthly, months: loanMonths } = loanDetails;
        const monthlyPayment = providedMonthly || (loanMonths ? Math.round(loanAmount / loanMonths) : 0);

        let targetDateObj: Date;
        if (goal.targetDate) {
            targetDateObj = new Date(`${goal.targetDate.substring(0, 7)}-01T00:00:00.000Z`);
            if (isNaN(targetDateObj.getTime())) targetDateObj = new Date();
        } else {
            targetDateObj = new Date();
        }

        const targetMonthKey = this.formatYearMonth(targetDateObj);

        // 1. מקדמה - מתווספת להוצאות מיוחדות בחודש היעד לפי שם היעד
        if (downPayment && downPayment > 0) {
            const monthData = this.findOrCreateMonth(months, targetMonthKey);
            if (monthData) {
                const expenseItem: ExpenseItem = {
                    description: `${goal.name}`,
                    amount: downPayment,
                    category: ExpenseCategory.OTHER,
                    goalRelated: true,
                    goalId: goal.id
                };

                monthData.specialExpenses.push(expenseItem);

                const expenseId = `${targetMonthKey}-${expenseItem.description}`;
                if (!addedExpensesMap.has(goal.id)) {
                    addedExpensesMap.set(goal.id, []);
                }
                addedExpensesMap.get(goal.id)!.push(expenseId);
            }
        }

        // 2. החזר חודשי של ההלוואה - מתווסף לעמודת הלוואות בחודשים הבאים
        if (monthlyPayment > 0 && loanMonths > 0) {
            const loanStartOffset = (downPayment && downPayment > 0) ? 1 : 0;

            for (let i = 0; i < loanMonths; i++) {
                const paymentDate = new Date(
                    targetDateObj.getFullYear(),
                    targetDateObj.getMonth() + loanStartOffset + i,
                    1
                );
                const monthKey = this.formatYearMonth(paymentDate);

                const monthData = this.findOrCreateMonth(months, monthKey);
                if (monthData) {
                    monthData.loanPayment = (monthData.loanPayment || 0) + monthlyPayment;

                    const expenseId = `${monthKey}-${goal.name}-loan-${i + 1}`;
                    if (!addedExpensesMap.has(goal.id)) {
                        addedExpensesMap.set(goal.id, []);
                    }
                    addedExpensesMap.get(goal.id)!.push(expenseId);
                }
            }
        }
    }

    /**
     * הוספת פעימות - תשלומים בתאריכים ספציפיים בהוצאות מיוחדות
     */
    private applyMilestonesToSimulation(
        goal: FinancialGoal,
        months: MonthData[],
        addedExpensesMap: Map<string, string[]>
    ): void {
        const milestones = goal.schedule?.milestones;
        if (!milestones || milestones.length === 0) return;

        milestones.forEach((milestone: GoalMilestone) => {
            if (!milestone.date) return;
            const monthKey = milestone.date.substring(0, 7);
            const monthData = this.findOrCreateMonth(months, monthKey);

            if (monthData) {
                const amount = milestone.amount || (goal.targetAmount * milestone.percentage / 100);
                const expenseItem: ExpenseItem = {
                    description: milestone.description ? `${goal.name} - ${milestone.description}` : `${goal.name}`,
                    amount: amount,
                    category: ExpenseCategory.OTHER,
                    goalRelated: true,
                    goalId: goal.id
                };

                monthData.specialExpenses.push(expenseItem);

                const expenseId = `${monthKey}-${expenseItem.description}`;
                if (!addedExpensesMap.has(goal.id)) {
                    addedExpensesMap.set(goal.id, []);
                }
                addedExpensesMap.get(goal.id)!.push(expenseId);
            }
        });
    }

    /**
     * הוספת תשלום חד-פעמי בהוצאות מיוחדות לפי כותרת היעד
     */
    private applySinglePaymentToSimulation(
        goal: FinancialGoal,
        months: MonthData[],
        addedExpensesMap: Map<string, string[]>
    ): void {
        if (!goal.targetDate) return;
        const monthKey = goal.targetDate.substring(0, 7);
        const monthData = this.findOrCreateMonth(months, monthKey);

        if (monthData) {
            const expenseItem: ExpenseItem = {
                description: `${goal.name}`,
                amount: goal.targetAmount,
                category: ExpenseCategory.OTHER,
                goalRelated: true,
                goalId: goal.id
            };

            monthData.specialExpenses.push(expenseItem);

            const expenseId = `${monthKey}-${expenseItem.description}`;
            if (!addedExpensesMap.has(goal.id)) {
                addedExpensesMap.set(goal.id, []);
            }
            addedExpensesMap.get(goal.id)!.push(expenseId);
        }
    }

    /**
     * חישוב מחדש של כל היתרות לאחר הוספת יעדים
     */
    private recalculateBalances(months: MonthData[]): void {
        for (let i = 0; i < months.length; i++) {
            const month = months[i];

            if (i > 0) {
                month.startingBalance = months[i - 1].endingBalance;
            }

            const totalRegular = (month.regularExpenses || []).reduce(
                (sum, exp) => sum + (Number(exp.amount) || 0), 0
            );

            const totalSpecial = (month.specialExpenses || []).reduce(
                (sum, exp) => sum + (Number(exp.amount) || 0), 0
            );

            const additionalIncomes = ((month as any).additionalIncomes || []).reduce(
                (sum: number, r: any) => sum + (Number(r.amount) || 0), 0
            );

            month.endingBalance =
                (Number(month.startingBalance) || 0) +
                (Number(month.income) || 0) +
                additionalIncomes -
                (Number(month.mortgagePayment) || 0) -
                (Number(month.loanPayment) || 0) -
                (Number(month.manualLoanPayment) || 0) -
                totalRegular -
                totalSpecial;
        }
    }

    /**
     * פורמט תאריך ל-YYYY-MM
     */
    private formatYearMonth(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    /**
     * קבלת הסימולציה הנוכחית
     */
    getCurrentSimulation(): MonthData[] {
        return this._simulationMonths.value;
    }

    /**
     * בדיקה האם חודש מסוים מכיל הוצאות שנוספו מיעדים
     */
    hasGoalExpenses(monthKey: string): boolean {
        const addedExpenses = this._goalAddedExpenses.value;
        for (const [_, expenses] of addedExpenses.entries()) {
            if (expenses.some(exp => exp.startsWith(monthKey))) {
                return true;
            }
        }
        return false;
    }

    /**
     * רענון הסימולציה מהתזרים המקורי
     * פעולה זו מאפסת את כל השינויים בסימולציה ומחזירה את הנתונים מהטבלה המקורית
     * כולל איפוס כל היעדים
     */
    refreshFromOriginal(): void {
        // טעינה מחדש של התזרים המקורי
        // זה יפעיל את updateSimulation אוטומטית דרך ה-combineLatest
        this.cashFlowService.load().subscribe();
    }

    /**
     * קבלת המצב הנוכחי של הסימולציה
     */
    getSimulationState() {
        return {
            hasChanges: this._simulationMonths.value.length > 0,
            monthsCount: this._simulationMonths.value.length
        };
    }
}
