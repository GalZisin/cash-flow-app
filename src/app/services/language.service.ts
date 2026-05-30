import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
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
      link.href = isRtl
        ? 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.rtl.min.css'
        : 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
    }
  }
}
