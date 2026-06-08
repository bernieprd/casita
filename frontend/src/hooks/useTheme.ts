import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { type ThemePrefs, loadTheme, saveTheme, applyTheme } from '../lib/theme'
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
    return { ...local, ...serverPrefs }
  })

  // Fix Critical 1 + Minor 11: derive merged with useMemo, then apply in useEffect
  const merged = useMemo(
    () => (serverPrefs ? { ...prefs, ...serverPrefs } : prefs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serverPrefs, prefs],
  )

  useEffect(() => {
    applyTheme(merged)
  }, [merged])

  // Fix Major 4: stabilise the onSave reference so setPrefs isn't recreated every render
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  // Fix Critical 2 + 3: optimistic UI update, but only persist to localStorage on server success
  const setPrefs = useCallback((next: ThemePrefs) => {
    const previous = prefs

    // Optimistic: apply visually and update React state immediately
    applyTheme(next)
    setPrefsState(next)

    const serverPrefsToSave: HouseholdThemePrefs = {
      primaryHsl: next.primaryHsl,
      headingFont: next.headingFont,
      bodyFont: next.bodyFont,
      radius: next.radius,
    }

    onSaveRef.current?.(serverPrefsToSave, {
      onSuccess: () => {
        // Persist to localStorage only after server confirms
        saveTheme(next)
      },
      onError: () => {
        // Revert optimistic update if the server rejects
        applyTheme(previous)
        setPrefsState(previous)
        toast.error('Failed to save theme', { description: 'Your changes could not be saved. Please try again.' })
      },
    })
  }, [prefs])

  return { prefs, setPrefs }
}
