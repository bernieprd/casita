import { useState, useCallback } from 'react'
import { type ThemePrefs, loadTheme, saveTheme, applyTheme } from '../lib/theme'

export function useTheme() {
  const [prefs, setPrefsState] = useState<ThemePrefs>(loadTheme)

  const setPrefs = useCallback((next: ThemePrefs) => {
    applyTheme(next)
    saveTheme(next)
    setPrefsState(next)
  }, [])

  return { prefs, setPrefs }
}
