import { useState, useCallback, useEffect } from 'react'
import { type ThemePrefs, loadTheme, saveTheme, applyTheme, DEFAULT_THEME } from '../lib/theme'
import type { HouseholdThemePrefs } from '../api/household'

export function useTheme(serverPrefs?: HouseholdThemePrefs, onSave?: (prefs: HouseholdThemePrefs) => void) {
  const [prefs, setPrefsState] = useState<ThemePrefs>(() => {
    const local = loadTheme()
    if (!serverPrefs) return local
    return { ...local, ...serverPrefs }
  })

  useEffect(() => {
    if (!serverPrefs) return
    setPrefsState(prev => {
      const merged = { ...prev, ...serverPrefs }
      applyTheme(merged)
      return merged
    })
  }, [serverPrefs])

  const setPrefs = useCallback((next: ThemePrefs) => {
    applyTheme(next)
    saveTheme(next)
    setPrefsState(next)
    onSave?.({ primaryHsl: next.primaryHsl, headingFont: next.headingFont, bodyFont: next.bodyFont, radius: next.radius })
  }, [onSave])

  return { prefs, setPrefs }
}
