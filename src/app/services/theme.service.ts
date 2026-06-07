import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private isDarkSignal = signal<boolean>(localStorage.getItem('theme') === 'dark');
  
  isDarkMode = this.isDarkSignal.asReadonly();

  constructor() {
    this.applyTheme();
  }

  toggleTheme() {
    this.isDarkSignal.set(!this.isDarkSignal());
    localStorage.setItem('theme', this.isDarkSignal() ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme() {
    if (this.isDarkSignal()) {
      document.documentElement.classList.add('dark-mode');
      document.documentElement.setAttribute('data-bs-theme', 'dark'); // תמיכה ב-Bootstrap 5.3+
    } else {
      document.documentElement.classList.remove('dark-mode');
      document.documentElement.setAttribute('data-bs-theme', 'light');
    }
  }
}