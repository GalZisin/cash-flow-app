import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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
});
