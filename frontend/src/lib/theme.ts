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

export interface ColorPreset {
  label: string
  hsl: string        // DB identifier — never changes
  lightPrimary: string
  darkPrimary: string
  lightBase: string
  darkBase: string
  lightBackground: string
  darkBackground: string
}

const DEFAULT_COLOR_PRESET: ColorPreset = {
  label: 'Default',
  hsl: '220 9% 30%',
  lightPrimary: '220 9% 30%',
  darkPrimary:  '220 9% 60%',
  lightBase:    '220 8% 95%',
  darkBase:     '220 8% 12%',
  lightBackground: '220 6% 98%',
  darkBackground:  '220 6% 10%',
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    label: 'Forest',
    hsl:          '152 41% 30%',
    lightPrimary: '152 45% 27%',
    darkPrimary:  '152 50% 60%',
    lightBase:    '152 15% 95%',
    darkBase:     '152 7% 12%',
    lightBackground: '152 8% 98%',
    darkBackground:  '152 5% 10%',
  },
  {
    label: 'Sage',
    hsl:          '145 25% 36%',
    lightPrimary: '145 28% 32%',
    darkPrimary:  '145 35% 62%',
    lightBase:    '145 10% 95%',
    darkBase:     '145 5% 12%',
    lightBackground: '145 5% 98%',
    darkBackground:  '145 3% 10%',
  },
  {
    label: 'Terracotta',
    hsl:          '16 55% 45%',
    lightPrimary: '16 58% 38%',
    darkPrimary:  '16 70% 67%',
    lightBase:    '16 20% 95%',
    darkBase:     '16 7% 12%',
    lightBackground: '16 10% 98%',
    darkBackground:  '16 5% 10%',
  },
  {
    label: 'Stone',
    hsl:          '30 12% 40%',
    lightPrimary: '30 14% 36%',
    darkPrimary:  '30 18% 63%',
    lightBase:    '30 8% 95%',
    darkBase:     '30 6% 12%',
    lightBackground: '30 4% 98%',
    darkBackground:  '30 4% 10%',
  },
  {
    label: 'Dusk',
    hsl:          '245 30% 45%',
    lightPrimary: '245 35% 36%',
    darkPrimary:  '245 50% 70%',
    lightBase:    '245 15% 95%',
    darkBase:     '245 15% 12%',
    lightBackground: '245 8% 98%',
    darkBackground:  '245 8% 10%',
  },
]

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
  const preset = COLOR_PRESETS.find(p => p.hsl === prefs.primaryHsl) ?? DEFAULT_COLOR_PRESET
  root.style.setProperty('--primary-light', preset.lightPrimary)
  root.style.setProperty('--primary-dark',  preset.darkPrimary)
  root.style.setProperty('--base-light',    preset.lightBase)
  root.style.setProperty('--base-dark',     preset.darkBase)
  root.style.setProperty('--bg-light', preset.lightBackground)
  root.style.setProperty('--bg-dark',  preset.darkBackground)
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
      // Backward-compat: themes stored before bodyFont/headingFont split used a single fontFamily key.
      if (parsed.fontFamily) {
        parsed.bodyFont = parsed.bodyFont ?? parsed.fontFamily
        parsed.headingFont = parsed.headingFont ?? parsed.fontFamily
        delete parsed.fontFamily
      }
      return { ...DEFAULT_THEME, ...parsed }
    }
  } catch (err) {
    console.warn('[theme] Failed to load stored theme preferences, falling back to defaults.', err)
  }
  return DEFAULT_THEME
}

export function saveTheme(prefs: ThemePrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}
