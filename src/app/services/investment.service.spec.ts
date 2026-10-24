import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { InvestmentService } from './investment.service';
import { Investment, Snapshot, Transaction } from '../models/investment.model';

function makeInvestment(snapshots: Snapshot[], transactions: Transaction[]): Investment {
  return { id: 'inv1', name: 'Pension', type: 'pension', snapshots, transactions };
}

const monthlyDeposits = (from: string[], amount = 2380): Transaction[] =>
  from.map(date => ({ date, amount, type: 'deposit' as const }));

describe('InvestmentService.xirrByYear', () => {
  let service: InvestmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(InvestmentService);
  });

  // הנתונים שגרמו ל-36,933,473,896.9% בשנה הראשונה
  const pension = makeInvestment(
    [
      { date: '2025-10-28', value: 186500 },
      { date: '2026-01-28', value: 194800 },
      { date: '2026-04-28', value: 199300 },
      { date: '2026-07-28', value: 210600 },
      { date: '2026-10-28', value: 218900 },
    ],
    monthlyDeposits([
      '2025-10-15', '2025-11-15', '2025-12-15', '2026-01-15', '2026-02-15', '2026-03-15',
      '2026-04-15', '2026-05-15', '2026-06-15', '2026-07-15', '2026-08-15', '2026-09-15',
    ])
  );

  it('returns null for a first year with a single snapshot instead of treating the opening balance as profit', () => {
    const y2025 = service.xirrByYear(pension).find(y => y.year === 2025)!;
    expect(y2025.value).toBeNull();
    expect(y2025.profit).toBeNull();
  });

  it('measures a year from the previous year-end snapshot to the last snapshot of the year', () => {
    const y2026 = service.xirrByYear(pension).find(y => y.year === 2026)!;
    // 218,900 - 186,500 - 11 deposits after 28/10/2025 (2 in 2025 + 9 in 2026)
    expect(y2026.profit).toBe(218900 - 186500 - 11 * 2380);
    expect(y2026.value!).toBeGreaterThan(2);
    expect(y2026.value!).toBeLessThan(5);
  });

  it('computes the first year from its first snapshot when it has more than one', () => {
    const inv = makeInvestment(
      [{ date: '2025-01-01', value: 100000 }, { date: '2026-01-01', value: 110000 }],
      []
    );
    // only one snapshot in each year: 2025 has no window, 2026 spans a full year at +10%
    const [y2025, y2026] = service.xirrByYear(inv);
    expect(y2025.value).toBeNull();
    expect(y2026.value!).toBeCloseTo(10, 1);
    expect(y2026.profit).toBe(10000);

    const sameYear = makeInvestment(
      [{ date: '2025-01-01', value: 100000 }, { date: '2025-12-31', value: 105000 }],
      []
    );
    const [only] = service.xirrByYear(sameYear);
    expect(only.value!).toBeCloseTo(5, 0);
    expect(only.profit).toBe(5000);
  });

  it('counts withdrawals as money out and ignores transactions outside the window', () => {
    const inv = makeInvestment(
      [{ date: '2025-06-30', value: 50000 }, { date: '2026-06-30', value: 46000 }],
      [
        { date: '2025-03-01', amount: 9999, type: 'deposit' },   // before the opening snapshot
        { date: '2025-12-31', amount: 5000, type: 'withdraw' },
      ]
    );
    const y2026 = service.xirrByYear(inv).find(y => y.year === 2026)!;
    expect(y2026.profit).toBe(46000 - 50000 + 5000);
    expect(y2026.value!).toBeGreaterThan(0);
  });

  it('drops absurd results instead of passing them to the chart', () => {
    const inv = makeInvestment(
      [{ date: '2025-01-01', value: 100 }, { date: '2025-01-15', value: 100000 }],
      []
    );
    expect(service.xirrByYear(inv)[0].value).toBeNull();
  });
});

