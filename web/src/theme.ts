export type Theme = 'light' | 'dark';

const KEY = 'iris.theme';

/** The visitor's stored choice wins; otherwise follow the device setting. */
export function initialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Storage blocked (private mode): the choice simply lasts for this visit.
  }
  window.dispatchEvent(new CustomEvent('iris:theme', { detail: next }));
  return next;
}
