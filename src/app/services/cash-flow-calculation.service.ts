import { Injectable } from '@angular/core';
import { FormArray, AbstractControl } from '@angular/forms';

/** ערכי חודש כפי שמגיעים מ-FormGroup.value או מהשרת (כל השדות אופציונליים). */
export interface MonthValues {
    startingBalance?: number | string | null;
    income?: number | string | null;
    mortgagePayment?: number | string | null;
    loanPayment?: number | string | null;
    installmentsPayment?: number | string | null;
    additionalIncomes?: { amount?: number | string | null }[] | null;
    regularExpenses?: { amount?: number | string | null }[] | null;
    specialExpenses?: { amount?: number | string | null }[] | null;
}

const num = (v: unknown): number => Number(v) || 0;

/**
 * שירות לחישובים בטבלת תזרים
 */
@Injectable({
    providedIn: 'root'
})
export class CashFlowCalculationService {

    // ---- חישובים על ערכים (ללא תלות ב-Reactive Forms, ניתנים לבדיקה ישירה) ----

    /** סכום השדה amount של רשימת שורות (הוצאות / הכנסות נוספות). */
    sumAmounts(rows: { amount?: number | string | null }[] | null | undefined): number {
        return (rows ?? []).reduce((sum, r) => sum + num(r?.amount), 0);
    }

    /** הכנסה + הכנסות נוספות. */
    totalIncome(m: MonthValues): number {
        return num(m.income) + this.sumAmounts(m.additionalIncomes);
    }

    /** משכנתה + הלוואות + פריסות + הוצאות שוטפות + הוצאות מיוחדות. */
    totalExpenses(m: MonthValues): number {
        return num(m.mortgagePayment) + num(m.loanPayment) + num(m.installmentsPayment)
            + this.sumAmounts(m.regularExpenses) + this.sumAmounts(m.specialExpenses);
    }

    /** יתרת סוף חודש: יתרת פתיחה + הכנסות - הוצאות. */
    endingBalance(startingBalance: number, m: MonthValues): number {
        return startingBalance + this.totalIncome(m) - this.totalExpenses(m);
    }

    // ---- חישובים על FormArray (API קיים) ----

    /**
     * חישוב סכום הכנסות נוספות
     */
    calculateAdditionalIncomesSum(additionalIncomesArray: FormArray): number {
        return additionalIncomesArray.controls.reduce((sum, control) => {
            return sum + (Number(control.get('amount')?.value) || 0);
        }, 0);
    }

    /**
     * חישוב סכום הוצאות שוטפות
     */
    calculateRegularExpensesSum(regularExpensesArray: FormArray): number {
        return regularExpensesArray.controls.reduce((sum, control) => {
            return sum + (Number(control.get('amount')?.value) || 0);
        }, 0);
    }

    /**
     * חישוב סכום הוצאות מיוחדות
     */
    calculateSpecialExpensesSum(specialExpensesArray: FormArray): number {
        return specialExpensesArray.controls.reduce((sum, control) => {
            return sum + (Number(control.get('amount')?.value) || 0);
        }, 0);
    }

    /**
     * חישוב סה"כ הכנסות לחודש
     */
    calculateTotalIncome(
        monthControl: AbstractControl,
        additionalIncomesSum: number
    ): number {
        const income = Number(monthControl.get('income')?.value) || 0;
        return income + additionalIncomesSum;
    }

    /**
     * חישוב סה"כ הוצאות לחודש
     */
    calculateTotalExpenses(
        monthControl: AbstractControl,
        regularExpensesSum: number,
        specialExpensesSum: number
    ): number {
        const mortgage = Number(monthControl.get('mortgagePayment')?.value) || 0;
        const loanPayment = Number(monthControl.get('loanPayment')?.value) || 0;
        const installmentsPayment = Number(monthControl.get('installmentsPayment')?.value) || 0;

        return mortgage + loanPayment + installmentsPayment + regularExpensesSum + specialExpensesSum;
    }

    /**
     * חישוב חיסכון (הכנסות - הוצאות)
     */
    calculateSavings(totalIncome: number, totalExpenses: number): number {
        return totalIncome - totalExpenses;
    }

    /**
     * חישוב רוחב עמודה בגרף מיני
     */
    calculateBarWidth(value: number, maxValue: number): number {
        if (maxValue <= 0) return 0;
        return (value / maxValue) * 100;
    }

    /**
     * חישוב יתרה סופית
     */
    calculateEndingBalance(
        startingBalance: number,
        totalIncome: number,
        totalExpenses: number
    ): number {
        return startingBalance + totalIncome - totalExpenses;
    }

    /**
     * המרת תאריך למחרוזת חודש
     */
    toMonthString(date: Date): string {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`;
    }

    /**
     * המרת מחרוזת חודש לתאריך
     */
    fromMonthString(monthString: string): Date {
        const rawDate = new Date(monthString);
        return new Date(rawDate.getUTCFullYear(), rawDate.getUTCMonth(), 1);
    }
}
