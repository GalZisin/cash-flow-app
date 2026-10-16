import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { CashFlowPdfDialogComponent, ReportMonthOption } from './cash-flow-pdf-dialog.component';
import { ReportOptions } from '../../../utils/cash-flow-report.util';

const MONTHS: ReportMonthOption[] = ['2026-01', '2026-02', '2026-03', '2026-04'].map(key => ({ key, label: key }));

describe('CashFlowPdfDialogComponent', () => {
  let fixture: ComponentFixture<CashFlowPdfDialogComponent>;
  let component: CashFlowPdfDialogComponent;

  function create(initial: ReportOptions | null = null) {
    TestBed.configureTestingModule({ imports: [CashFlowPdfDialogComponent, TranslateModule.forRoot()] });
    fixture = TestBed.createComponent(CashFlowPdfDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('months', MONTHS);
    fixture.componentRef.setInput('initial', initial);
    fixture.detectChanges();
  }

  it('starts with the whole period and everything included', () => {
    create();
    expect(component.form.getRawValue()).toEqual({ from: '2026-01', to: '2026-04', includeCharts: true, includeDetails: true });
    expect(component.selectedCount()).toBe(4);
    expect(component.activePreset()).toBe('all');
  });

  it('restores the previous choice', () => {
    create({ from: '2026-02', to: '2026-03', includeCharts: false, includeDetails: true });
    expect(component.form.getRawValue().from).toBe('2026-02');
    expect(component.form.getRawValue().includeCharts).toBeFalse();
    expect(component.selectedCount()).toBe(2);
  });

  it('emits the selected range and options', () => {
    create();
    const emitted: ReportOptions[] = [];
    component.confirmed.subscribe(o => emitted.push(o));
    component.form.patchValue({ from: '2026-02', to: '2026-03', includeDetails: false });
    component.submit();
    expect(emitted).toEqual([{ from: '2026-02', to: '2026-03', includeCharts: true, includeDetails: false }]);
  });

  it('blocks a range whose start is after its end', () => {
    create();
    const emitted: ReportOptions[] = [];
    component.confirmed.subscribe(o => emitted.push(o));
    component.form.patchValue({ from: '2026-04', to: '2026-02' });
    fixture.detectChanges();
    expect(component.invalidRange()).toBeTrue();
    component.submit();
    expect(emitted.length).toBe(0);
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
  });
});
