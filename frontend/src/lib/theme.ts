export interface ThemePrefs {
  primaryHsl: string
  fontFamily: string
  radius: string
}

export const DEFAULT_THEME: ThemePrefs = {
  primaryHsl: '220 9% 30%',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  radius: '0.25rem',
}

export const COLOR_PRESETS = [
  { label: 'Forest',      hsl: '152 41% 30%' },
  { label: 'Sage',        hsl: '145 25% 48%' },
  { label: 'Terracotta',  hsl: '16 55% 45%' },
  { label: 'Stone',       hsl: '30 12% 40%' },
  { label: 'Dusk',        hsl: '245 30% 45%' },
] as const

export const FONT_OPTIONS = [
  { label: 'System UI',         value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', googleFamily: null },
  { label: 'Inter',             value: '"Inter", sans-serif',               googleFamily: 'Inter' },
  { label: 'Lato',              value: '"Lato", sans-serif',                googleFamily: 'Lato' },
  { label: 'Merriweather',      value: '"Merriweather", serif',             googleFamily: 'Merriweather' },
  { label: 'Playfair Display',  value: '"Playfair Display", serif',         googleFamily: 'Playfair Display' },
] as const

const STORAGE_KEY = 'casita-theme-prefs'

const loadedFonts = new Set<string>()

export function loadGoogleFont(family: string): void {
  if (loadedFonts.has(family)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`
  document.head.appendChild(link)
  loadedFonts.add(family)
}

export function applyTheme(prefs: ThemePrefs): void {
  const root = document.documentElement
  root.style.setProperty('--primary', prefs.primaryHsl)
  root.style.setProperty('--ring', prefs.primaryHsl)
  root.style.setProperty('--radius', prefs.radius)
  root.style.setProperty('--font-sans', prefs.fontFamily)
}

export function loadTheme(): ThemePrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...DEFAULT_THEME, ...JSON.parse(stored) as Partial<ThemePrefs> }
  } catch { /* ignore */ }
  return DEFAULT_THEME
}

export function saveTheme(prefs: ThemePrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}
