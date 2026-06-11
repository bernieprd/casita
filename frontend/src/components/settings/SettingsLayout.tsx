import { Routes, Route, Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { ThemePrefs } from '@/lib/theme'
import SettingsMenu from './SettingsMenu'
import AccountSettings from './AccountSettings'
import HouseholdSettings from './HouseholdSettings'
import CalendarSettings from './CalendarSettings'
import ShoppingSettings from './ShoppingSettings'
import RecipesSettings from './RecipesSettings'
import AboutSettings from './AboutSettings'

interface Props {
  themePrefs: ThemePrefs
  setThemePrefs: (p: ThemePrefs) => void
  themeSaving: boolean
  setHeader: (node: ReactNode | null) => void
}

export default function SettingsLayout({ themePrefs, setThemePrefs, themeSaving, setHeader }: Props) {
  return (
    <Routes>
      <Route index element={<SettingsMenu />} />
      <Route path="account"   element={<AccountSettings setHeader={setHeader} />} />
      <Route path="household" element={<HouseholdSettings themePrefs={themePrefs} setThemePrefs={setThemePrefs} themeSaving={themeSaving} setHeader={setHeader} />} />
      <Route path="calendar"  element={<CalendarSettings  setHeader={setHeader} />} />
      <Route path="shopping"  element={<ShoppingSettings  setHeader={setHeader} />} />
      <Route path="recipes"   element={<RecipesSettings   setHeader={setHeader} />} />
      <Route path="about"     element={<AboutSettings     setHeader={setHeader} />} />
      <Route path="*"         element={<Navigate to="/settings" replace />} />
    </Routes>
  )
}
