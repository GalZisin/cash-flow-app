import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { MonthData } from '../../../models/cash-flow.model';
import { CashFlowChartsComponent } from './cash-flow-charts.component';
import { barPath } from './cash-flow-chart.component';

function months(count: number): MonthData[] {
  let balance = 10000;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(2025, i, 1);
    balance += 2000;
    return {
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      startingBalance: balance - 2000,
      income: 10000,
      regularExpenses: [{ description: 'x', amount: 8000, category: 'OTHER' as any }],
      endingBalance: balance,
    };
  });
}

describe('CashFlowChartsComponent', () => {
  let fixture: ComponentFixture<CashFlowChartsComponent>;
  let component: CashFlowChartsComponent;

  beforeEach(async () => {
    try { localStorage.removeItem('cf-charts-settings'); } catch { /* ignore */ }
    await TestBed.configureTestingModule({
      imports: [CashFlowChartsComponent, TranslateModule.forRoot()],
    }).compileComponents();
    fixture = TestBed.createComponent(CashFlowChartsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('months', months(24));
    fixture.detectChanges();
  });

  it('adds the projection after the data and aggregates by the selected period', () => {
    component.setRange('all');
    component.setYears(1);
    expect(component.buckets().length).toBe(24 + 12);
    expect(component.buckets().at(-1)!.kind).toBe('projected');

    component.setPeriod('year');
    expect(component.buckets().map(b => b.key)).toEqual(['2025', '2026', '2027']);

    component.setPeriod('quarter');
    expect(component.buckets().length).toBe(12);
  });

  it('summarizes monthly averages and the projected end balance', () => {
    component.setRange('all');
    component.setYears(1);
    const s = component.summary();
    expect(s.avgIncome).toBe(10000);
    expect(s.avgExpenses).toBe(8000);
    expect(s.balanceEnd).toBe(10000 + 24 * 2000 + 12 * 2000);
  });

  it('renders three charts and switches to the table view', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('app-cash-flow-chart').length).toBe(3);
    component.setView('table');
    fixture.detectChanges();
    expect(el.querySelectorAll('app-cash-flow-chart').length).toBe(0);
    expect(el.querySelectorAll('tbody tr').length).toBe(component.buckets().length);
  });
});

describe('barPath', () => {
  it('rounds the data end and keeps the baseline square, for both signs', () => {
    expect(barPath(0, 100, 40, 10)).toBe('M0,100V44Q0,40 4,40H6Q10,40 10,44V100Z');
    expect(barPath(0, 100, 160, 10)).toBe('M0,100V156Q0,160 4,160H6Q10,160 10,156V100Z');
    expect(barPath(0, 100, 100, 10)).toBe('');
  });
});
