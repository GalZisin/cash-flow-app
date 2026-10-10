import {
  addMonths, aggregatePoints, buildPoints, filterByRange, FlowPoint, formatMoney, movingAverage,
  niceTicks, projectPoints, summarize,
} from './cash-flow-chart.util';

const point = (key: string, income: number, expenses: number, balance: number, kind: FlowPoint['kind'] = 'actual'): FlowPoint =>
  ({ key, income, expenses, net: income - expenses, balance, kind });

describe('cash-flow-chart.util', () => {
  it('addMonths crosses year boundaries both ways', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-05', 0)).toBe('2026-05');
  });

  it('buildPoints sorts, dedupes by month and marks actual vs planned', () => {
    const points = buildPoints([
      { month: '2026-12-01', income: 10, expenses: 4, endingBalance: 100 },
      { month: '2026-09', income: 5, expenses: 9, endingBalance: 50 },
      { month: '2026-12', income: 20, expenses: 5, endingBalance: 115 },
      { month: 'bad', income: 1, expenses: 1, endingBalance: 1 },
    ], '2026-10');

    expect(points.map(p => p.key)).toEqual(['2026-09', '2026-12']);
    expect(points[0]).toEqual({ key: '2026-09', income: 5, expenses: 9, net: -4, balance: 50, kind: 'actual' });
    expect(points[1].income).toBe(20);
    expect(points[1].kind).toBe('planned');
  });

  it('projectPoints continues from the last balance using the basis average and growth', () => {
    const points = [point('2026-01', 1000, 400, 5000), point('2026-02', 3000, 600, 7400)];

    const flat = projectPoints(points, { years: 1, incomeGrowthPct: 0, expenseGrowthPct: 0, basisMonths: 2 });
    expect(flat.length).toBe(12);
    expect(flat[0]).toEqual({ key: '2026-03', income: 2000, expenses: 500, net: 1500, balance: 8900, kind: 'projected' });
    expect(flat[11].key).toBe('2027-02');
    expect(flat[11].balance).toBe(7400 + 12 * 1500);

    const grown = projectPoints(points, { years: 1, incomeGrowthPct: 12, expenseGrowthPct: 0, basisMonths: 1 });
    // after 12 months the monthly income has grown by the full annual rate
    expect(grown[11].income).toBeCloseTo(3000 * 1.12, 1);
    expect(grown[11].expenses).toBe(600);
  });

  it('projectPoints returns nothing for zero years or no data', () => {
    const opts = { years: 0, incomeGrowthPct: 0, expenseGrowthPct: 0, basisMonths: 12 };
    expect(projectPoints([point('2026-01', 1, 1, 1)], opts)).toEqual([]);
    expect(projectPoints([], { ...opts, years: 5 })).toEqual([]);
  });

  it('filterByRange keeps the trailing window ending at the current month and everything after', () => {
    const points = ['2024-10', '2025-10', '2025-11', '2026-10', '2027-03'].map(k => point(k, 0, 0, 0));
    expect(filterByRange(points, '1y', '2026-10').map(p => p.key)).toEqual(['2025-11', '2026-10', '2027-03']);
    expect(filterByRange(points, 'all', '2026-10').length).toBe(5);
  });

  it('aggregatePoints sums flows, keeps the period-end balance and the last kind', () => {
    const points = [
      point('2026-01', 100, 50, 1050),
      point('2026-02', 100, 150, 1000),
      point('2026-04', 200, 100, 1100),
      point('2026-05', 200, 100, 1200, 'projected'),
    ];

    const quarters = aggregatePoints(points, 'quarter');
    expect(quarters.map(b => b.key)).toEqual(['2026-Q1', '2026-Q2']);
    expect(quarters[0]).toEqual(jasmine.objectContaining({ income: 200, expenses: 200, net: 0, balance: 1000, months: 2, kind: 'actual', sub: 1 }));
    expect(quarters[1]).toEqual(jasmine.objectContaining({ net: 200, balance: 1200, kind: 'projected', savingsRate: 0.5 }));

    const years = aggregatePoints(points, 'year');
    expect(years.length).toBe(1);
    expect(years[0].income).toBe(600);

    expect(aggregatePoints(points, 'month').length).toBe(4);
  });

  it('summarize averages only non-projected months', () => {
    const points = [
      point('2026-09', 1000, 600, 400),
      point('2026-10', 3000, 1400, 2000),
      point('2026-11', 9999, 0, 12000, 'projected'),
    ];
    const s = summarize(points, '2026-10');
    expect(s.months).toBe(2);
    expect(s.avgIncome).toBe(2000);
    expect(s.avgExpenses).toBe(1000);
    expect(s.avgNet).toBe(1000);
    expect(s.savingsRate).toBe(0.5);
    expect(s.balanceNow).toBe(2000);
    expect(s.balanceEnd).toBe(12000);
    expect(s.endKey).toBe('2026-11');
  });

  it('summarize handles empty input', () => {
    const s = summarize([], '2026-10');
    expect(s.avgIncome).toBe(0);
    expect(s.savingsRate).toBeNull();
    expect(s.balanceNow).toBeNull();
    expect(s.balanceEnd).toBeNull();
  });

  it('formatMoney puts the minus before the shekel sign and drops agorot', () => {
    expect(formatMoney(-6135.4, 'en-US')).toBe('-₪6,135');
    expect(formatMoney(1200, 'he-IL')).toBe('₪1,200');
    expect(formatMoney(null, 'he-IL')).toBe('—');
  });

  it('movingAverage uses a shorter window at the start', () => {
    expect(movingAverage([3, 6, 9, 12], 3)).toEqual([3, 4.5, 6, 9]);
  });

  it('niceTicks covers the range with round steps, including negatives', () => {
    expect(niceTicks(0, 9500, 5)).toEqual([0, 2000, 4000, 6000, 8000, 10000]);
    const t = niceTicks(-3200, 7000, 5);
    expect(t[0]).toBeLessThanOrEqual(-3200);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(7000);
    expect(t).toContain(0);
    expect(niceTicks(0, 0)).toEqual([0, 1]);
  });
});
