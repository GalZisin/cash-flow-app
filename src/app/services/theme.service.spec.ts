import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { THEMES, DEFAULT_THEME_ID } from '../../themes/theme.registry';

describe('ThemeService', () => {
  const root = document.documentElement;

  function create(): ThemeService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(ThemeService);
  }

  beforeEach(() => {
    localStorage.removeItem('theme');
    localStorage.removeItem('color-theme');
  });

  afterAll(() => {
    localStorage.removeItem('theme');
    localStorage.removeItem('color-theme');
    root.classList.remove('dark-mode');
    root.setAttribute('data-theme', DEFAULT_THEME_ID);
    root.setAttribute('data-bs-theme', 'light');
  });

  it('starts in light mode with the default theme and applies it to <html>', () => {
    const svc = create();
    expect(svc.isDarkMode()).toBeFalse();
    expect(svc.themeId()).toBe(DEFAULT_THEME_ID);
    expect(root.getAttribute('data-theme')).toBe(DEFAULT_THEME_ID);
    expect(root.getAttribute('data-bs-theme')).toBe('light');
    expect(root.classList.contains('dark-mode')).toBeFalse();
  });

  it('toggleTheme switches mode, updates <html> and persists with the existing key', () => {
    const svc = create();
    svc.toggleTheme();
    expect(svc.isDarkMode()).toBeTrue();
    expect(root.classList.contains('dark-mode')).toBeTrue();
    expect(root.getAttribute('data-bs-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    svc.toggleTheme();
    expect(svc.isDarkMode()).toBeFalse();
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('setTheme applies and persists a registered theme, keeping the mode', () => {
    const svc = create();
    svc.setMode('dark');
    svc.setTheme('ocean');
    expect(svc.themeId()).toBe('ocean');
    expect(svc.currentTheme().id).toBe('ocean');
    expect(root.getAttribute('data-theme')).toBe('ocean');
    expect(root.classList.contains('dark-mode')).toBeTrue();
    expect(localStorage.getItem('color-theme')).toBe('ocean');
  });

  it('ignores unknown theme ids', () => {
    const svc = create();
    svc.setTheme('emerald');
    svc.setTheme('does-not-exist');
    expect(svc.themeId()).toBe('emerald');
  });

  it('restores mode and theme from storage on startup', () => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('color-theme', 'violet');
    const svc = create();
    expect(svc.isDarkMode()).toBeTrue();
    expect(svc.themeId()).toBe('violet');
    expect(root.getAttribute('data-theme')).toBe('violet');
  });

  it('falls back to the default theme when storage holds an unknown id', () => {
    localStorage.setItem('color-theme', 'removed-theme');
    expect(create().themeId()).toBe(DEFAULT_THEME_ID);
  });

  it('exposes every registered theme', () => {
    expect(create().themes.map(t => t.id)).toEqual(THEMES.map(t => t.id));
  });
});
