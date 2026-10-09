import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { ThemePickerComponent } from './theme-picker.component';
import { ThemeService } from '../../app/services/theme.service';
import { THEMES, DEFAULT_THEME_ID } from '../theme.registry';

describe('ThemePickerComponent', () => {
  let fixture: ComponentFixture<ThemePickerComponent>;
  let el: HTMLElement;
  let theme: ThemeService;

  const menu = () => el.querySelector<HTMLElement>('[data-testid="theme-menu"]');
  const button = () => el.querySelector<HTMLButtonElement>('.theme-picker-btn')!;
  const options = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.theme-option'));

  beforeEach(async () => {
    localStorage.removeItem('theme');
    localStorage.removeItem('color-theme');
    await TestBed.configureTestingModule({ imports: [ThemePickerComponent, TranslateModule.forRoot()] }).compileComponents();
    fixture = TestBed.createComponent(ThemePickerComponent);
    el = fixture.nativeElement;
    theme = TestBed.inject(ThemeService);
    document.body.appendChild(el);
    fixture.detectChanges();
  });

  afterEach(() => {
    el.remove();
    theme.setTheme(DEFAULT_THEME_ID);
    theme.setMode('light');
    localStorage.removeItem('theme');
    localStorage.removeItem('color-theme');
  });

  it('is closed by default and opens a menu with every theme', () => {
    expect(menu()).toBeNull();
    expect(button().getAttribute('aria-expanded')).toBe('false');
    button().click();
    fixture.detectChanges();
    expect(menu()).not.toBeNull();
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(options().map(o => o.dataset['themeId'])).toEqual(THEMES.map(t => t.id));
  });

  it('marks the current theme as selected', () => {
    button().click();
    fixture.detectChanges();
    const selected = options().filter(o => o.getAttribute('aria-checked') === 'true');
    expect(selected.length).toBe(1);
    expect(selected[0].dataset['themeId']).toBe(DEFAULT_THEME_ID);
  });

  it('clicking a theme applies it to the page and keeps the menu open', () => {
    button().click();
    fixture.detectChanges();
    options().find(o => o.dataset['themeId'] === 'sunset')!.click();
    fixture.detectChanges();
    expect(theme.themeId()).toBe('sunset');
    expect(document.documentElement.getAttribute('data-theme')).toBe('sunset');
    expect(options().find(o => o.dataset['themeId'] === 'sunset')!.getAttribute('aria-checked')).toBe('true');
    expect(menu()).not.toBeNull();
  });

  it('the light/dark switch inside the menu changes the mode', () => {
    button().click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-testid="mode-dark"]')!.click();
    fixture.detectChanges();
    expect(theme.isDarkMode()).toBeTrue();
    expect(document.documentElement.classList.contains('dark-mode')).toBeTrue();
    el.querySelector<HTMLButtonElement>('[data-testid="mode-light"]')!.click();
    expect(theme.isDarkMode()).toBeFalse();
  });

  it('closes on Escape and on a click outside', () => {
    button().click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(menu()).toBeNull();

    button().click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(menu()).toBeNull();
  });

  it('arrow keys move focus between themes', async () => {
    button().click();
    fixture.detectChanges();
    await Promise.resolve(); // focus is moved in a microtask
    const items = options();
    expect(document.activeElement).toBe(items[0]);
    menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(items[items.length - 1]);
  });
});
