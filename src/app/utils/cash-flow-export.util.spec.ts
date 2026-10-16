import {
  buildExportDetailRows, buildExportMonthRows, buildExportTotals, exportFileName, ExportMonthInput,
} from './cash-flow-export.util';

const months: ExportMonthInput[] = [
  {
    month: new Date(2026, 9, 15),
    rowColor: '#dcfce7',
    startingBalance: 1000,
    income: '10000',
    mortgagePayment: 3000,
    loanPayment: 500,
    installmentsPayment: 200,
    endingBalance: 6300,
    additionalIncomes: [{ description: ' בונוס ', amount: 1000 }],
    regularExpenses: [
      { description: 'מזון', amount: 1500, category: 'FOOD' },
      { description: 'רכב', amount: '500', category: 'CAR' },
    ],
    specialExpenses: [],
  },
  {
    month: '2026-11-01T00:00:00.000Z',
    startingBalance: 6300,
    income: 10000,
    endingBalance: 15300,
    specialExpenses: [{ description: 'מתנה', amount: 1000, category: null }],
  },
];

describe('cash-flow-export.util', () => {
  it('buildExportMonthRows sums items and computes savings like the table', () => {
    const [oct, nov] = buildExportMonthRows(months);

    expect(oct.month).toEqual(new Date(2026, 9, 1));
    expect(oct.rowColor).toBe('#dcfce7');
    expect(oct.income).toBe(10000);
    expect(oct.additionalIncomes).toBe(1000);
    expect(oct.regularExpenses).toBe(2000);
    expect(oct.specialExpenses).toBe(0);
    // (10000 + 1000) - (3000 + 500 + 200 + 2000 + 0)
    expect(oct.savings).toBe(5300);
    expect(oct.endingBalance).toBe(6300);
    expect(oct.items.additionalIncome[0].description).toBe('בונוס');

    expect(nov.month).toEqual(new Date(2026, 10, 1));
    expect(nov.rowColor).toBeNull();
    expect(nov.mortgagePayment).toBe(0);
    expect(nov.savings).toBe(9000);
  });

  it('buildExportDetailRows lists every item by month, then kind', () => {
    const details = buildExportDetailRows(buildExportMonthRows(months));

    expect(details.map(d => [d.kind, d.description, d.amount])).toEqual([
      ['additionalIncome', 'בונוס', 1000],
      ['regular', 'מזון', 1500],
      ['regular', 'רכב', 500],
      ['special', 'מתנה', 1000],
    ]);
    expect(details[1].category).toBe('FOOD');
    expect(details[3].rowColor).toBeNull();
  });

  it('buildExportTotals adds up every month', () => {
    const totals = buildExportTotals(buildExportMonthRows(months));

    expect(totals.income).toBe(20000);
    expect(totals.additionalIncomes).toBe(1000);
    expect(totals.specialExpenses).toBe(1000);
    expect(totals.savings).toBe(14300);
  });

  it('exportFileName uses the export date', () => {
    expect(exportFileName(new Date(2026, 0, 5))).toBe('cash-flow-2026-01-05.xlsx');
  });
});
