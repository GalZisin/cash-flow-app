import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { CashFlowDefaultsDialogComponent } from './cash-flow-defaults-dialog.component';
import { environment } from '../../../../environments/environment';

describe('CashFlowDefaultsDialogComponent', () => {
  let fixture: ComponentFixture<CashFlowDefaultsDialogComponent>;
  let component: CashFlowDefaultsDialogComponent;
  let http: HttpTestingController;
  const defaultsUrl = `${environment.apiUrl}/cash-flow-defaults`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CashFlowDefaultsDialogComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()]
    }).compileComponents();

    fixture = TestBed.createComponent(CashFlowDefaultsDialogComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges(); // ngOnInit -> GET defaults
  });

  afterEach(() => http.verify());

  function respondWithDefaults() {
    http.expectOne(defaultsUrl).flush({
      income: 20000, mortgagePayment: 6000, loanPayment: 1000,
      additionalIncomes: [{ description: 'bonus', amount: 500 }],
      regularExpenses: [{ description: 'food', amount: 4000, category: 'FOOD' }],
      specialExpenses: []
    });
    fixture.detectChanges();
  }

  it('shows a loading state until the defaults arrive, then builds the form', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="defaults-loading"]')).not.toBeNull();
    respondWithDefaults();
    expect(component.form).not.toBeNull();
    expect(component.form!.value.income).toBe(20000);
    expect(component.additionalIncomes.length).toBe(1);
    expect(component.regularExpenses.length).toBe(1);
    expect(component.specialExpenses.length).toBe(0);
    expect(fixture.nativeElement.querySelector('[data-testid="defaults-loading"]')).toBeNull();
  });

  it('adds and removes rows', () => {
    respondWithDefaults();
    component.addSpecialExpense();
    component.addRegularExpense();
    component.removeAdditionalIncome(0);
    expect(component.specialExpenses.length).toBe(1);
    expect(component.regularExpenses.length).toBe(2);
    expect(component.additionalIncomes.length).toBe(0);
    expect(component.specialExpenses.at(0).value.category).toBeDefined();
  });

  it('saves the form to the server and emits saved + closed', () => {
    respondWithDefaults();
    const saved: unknown[] = [];
    let closed = 0;
    component.saved.subscribe(v => saved.push(v));
    component.closed.subscribe(() => closed++);

    component.form!.patchValue({ income: 25000 });
    component.save();

    const req = http.expectOne(defaultsUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.income).toBe(25000);
    req.flush(req.request.body);

    expect(saved.length).toBe(1);
    expect(closed).toBe(1);
    expect(component.saving).toBeFalse();
  });

  it('close() only emits closed', () => {
    respondWithDefaults();
    let closed = 0;
    component.closed.subscribe(() => closed++);
    component.close();
    expect(closed).toBe(1);
  });
});
