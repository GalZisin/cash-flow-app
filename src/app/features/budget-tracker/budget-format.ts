// Display helpers shared by the budget tracker and its child components.

const currencyFormat = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

export function formatBudgetCurrency(amount: number): string {
  return currencyFormat.format(amount);
}

/** Material palette for a usage percentage: primary < 90% <= accent < 100% <= warn. */
export function budgetProgressColor(percentage: number): 'primary' | 'accent' | 'warn' {
  if (percentage >= 100) return 'warn';
  if (percentage >= 90) return 'accent';
  return 'primary';
}
