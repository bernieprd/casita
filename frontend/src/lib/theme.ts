export interface ThemePrefs {
  primaryHsl: string
  bodyFont: string
  headingFont: string
  radius: string
  colorScheme: 'light' | 'dark' | 'system'
}

export const DEFAULT_THEME: ThemePrefs = {
  primaryHsl: '220 9% 30%',
  bodyFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headingFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  radius: '0.25rem',
  colorScheme: 'system',
}

export const COLOR_PRESETS = [
  { label: 'Forest',      hsl: '152 41% 30%' },
  { label: 'Sage',        hsl: '145 25% 36%' },
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

export const HEADING_FONT_OPTIONS = [
  { label: 'Playfair Display',  value: '"Playfair Display", serif',         googleFamily: 'Playfair Display' },
  { label: 'Merriweather',      value: '"Merriweather", serif',             googleFamily: 'Merriweather' },
  { label: 'Inter',             value: '"Inter", sans-serif',               googleFamily: 'Inter' },
  { label: 'Lato',              value: '"Lato", sans-serif',                googleFamily: 'Lato' },
  { label: 'System UI',         value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', googleFamily: null },
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

let _mqlListener: (() => void) | null = null

function applyColorScheme(scheme: ThemePrefs['colorScheme']): void {
  const html = document.documentElement
  if (scheme === 'dark') {
    html.classList.add('dark')
  } else if (scheme === 'light') {
    html.classList.remove('dark')
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    html.classList.toggle('dark', prefersDark)
  }
}

export function applyTheme(prefs: ThemePrefs): void {
  const root = document.documentElement
  root.style.setProperty('--primary', prefs.primaryHsl)
  root.style.setProperty('--ring', prefs.primaryHsl)
  root.style.setProperty('--radius', prefs.radius)
  root.style.setProperty('--font-sans', prefs.bodyFont)
  root.style.setProperty('--font-heading', prefs.headingFont)
  const allFontOptions = [...FONT_OPTIONS, ...HEADING_FONT_OPTIONS]
  for (const font of allFontOptions) {
    if (font.googleFamily && (prefs.bodyFont === font.value || prefs.headingFont === font.value)) {
      loadGoogleFont(font.googleFamily)
    }
  }

  if (_mqlListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', _mqlListener)
    _mqlListener = null
  }

  applyColorScheme(prefs.colorScheme)

  if (prefs.colorScheme === 'system') {
    _mqlListener = () => applyColorScheme('system')
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', _mqlListener)
  }
}

export function loadTheme(): ThemePrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ThemePrefs> & { fontFamily?: string }
      // Migrate old fontFamily key to bodyFont/headingFont
      if (parsed.fontFamily) {
        parsed.bodyFont = parsed.bodyFont ?? parsed.fontFamily
        parsed.headingFont = parsed.headingFont ?? parsed.fontFamily
        delete parsed.fontFamily
      }
      return { ...DEFAULT_THEME, ...parsed }
    }
  } catch { /* ignore */ }
  return DEFAULT_THEME
}

export function saveTheme(prefs: ThemePrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}