describe('InvestmentService.periodReturns', () => {
  let service: InvestmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(InvestmentService);
  });

  it('separates deposits from profit so a small opening value does not inflate the return', () => {
    const inv = makeInvestment(
      [{ date: '2021-12-31', value: 233 }, { date: '2022-12-31', value: 11143 }],
      monthlyDeposits(['2022-01-01', '2022-04-01', '2022-07-01', '2022-10-01'], 3172)
    );
    const [first, p] = service.periodReturns(inv);
    expect(first).toBeNull();
    expect(p!.deposits).toBe(12688);
    expect(p!.profit).toBe(-1778);
    expect(p!.valueChangePct!).toBeCloseTo(4682.4, 1);
    // invested ≈ 233 + 3172 × (1 + 0.75 + 0.5 + 0.25) ≈ 8163
    expect(p!.returnPct!).toBeCloseTo(-21.8, 0);
  });

  it('weights a deposit by the part of the period it was invested', () => {
    const inv = makeInvestment(
      [{ date: '2025-01-01', value: 1000 }, { date: '2025-01-11', value: 2100 }],
      [{ date: '2025-01-06', amount: 1000, type: 'deposit' }]
    );
    const p = service.periodReturns(inv)[1]!;
    expect(p.profit).toBe(100);
    expect(p.returnPct!).toBeCloseTo(100 / 1500 * 100, 6);
  });

  it('counts withdrawals as negative deposits and ignores transactions outside the period', () => {
    const inv = makeInvestment(
      [{ date: '2025-01-01', value: 1000 }, { date: '2026-01-01', value: 700 }],
      [
        { date: '2024-06-01', amount: 999, type: 'deposit' },
        { date: '2026-01-01', amount: 400, type: 'withdraw' },
      ]
    );
    const p = service.periodReturns(inv)[1]!;
    expect(p.deposits).toBe(-400);
    expect(p.profit).toBe(100);
    expect(p.returnPct!).toBeCloseTo(10, 6);
  });

  it('returns null return when nothing was invested', () => {
    const inv = makeInvestment([{ date: '2025-01-01', value: 0 }, { date: '2025-06-01', value: 0 }], []);
    const p = service.periodReturns(inv)[1]!;
    expect(p.returnPct).toBeNull();
    expect(p.valueChangePct).toBeNull();
  });
});

describe('InvestmentService.toCurrency', () => {
  let service: InvestmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(InvestmentService);
  });

  it('converts USD snapshots and transactions into ILS and back to USD accurately', () => {
    const stock: Investment = {
      id: 'stock1',
      name: 'Apple',
      type: 'stock',
      currency: 'USD',
      snapshots: [
        { date: '2025-01-01', value: 3700, currency: 'USD', currencyAmount: 1000, exchangeRate: 3.7 },
        { date: '2026-01-01', value: 5550, currency: 'USD', currencyAmount: 1500, exchangeRate: 3.7 }
      ],
      transactions: [
        { date: '2025-06-01', amount: 370, currency: 'USD', currencyAmount: 100, exchangeRate: 3.7, type: 'deposit' }
      ]
    };

    const inUsd = service.toCurrency(stock, 'USD');
    expect(inUsd.snapshots[0].value).toBe(1000);
    expect(inUsd.snapshots[1].value).toBe(1500);
    expect(inUsd.transactions[0].amount).toBe(100);

    const periodReturnUsd = service.periodReturns(inUsd)[1]!;
    // Profit in USD: 1500 - 1000 - 100 = 400
    expect(periodReturnUsd.profit).toBe(400);

    const inIls = service.toCurrency(stock, 'ILS');
    expect(inIls.snapshots[0].value).toBe(3700);
    expect(inIls.snapshots[1].value).toBe(5550);
    expect(inIls.transactions[0].amount).toBe(370);

    const periodReturnIls = service.periodReturns(inIls)[1]!;
    // Profit in ILS: 5550 - 3700 - 370 = 1480 (which is 400 * 3.7)
    expect(periodReturnIls.profit).toBe(1480);
  });
});

