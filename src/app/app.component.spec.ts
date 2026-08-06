import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: TranslateService,
          useValue: {
            currentLang: 'he',
            use: jasmine.createSpy('use'),
            get: jasmine.createSpy('get').and.returnValue({ subscribe: () => undefined }),
            setDefaultLang: jasmine.createSpy('setDefaultLang'),
            onLangChange: { subscribe: () => undefined },
            onTranslationChange: { subscribe: () => undefined },
            onDefaultLangChange: { subscribe: () => undefined },
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
