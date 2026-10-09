import { budgetProgressColor, formatBudgetCurrency } from './budget-format';

describe('budget-format', () => {
  it('formats whole shekels', () => {
    const text = formatBudgetCurrency(1234.6);
    expect(text).toContain('1,235');
    expect(text).toContain('₪');
  });

  it('maps usage to a progress color', () => {
    expect(budgetProgressColor(50)).toBe('primary');
    expect(budgetProgressColor(90)).toBe('accent');
    expect(budgetProgressColor(100)).toBe('warn');
  });
});
