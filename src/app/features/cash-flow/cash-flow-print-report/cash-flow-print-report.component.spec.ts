import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { CashFlowPrintReportComponent } from './cash-flow-print-report.component';
import { buildExportMonthRows } from '../../../utils/cash-flow-export.util';

describe('CashFlowPrintReportComponent', () => {
  let fixture: ComponentFixture<CashFlowPrintReportComponent>;
  let component: CashFlowPrintReportComponent;

  const rows = buildExportMonthRows([
    {
      month: new Date(2026, 9, 1), rowColor: '#fee2e2', startingBalance: 1000, income: 5000, mortgagePayment: 2000,
      endingBalance: 2500, regularExpenses: [{ description: 'מזון', amount: 1500, category: 'FOOD' }],
    },
    { month: new Date(2026, 10, 1), startingBalance: 2500, income: 5000, endingBalance: 7500 },
  ]);

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CashFlowPrintReportComponent, TranslateModule.forRoot()] });
    fixture = TestBed.createComponent(CashFlowPrintReportComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();
  });

  it('summarizes the period: opening, income, expenses, net and closing balance', () => {
    expect(component.summary()).toEqual(jasmine.objectContaining({
      months: 2, opening: 1000, totalIncome: 10000, totalExpenses: 3500, net: 6500, closing: 7500,
    }));
  });

  it('renders one table row per month with its status color, plus a totals row', () => {
    const bodyRows = fixture.nativeElement.querySelectorAll('.report-table tbody tr');
    expect(bodyRows.length).toBe(2);
    expect(bodyRows[0].getAttribute('data-row-color')).toBe('red');
    expect(bodyRows[1].hasAttribute('data-row-color')).toBeFalse();
    expect(fixture.nativeElement.querySelectorAll('.report-table tfoot tr').length).toBe(1);
  });

  it('lists details only for months that have items', () => {
    expect(component.details().length).toBe(1);
    expect(component.details()[0].lists.map(l => [l.kind, l.total])).toEqual([['regular', 1500]]);
    expect(fixture.nativeElement.querySelectorAll('.month-card').length).toBe(1);
  });
});
