import { Injectable, computed, signal } from '@angular/core';
import { DEFAULT_THEME_ID, THEMES, ThemeDefinition, ThemeMode, findTheme } from '../../themes/theme.registry';

const MODE_KEY = 'theme';        // existing key: 'light' | 'dark' (kept for backwards compatibility)
const THEME_KEY = 'color-theme'; // theme id from src/themes/theme.registry.ts

/**
 * Light/dark mode + color theme.
 *
 * Applies to <html>:
 *  - class `dark-mode` and `data-bs-theme="dark|light"`  (mode; existing behaviour)
 *  - `data-theme="<id>"`                                  (theme; picks the token set in src/themes)
 *
 * Both choices are stored in localStorage. For previews and sharing, `?theme=<id>&mode=dark|light`
 * in the URL overrides the stored values once at startup (and is then stored).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly themes: readonly ThemeDefinition[] = THEMES;

  private readonly modeSignal = signal<ThemeMode>(this.initialMode());
  private readonly themeIdSignal = signal<string>(this.initialThemeId());

  readonly mode = this.modeSignal.asReadonly();
  readonly themeId = this.themeIdSignal.asReadonly();
  readonly isDarkMode = computed(() => this.modeSignal() === 'dark');
  readonly currentTheme = computed(() => findTheme(this.themeIdSignal()) ?? findTheme(DEFAULT_THEME_ID)!);

  constructor() {
    this.apply();
  }

  toggleTheme(): void {
    this.setMode(this.isDarkMode() ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    this.modeSignal.set(mode);
    this.store(MODE_KEY, mode);
    this.apply();
  }

  /** Switches the color theme. Unknown ids are ignored. */
  setTheme(id: string): void {
    if (!findTheme(id)) return;
    this.themeIdSignal.set(id);
    this.store(THEME_KEY, id);
    this.apply();
  }

  private apply(): void {
    const root = document.documentElement;
    const dark = this.isDarkMode();
    root.classList.toggle('dark-mode', dark);
    root.setAttribute('data-bs-theme', dark ? 'dark' : 'light'); // Bootstrap 5.3+
    root.setAttribute('data-theme', this.currentTheme().id);
  }

  private initialMode(): ThemeMode {
    const fromUrl = this.queryParam('mode');
    if (fromUrl === 'dark' || fromUrl === 'light') { this.store(MODE_KEY, fromUrl); return fromUrl; }
    return this.read(MODE_KEY) === 'dark' ? 'dark' : 'light';
  }

  private initialThemeId(): string {
    const fromUrl = this.queryParam('theme');
    if (fromUrl && findTheme(fromUrl)) { this.store(THEME_KEY, fromUrl); return fromUrl; }
    const stored = this.read(THEME_KEY);
    return stored && findTheme(stored) ? stored : DEFAULT_THEME_ID;
  }

  private queryParam(name: string): string | null {
    try { return new URLSearchParams(window.location.search).get(name); } catch { return null; }
  }

  private read(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  private store(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* private mode / storage disabled: theme still works for this session */ }
  }
}
