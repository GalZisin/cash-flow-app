import { Injectable, Inject, DOCUMENT } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private _lang = new BehaviorSubject<'he' | 'en'>('he');
  lang$ = this._lang.asObservable();

  constructor(
    private translate: TranslateService,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.translate.setDefaultLang('he');
    this.translate.use('he');
    this.document.documentElement.dir = 'rtl';
    this.document.documentElement.lang = 'he';
  }

  get current() { return this._lang.value; }
  get isRtl() { return this._lang.value === 'he'; }

  toggle() {
    const next = this._lang.value === 'he' ? 'en' : 'he';
    this._lang.next(next);
    this.translate.use(next);
    const isRtl = next === 'he';
    this.document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    this.document.documentElement.lang = next;
    const link = this.document.getElementById('bootstrap-css') as HTMLLinkElement | null;
    if (link) {
      // Both files are built from node_modules as named style bundles (angular.json), so this works offline.
      link.href = isRtl ? 'bootstrap-rtl.css' : 'bootstrap-ltr.css';
    }
  }
}
