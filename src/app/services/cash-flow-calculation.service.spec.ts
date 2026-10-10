import { TestBed } from '@angular/core/testing';
import { CashFlowCalculationService, MonthValues } from './cash-flow-calculation.service';

describe('CashFlowCalculationService', () => {
  let service: CashFlowCalculationService;

  const month: MonthValues = {
    startingBalance: 10000,
    income: 20000,
    additionalIncomes: [{ amount: 500 }, { amount: '250' }],
    mortgagePayment: 6000,
    loanPayment: 1000,
    installmentsPayment: 300,
    regularExpenses: [{ amount: 4000 }, { amount: null }],
    specialExpenses: [{ amount: 1200 }]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CashFlowCalculationService);
  });

  it('sums amounts and ignores empty / invalid values', () => {
    expect(service.sumAmounts([{ amount: 1 }, { amount: '2' }, { amount: null }, { amount: 'x' }])).toBe(3);
    expect(service.sumAmounts(null)).toBe(0);
  });

  it('computes income, expenses and the ending balance', () => {
    expect(service.totalIncome(month)).toBe(20750);
    expect(service.totalExpenses(month)).toBe(12500);
    expect(service.endingBalance(10000, month)).toBe(18250);
  });

  it('treats a month with no lists as zero expenses', () => {
    expect(service.totalExpenses({ income: 100 })).toBe(0);
    expect(service.endingBalance(5, { income: 100 })).toBe(105);
  });

  it('bar width is a percentage of the max and never divides by zero', () => {
    expect(service.calculateBarWidth(50, 200)).toBe(25);
    expect(service.calculateBarWidth(50, 0)).toBe(0);
  });

  it('month string round trip keeps the first of the month', () => {
    const str = service.toMonthString(new Date(2026, 2, 15));
    expect(str).toBe('2026-03-01T00:00:00.000Z');
    const back = service.fromMonthString(str);
    expect(back.getFullYear()).toBe(2026);
    expect(back.getMonth()).toBe(2);
    expect(back.getDate()).toBe(1);
  });
});
