import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { httpInterceptor } from './interceptors/http.interceptor';
import { TranslateModule } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { MAT_TOOLTIP_DEFAULT_OPTIONS } from '@angular/material/tooltip';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([httpInterceptor])),
    provideAnimations(),
    importProvidersFrom(TranslateModule.forRoot()),
    provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' }),
    { provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: { showDelay: 300, hideDelay: 100, touchendHideDelay: 100 } }
  ]
};
