import { Injectable } from '@angular/core';
import { FormArray, AbstractControl } from '@angular/forms';

/**
 * שירות לחישובים בטבלת תזרים
 */
@Injectable({
    providedIn: 'root'
})
export class CashFlowCalculationService {

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
