import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CashFlowService } from '../../../services/cash-flow.service';
import { CashFlowExcelExportService } from '../../../services/cash-flow-excel-export.service';

import { CashFlowTableComponent } from './cash-flow-table.component';

describe('CashFlowTableComponent', () => {
  let component: CashFlowTableComponent;
  let fixture: ComponentFixture<CashFlowTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CashFlowTableComponent, TranslateModule.forRoot()]
    })
      .compileComponents();

    fixture = TestBed.createComponent(CashFlowTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('maps the stored row color hex to a display key', () => {
    expect(component.rowColorKey('#dcfce7')).toBe('green');
    expect(component.rowColorKey('#fef9c3')).toBe('yellow');
    expect(component.rowColorKey('#fee2e2')).toBe('red');
    expect(component.rowColorKey('#123456')).toBeNull();
    expect(component.rowColorKey(null)).toBeNull();
  });

  it('should show the loading state while data is not ready', () => {
    component.isLoading = true;
    fixture.detectChanges();

    const loader = fixture.nativeElement.querySelector('[data-testid="cash-flow-table-loader"]');
    expect(loader).not.toBeNull();
  });

  it('should hide the loading state once data is ready', () => {
    component.isLoading = false;
    fixture.detectChanges();

    const loader = fixture.nativeElement.querySelector('[data-testid="cash-flow-table-loader"]');
    expect(loader).toBeNull();
  });

  it('exports Excel from the saved server data, not from unsaved table edits', async () => {
    const saved = [{ month: '2026-10-01T00:00:00.000Z', startingBalance: 0, income: 9000, mortgagePayment: 0, loanPayment: 0, regularExpenses: [], specialExpenses: [], endingBalance: 9000 }];
    const fetchSaved = spyOn(TestBed.inject(CashFlowService), 'fetchSaved').and.returnValue(of({ months: saved }));
    const exportToFile = spyOn(TestBed.inject(CashFlowExcelExportService), 'exportToFile').and.resolveTo();

    await component.exportExcel();

    expect(fetchSaved).toHaveBeenCalledTimes(1);
    expect(exportToFile).toHaveBeenCalledOnceWith(saved);
    expect(component.isExportingExcel).toBeFalse();
  });
});
