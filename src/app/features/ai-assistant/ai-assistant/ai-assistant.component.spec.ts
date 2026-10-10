import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { AiAssistantComponent } from './ai-assistant.component';

describe('AiAssistantComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiAssistantComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  // Regression: effect() used to be called inside ngOnInit -> NG0203 and loadDashboardData() never ran.
  it('ngOnInit does not throw and loads the dashboard data', () => {
    const component = TestBed.createComponent(AiAssistantComponent).componentInstance;
    expect(() => component.ngOnInit()).not.toThrow();

    const urls = http.match(() => true).map(r => r.request.url);
    expect(urls.some(u => u.includes('installments'))).toBeTrue();
    expect(urls.some(u => u.includes('investments'))).toBeTrue();
  });

  it('loadInsights posts the dashboard snapshot and shows typed insights + archive status', () => {
    const component = TestBed.createComponent(AiAssistantComponent).componentInstance;
    component.totalInvestmentsValue.set(45000);
    component.totalActiveInstallments.set(2);
    component.aiResponseLang.set('en');

    component.loadInsights();
    const req = http.expectOne(r => r.url.endsWith('/ai/insights'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.lang).toBe('en');
    expect(req.request.body.dashboard.kpis.totalInvestments).toBe(45000);
    expect(req.request.body.dashboard.kpis.activeInstallments).toBe(2);
    expect(component.insightsLoading()).toBeTrue();

    req.flush({ model: 'm', archived: true, report: { id: 'r', createdAt: 'x' }, insights: [{ type: 'risk', title: 'T', text: 'X' }] });
    expect(component.insightsLoading()).toBeFalse();
    expect(component.insights()[0].type).toBe('risk');
    expect(component.insightsArchived()).toBeTrue();
    expect(component.insightIcon('risk')).toBe('bi-shield-exclamation');
  });

  it('loadInsights shows the server error instead of an empty list', () => {
    const component = TestBed.createComponent(AiAssistantComponent).componentInstance;
    component.loadInsights();
    http.expectOne(r => r.url.endsWith('/ai/insights')).flush(
      { success: false, error: { name: 'ServiceUnavailableError', message: 'AI_API_KEY is not set' } },
      { status: 503, statusText: 'Service Unavailable' }
    );
    expect(component.insightsError()).toBe('AI_API_KEY is not set');
    expect(component.insights().length).toBe(0);
  });
});
