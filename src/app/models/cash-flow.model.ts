export interface MonthData {
  month: string;
  startingBalance: number;
  income: number; // סך ההכנסות המצטברות
  mortgagePayment?: number;
  loanPayment?: number; // Manual loan payment
  installmentsPayment?: number; // Calculated installments from InstallmentService
  additionalIncomes?: { description: string; amount: number }[];
  regularExpenses?: { description: string; amount: number }[];
  specialExpenses?: { description: string; amount: number }[];
  endingBalance: number;
  savings?: number; // סך החיסכון המצטבר (אופציונלי, ייתכן שמחושב)
  rowColor?: string | null; // מאפיין אופציונלי, ייתכן שקשור ל-UI
  // הוסף כאן כל מאפיין נוסף שקיים באופן עקבי ב-MonthData שמגיע מהשירות.
}