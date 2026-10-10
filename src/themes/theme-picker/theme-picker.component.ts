import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal, viewChildren } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeService } from '../../app/services/theme.service';
import { LanguageService } from '../../app/services/language.service';
import { ThemeDefinition, ThemeMode } from '../theme.registry';

/**
 * Navbar button that opens the theme menu: pick a color theme and light/dark mode.
 * Keyboard: Enter/Space opens, Arrow Up/Down moves, Enter selects, Escape closes.
 */
@Component({
  selector: 'app-theme-picker',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './theme-picker.component.html',
  styleUrl: './theme-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemePickerComponent {
  readonly theme = inject(ThemeService);
  readonly lang = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly options = viewChildren<ElementRef<HTMLButtonElement>>('option');

  readonly open = signal(false);

  toggle(): void {
    this.open() ? this.close() : this.openMenu();
  }

  openMenu(): void {
    this.open.set(true);
    // focus the selected theme once the menu is rendered
    queueMicrotask(() => {
      const index = this.theme.themes.findIndex(t => t.id === this.theme.themeId());
      this.options()[Math.max(0, index)]?.nativeElement.focus();
    });
  }

  close(focusButton = false): void {
    this.open.set(false);
    if (focusButton) this.host.nativeElement.querySelector<HTMLButtonElement>('.theme-picker-btn')?.focus();
  }

  select(t: ThemeDefinition): void {
    this.theme.setTheme(t.id);
  }

  setMode(mode: ThemeMode): void {
    this.theme.setMode(mode);
  }

  name(t: ThemeDefinition): string {
    return this.lang.current === 'en' ? t.name.en : t.name.he;
  }

  description(t: ThemeDefinition): string {
    return this.lang.current === 'en' ? t.description.en : t.description.he;
  }

  onMenuKeydown(event: KeyboardEvent): void {
    const items = this.options().map(o => o.nativeElement);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(current + step + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault(); items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault(); items[items.length - 1]?.focus();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close(true);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }
}
