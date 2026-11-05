// Light or dark: the player's choice, kept on this device, applied to the whole page at once.

export type ThemeName = 'light' | 'dark';

const KEY = 'nl_theme_v1';
const listeners = new Set<(theme: ThemeName) => void>();

function stored(): ThemeName {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** The look on screen now */
export function theme(): ThemeName {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Puts the look on the page; and the phone's browser bar takes its colour too */
function apply(name: ThemeName): void {
  document.documentElement.dataset.theme = name;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', name === 'dark' ? '#0e1412' : '#0b5e3b');
}

export function setTheme(name: ThemeName): void {
  apply(name);
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // Kept until the page is closed
  }
  for (const listener of listeners) listener(name);
}

export function toggleTheme(): ThemeName {
  const next = theme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function onTheme(listener: (theme: ThemeName) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The look chosen last time, before anything is drawn */
export function startTheme(): void {
  apply(stored());
}
