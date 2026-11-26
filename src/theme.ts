import { readStored, writeStored } from './storage';

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'palette-lab:theme';

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function currentTheme(): Theme {
  const forced = document.documentElement.dataset.theme;
  if (forced === 'light' || forced === 'dark') return forced;
  return systemTheme();
}

/**
 * Follows the system theme until the person picks one with the toggle; that choice is remembered.
 * Calls `onChange` now and on every change, and returns the toggle.
 */
export function initTheme(onChange: (theme: Theme) => void): () => void {
  const stored = readStored(THEME_KEY);
  if (stored === 'light' || stored === 'dark') document.documentElement.dataset.theme = stored;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => onChange(currentTheme()));
  onChange(currentTheme());
  return () => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    writeStored(THEME_KEY, next);
    onChange(next);
  };
}
