import { buildYearlyXirrChart } from './yearly-xirr-chart.util';

describe('buildYearlyXirrChart', () => {
  it('centers each bar in its year band', () => {
    const c = buildYearlyXirrChart([
      { year: 2024, value: 10, profit: 100 },
      { year: 2025, value: 5, profit: 50 },
    ]);
    const plotW = c.width - c.margin.left - c.margin.right;
    expect(c.bars[0].cx).toBeCloseTo(c.margin.left + plotW / 4);
    expect(c.bars[1].cx).toBeCloseTo(c.margin.left + plotW * 3 / 4);
  });

  it('always includes a zero tick and keeps negative bars below it inside the plot', () => {
    const c = buildYearlyXirrChart([
      { year: 2024, value: 12, profit: null },
      { year: 2025, value: -8, profit: null },
    ]);
    expect(c.ticks.some(t => t.y === c.zeroY)).toBeTrue();
    expect(c.bars[1].positive).toBeFalse();
    expect(c.bars[1].labelY).toBeGreaterThan(c.zeroY);
    expect(c.bars[1].labelY).toBeLessThanOrEqual(c.height - c.margin.bottom + 14);
    expect(c.bars[0].labelY).toBeLessThan(c.zeroY);
  });

  it('draws no bar for a missing value and caps bar width', () => {
    const c = buildYearlyXirrChart([{ year: 2025, value: null, profit: null }]);
    expect(c.bars[0].d).toBe('');
    expect(c.barWidth).toBeLessThanOrEqual(44);
  });
});
