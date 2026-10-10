import { THEMES, DEFAULT_THEME_ID, ThemeMode } from './theme.registry';

/**
 * Checks the registry against the compiled CSS (src/styles.scss is part of the test bundle):
 * every theme must exist in SCSS, define the full token set, and its preview colors must match.
 */
describe('Theme registry vs compiled theme CSS', () => {
  const root = document.documentElement;
  const before = { theme: root.getAttribute('data-theme'), dark: root.classList.contains('dark-mode') };

  const REQUIRED_TOKENS = [
    'bg', 'surface', 'surface-2', 'surface-3', 'surface-4', 'header', 'border', 'border-strong',
    'text-strong', 'text', 'text-2', 'text-3', 'text-4',
    'primary', 'primary-strong', 'primary-text', 'primary-soft', 'primary-border', 'on-primary', 'accent',
    'success', 'success-soft', 'success-solid', 'danger', 'danger-soft', 'danger-solid',
    'warning', 'warning-soft', 'warning-solid', 'tooltip-bg'
  ];

  function tokensFor(id: string, mode: ThemeMode): CSSStyleDeclaration {
    root.setAttribute('data-theme', id);
    root.classList.toggle('dark-mode', mode === 'dark');
    return getComputedStyle(root);
  }
  const token = (style: CSSStyleDeclaration, name: string) => style.getPropertyValue(`--cf-${name}`).trim().toLowerCase();

  afterAll(() => {
    if (before.theme) root.setAttribute('data-theme', before.theme); else root.removeAttribute('data-theme');
    root.classList.toggle('dark-mode', before.dark);
  });

  it('has unique ids and contains the default theme', () => {
    const ids = THEMES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_THEME_ID);
    expect(THEMES.length).toBeGreaterThanOrEqual(6);
  });

  for (const theme of THEMES) {
    for (const mode of ['light', 'dark'] as ThemeMode[]) {
      it(`${theme.id} / ${mode}: defines every token and matches the registry preview`, () => {
        const style = tokensFor(theme.id, mode);
        for (const name of REQUIRED_TOKENS) {
          expect(token(style, name)).withContext(`--cf-${name}`).toMatch(/^#[0-9a-f]{6}$/);
        }
        // the dev/test CSS printer may break the list over lines; browsers accept any whitespace there
        expect(token(style, 'primary-rgb').replace(/\s+/g, '')).toMatch(/^\d+,\d+,\d+$/);
        const probe = document.createElement('div');
        probe.style.color = 'rgba(var(--cf-primary-rgb), 0.5)';
        document.body.appendChild(probe);
        expect(getComputedStyle(probe).color).withContext('rgba(var(--cf-primary-rgb), a) resolves').toMatch(/^rgba\(\d+, \d+, \d+, 0\.5\)$/);
        probe.remove();
        const p = theme.preview[mode];
        expect(token(style, 'bg')).withContext('bg').toBe(p.bg);
        expect(token(style, 'surface')).withContext('surface').toBe(p.surface);
        expect(token(style, 'primary')).withContext('primary').toBe(p.primary);
        expect(token(style, 'accent')).withContext('accent').toBe(p.accent);
        expect(token(style, 'text')).withContext('text').toBe(p.text);
      });
    }
  }

  it('themes are really different from each other', () => {
    const primaries = THEMES.map(t => token(tokensFor(t.id, 'light'), 'primary'));
    expect(new Set(primaries).size).toBe(THEMES.length);
  });

  it('Bootstrap and Material variables follow the theme', () => {
    const style = tokensFor('emerald', 'light');
    const resolve = (v: string) => {
      const probe = document.createElement('div');
      probe.style.color = `var(${v})`;
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    };
    expect(token(style, 'primary')).toBe('#047857');
    expect(resolve('--bs-primary')).toBe('rgb(4, 120, 87)');
    expect(resolve('--mat-sys-primary')).toBe('rgb(4, 120, 87)');
  });
});
