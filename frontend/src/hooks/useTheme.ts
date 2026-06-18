import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { type ThemePrefs, DEFAULT_THEME, loadTheme, saveTheme, applyTheme } from '../lib/theme'
import type { HouseholdThemePrefs } from '../api/household'

type SaveCallbacks = {
  onSuccess?: () => void
  onError?: (err: unknown) => void
}

export function useTheme(
  serverPrefs?: HouseholdThemePrefs,
  onSave?: (prefs: HouseholdThemePrefs, callbacks?: SaveCallbacks) => void,
) {
  const [prefs, setPrefsState] = useState<ThemePrefs>(() => {
    const local = loadTheme()
    if (!serverPrefs) return local
    return {
      primaryHsl: serverPrefs.primaryHsl ?? DEFAULT_THEME.primaryHsl,
      headingFont: serverPrefs.headingFont ?? DEFAULT_THEME.headingFont,
      bodyFont: serverPrefs.bodyFont ?? DEFAULT_THEME.bodyFont,
      radius: serverPrefs.radius ?? DEFAULT_THEME.radius,
      colorScheme: local.colorScheme,
    }
  })

  // When serverPrefs changes (e.g. switching households), sync the server-managed
  // fields. colorScheme is device-local so we leave it alone.
  useEffect(() => {
    if (!serverPrefs) return
    setPrefsState(current => ({
      ...current,
      primaryHsl: serverPrefs.primaryHsl ?? DEFAULT_THEME.primaryHsl,
      headingFont: serverPrefs.headingFont ?? DEFAULT_THEME.headingFont,
      bodyFont: serverPrefs.bodyFont ?? DEFAULT_THEME.bodyFont,
      radius: serverPrefs.radius ?? DEFAULT_THEME.radius,
    }))
  }, [serverPrefs])

  // Server-managed fields always win; colorScheme always comes from local state.
  const merged = useMemo(() => {
    if (!serverPrefs) return prefs
    return {
      primaryHsl: serverPrefs.primaryHsl ?? DEFAULT_THEME.primaryHsl,
      headingFont: serverPrefs.headingFont ?? DEFAULT_THEME.headingFont,
      bodyFont: serverPrefs.bodyFont ?? DEFAULT_THEME.bodyFont,
      radius: serverPrefs.radius ?? DEFAULT_THEME.radius,
      colorScheme: prefs.colorScheme,
    }
  }, [serverPrefs, prefs])

  useEffect(() => {
    applyTheme(merged)
  }, [merged])

  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  const setPrefs = useCallback((next: ThemePrefs) => {
    const previous = prefs
    const serverFieldChanged =
      next.primaryHsl !== previous.primaryHsl ||
      next.headingFont !== previous.headingFont ||
      next.bodyFont !== previous.bodyFont ||
      next.radius !== previous.radius

    applyTheme(next)
    setPrefsState(next)

    if (!serverFieldChanged) {
      saveTheme({ ...DEFAULT_THEME, colorScheme: next.colorScheme })
      return
    }

    const serverPrefsToSave: HouseholdThemePrefs = {
      primaryHsl: next.primaryHsl,
      headingFont: next.headingFont,
      bodyFont: next.bodyFont,
      radius: next.radius,
    }

    onSaveRef.current?.(serverPrefsToSave, {
      onSuccess: () => {
        // Only persist colorScheme; the server owns everything else
        saveTheme({ ...DEFAULT_THEME, colorScheme: next.colorScheme })
      },
      onError: () => {
        applyTheme(previous)
        setPrefsState(previous)
        toast.error('Failed to save theme', { description: 'Your changes could not be saved. Please try again.' })
      },
    })
  }, [prefs])

  return { prefs, setPrefs }
}
