import { buildExportMonthRows, ExportMonthInput } from './cash-flow-export.util';
import {
  barPath, buildBalanceChart, buildExpenseBreakdown, buildIncomeExpenseChart, buildSavingsChart,
  compactMoney, filterRowsByRange, presetRange, REPORT_CHART_BOX, reportFileName, summarizeRange,
} from './cash-flow-report.util';

const month = (y: number, m: number, extra: Partial<ExportMonthInput> = {}): ExportMonthInput => ({
  month: new Date(y, m - 1, 1), income: 10000, ...extra,
});

const rows = buildExportMonthRows([
  month(2026, 1, { startingBalance: 1000, mortgagePayment: 3000, endingBalance: 8000 }),
  month(2026, 2, {
    startingBalance: 8000, loanPayment: 500, installmentsPayment: 200, endingBalance: 12300,
    regularExpenses: [{ description: 'מזון', amount: 4000, category: 'FOOD' }, { description: 'דלק', amount: 1000, category: 'CAR' }],
  }),
  month(2026, 3, {
    startingBalance: 12300, income: 2000, endingBalance: 9300,
    specialExpenses: [{ description: 'חופשה', amount: 5000, category: 'VACATION' }],
  }),
]);

describe('cash-flow-report.util', () => {
  it('filterRowsByRange keeps both ends of the range', () => {
    expect(filterRowsByRange(rows, { from: '2026-02', to: '2026-03' }).length).toBe(2);
    expect(filterRowsByRange(rows, { from: '2026-02', to: '2026-02' })[0].startingBalance).toBe(8000);
    expect(filterRowsByRange(rows, null).length).toBe(3);
  });

  it('reportFileName names the PDF after the first and last month of the report', () => {
    expect(reportFileName(rows)).toBe('cash-flow-report-2026-01_2026-03');
    expect(reportFileName([rows[2], rows[0]])).toBe('cash-flow-report-2026-01_2026-03');
    expect(reportFileName(filterRowsByRange(rows, { from: '2026-02', to: '2026-02' }))).toBe('cash-flow-report-2026-02');
    expect(reportFileName([])).toBe('cash-flow-report');
  });

  it('presetRange clips the wanted range to the months that exist', () => {
    const keys = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03'];
    const today = new Date(2026, 1, 10);
    expect(presetRange('all', keys, today)).toEqual({ from: '2025-11', to: '2026-03' });
    expect(presetRange('currentYear', keys, today)).toEqual({ from: '2026-01', to: '2026-03' });
    expect(presetRange('last12', keys, today)).toEqual({ from: '2025-11', to: '2026-02' });
    expect(presetRange('next12', keys, today)).toEqual({ from: '2026-02', to: '2026-03' });
    expect(presetRange('next12', keys, new Date(2030, 0, 1))).toBeNull();
    expect(presetRange('all', [])).toBeNull();
  });

  it('summarizeRange computes everything on the selected months only', () => {
    const s = summarizeRange(filterRowsByRange(rows, { from: '2026-02', to: '2026-03' }));
    expect(s.months).toBe(2);
    expect(s.opening).toBe(8000);
    expect(s.closing).toBe(9300);
    expect(s.totalIncome).toBe(12000);
    // 500 + 200 + 4000 + 1000 + 5000
    expect(s.totalExpenses).toBe(10700);
    expect(s.net).toBe(1300);
    expect(s.avgIncome).toBe(6000);
    expect(s.savingsRate).toBeCloseTo(1300 / 12000, 6);
  });

  it('summarizeRange of an empty range is all zeros', () => {
    expect(summarizeRange([])).toEqual(jasmine.objectContaining({ months: 0, opening: 0, closing: 0, savingsRate: 0, avgNet: 0 }));
  });

  it('buildExpenseBreakdown groups fixed payments and categories, sorted, shares sum to 1', () => {
    const slices = buildExpenseBreakdown(rows);
    expect(slices.map(s => s.key)).toEqual(['cat:VACATION', 'cat:FOOD', 'mortgage', 'cat:CAR', 'loans', 'installments']);
    expect(slices[0].labelKey).toBe('CATEGORIES.VACATION');
    expect(slices.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 6);
  });

  it('buildExpenseBreakdown folds the smallest slices into "rest" past the limit', () => {
    const slices = buildExpenseBreakdown(rows, 3);
    expect(slices.map(s => s.key)).toEqual(['cat:VACATION', 'cat:FOOD', 'rest']);
    // mortgage 3000 + car 1000 + loans 500 + installments 200
    expect(slices[2].amount).toBe(4700);
  });

  it('buildIncomeExpenseChart puts one income and one expense bar per month on a zero baseline', () => {
    const chart = buildIncomeExpenseChart(rows);
    expect(chart.groups.length).toBe(3);
    expect(chart.ticks[0].value).toBe(0);
    expect(chart.zeroY).toBe(REPORT_CHART_BOX.height - REPORT_CHART_BOX.bottom);
    const g = chart.groups[1];
    expect(g.expenses.x).toBeCloseTo(g.income.x + g.income.width + 2, 6);
    expect(g.income.height).toBeGreaterThan(g.expenses.height);
  });

  it('buildSavingsChart draws negative months below the zero line', () => {
    const chart = buildSavingsChart(rows);
    const march = chart.bars[2];
    expect(march.negative).toBeTrue();
    expect(march.y).toBeCloseTo(chart.zeroY, 6);
    expect(chart.bars[0].y + chart.bars[0].height).toBeCloseTo(chart.zeroY, 6);
  });

  it('buildBalanceChart labels the first, last, min and max points', () => {
    const chart = buildBalanceChart(rows);
    expect(chart.points.length).toBe(3);
    expect(chart.line.startsWith('M')).toBeTrue();
    expect(chart.labeled.map(p => p.value)).toEqual([8000, 12300, 9300]);
    expect(chart.labeled[0].anchor).toBe('start');
    expect(chart.labeled[2].anchor).toBe('end');
    expect(buildBalanceChart([]).line).toBe('');
  });

  it('buildBalanceChart drops a key-point label that would overlap a kept one', () => {
    const many = buildExportMonthRows(
      [100, 98, 150, 140, 130, 120, 110, 105, 104, 103, 102, 101].map((v, i) => month(2026, i + 1, { endingBalance: v * 1000 }))
    );
    const chart = buildBalanceChart(many);
    // first (100K) and min (98K) are neighbours at almost the same height: the min label is dropped
    expect(chart.labeled.map(p => p.value)).toEqual([100000, 150000, 101000]);
  });

  it('barPath is empty for a zero bar and closes on the baseline', () => {
    expect(barPath(0, 100, 100, 10)).toBe('');
    const path = barPath(0, 40, 100, 10);
    expect(path.startsWith('M0,100')).toBeTrue();
    expect(path.endsWith('L10,100 Z')).toBeTrue();
  });

  it('compactMoney shortens axis labels', () => {
    expect(compactMoney(0)).toBe('0');
    expect(compactMoney(850)).toBe('850');
    expect(compactMoney(2500)).toBe('2.5K');
    expect(compactMoney(25000)).toBe('25K');
    expect(compactMoney(-1200000)).toBe('-1.2M');
  });
});
