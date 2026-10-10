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
});
