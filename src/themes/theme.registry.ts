/**
 * Theme registry - the single list of themes the UI offers.
 *
 * Each entry must have a matching palette in src/themes/palettes/_<id>.scss and an
 * `@include engine.theme('<id>', ...)` line in src/themes/_index.scss.
 * `preview` colors are shown in the theme menu and are checked against the compiled CSS
 * by theme.registry.spec.ts, so they cannot drift from the SCSS palettes.
 */
export type ThemeMode = 'light' | 'dark';

export interface ThemePreview {
  bg: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
}

export interface ThemeDefinition {
  id: string;
  name: { he: string; en: string };
  description: { he: string; en: string };
  preview: Record<ThemeMode, ThemePreview>;
}

export const DEFAULT_THEME_ID = 'classic';

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: 'classic',
    name: { he: 'קלאסי', en: 'Classic' },
    description: { he: 'אינדיגו וצפחה, המראה המקורי', en: 'Indigo and slate, the original look' },
    preview: {
      light: { bg: '#ffffff', surface: '#ffffff', primary: '#4f46e5', accent: '#087f8c', text: '#1e293b' },
      dark: { bg: '#0f172a', surface: '#111827', primary: '#5b5ef0', accent: '#38bdf8', text: '#e5e7eb' }
    }
  },
  {
    id: 'ocean',
    name: { he: 'אוקיינוס', en: 'Ocean' },
    description: { he: 'כחול פינטק רגוע עם טורקיז', en: 'Calm fintech blue with teal' },
    preview: {
      light: { bg: '#f4f7fb', surface: '#ffffff', primary: '#1d64d8', accent: '#0e7f91', text: '#142538' },
      dark: { bg: '#0a1220', surface: '#0f1a2c', primary: '#2563eb', accent: '#22c3e6', text: '#e2eaf4' }
    }
  },
  {
    id: 'emerald',
    name: { he: 'אמרלד', en: 'Emerald' },
    description: { he: 'ירוק "עושר" רענן', en: 'Fresh "wealth" green' },
    preview: {
      light: { bg: '#f5f8f6', surface: '#ffffff', primary: '#047857', accent: '#0f766e', text: '#16261d' },
      dark: { bg: '#08110d', surface: '#0d1a14', primary: '#047857', accent: '#2dd4bf', text: '#e1ece6' }
    }
  },
  {
    id: 'violet',
    name: { he: 'סגול', en: 'Violet' },
    description: { he: 'סגול SaaS מודרני, לילה עמוק', en: 'Modern SaaS purple, midnight dark' },
    preview: {
      light: { bg: '#f7f6fb', surface: '#ffffff', primary: '#6d28d9', accent: '#a21caf', text: '#1f1a33' },
      dark: { bg: '#0c0a14', surface: '#13101f', primary: '#7c3aed', accent: '#e879f9', text: '#e9e5f5' }
    }
  },
  {
    id: 'sunset',
    name: { he: 'שקיעה', en: 'Sunset' },
    description: { he: 'כתום טרקוטה חם על גוונים טבעיים', en: 'Warm terracotta on natural tones' },
    preview: {
      light: { bg: '#faf7f4', surface: '#ffffff', primary: '#c2410c', accent: '#be185d', text: '#2a2018' },
      dark: { bg: '#120e0b', surface: '#1a1511', primary: '#c2410c', accent: '#fb7185', text: '#f0e8e0' }
    }
  },
  {
    id: 'graphite',
    name: { he: 'גרפיט', en: 'Graphite' },
    description: { he: 'מינימליסטי ניטרלי עם נגיעת כחול', en: 'Minimal neutral with a blue touch' },
    preview: {
      light: { bg: '#f7f7f8', surface: '#ffffff', primary: '#18181b', accent: '#2563eb', text: '#18181b' },
      dark: { bg: '#09090b', surface: '#111113', primary: '#3f3f46', accent: '#60a5fa', text: '#ededef' }
    }
  }
];

export function findTheme(id: string | null | undefined): ThemeDefinition | undefined {
  return THEMES.find(t => t.id === id);
}
