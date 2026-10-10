import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from './services/language.service';
import { ThemeService } from './services/theme.service';
import { ThemePickerComponent } from '../themes/theme-picker/theme-picker.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TranslateModule, RouterLink, RouterLinkActive, RouterOutlet, ThemePickerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  readonly router = inject(Router);

  constructor(public lang: LanguageService, public theme: ThemeService) { }

  get noScroll(): boolean {
    return !this.router.url.startsWith('/investments');
  }
}
