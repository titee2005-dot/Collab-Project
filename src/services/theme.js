export const THEME_KEY = 'heart-collection.theme';
export function readTheme(env = globalThis) {
  try { const saved = env.localStorage?.getItem(THEME_KEY); if (saved === 'dark' || saved === 'light') return saved; } catch {}
  return env.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function applyTheme(theme, env = globalThis, persist = false) {
  env.document?.documentElement.setAttribute('data-theme', theme);
  if (persist) { try { env.localStorage?.setItem(THEME_KEY, theme); } catch {} }
}
