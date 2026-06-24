import { useState, useEffect, useRef, lazy, Suspense, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid, WifiOff, RefreshCw, ArrowLeft, Home, CalendarDays, CheckSquare, ShoppingCart, BookOpen } from 'lucide-react'
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { itemKeys, itemsApi, todoKeys, todosApi, recipeKeys, recipesApi } from './api'
import { useOnlineStatus } from './useOnlineStatus'
import { TabErrorBoundary } from './components/TabErrorBoundary'
const HomeComponent = lazy(() => import('./components/Home'))
const Calendar      = lazy(() => import('./components/Calendar'))
const Todos         = lazy(() => import('./components/Todos'))
const Shopping      = lazy(() => import('./components/Shopping'))
const Recipes       = lazy(() => import('./components/Recipes'))
import PublicRecipeView from './components/PublicRecipeView'
import { SignIn, SignUp, SignedIn, useUser } from '@clerk/clerk-react'
import { AuthProvider, useAuth, useHousehold } from './context/AuthContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRegisterSW } from 'virtual:pwa-register/react'
import InstallBanner from './components/InstallBanner'
import { useHouseholdTheme, useUpdateHouseholdTheme, useHouseholdSettings } from './api/household'
import { computePinnedTabs, type AreaId } from './api/areas'
import { useTheme } from '@/hooks/useTheme'
import { useMe } from './api/me'
import i18n, { SUPPORTED_LOCALES } from './i18n'
import { normalizeLocale } from './lib/clerkLocalizations'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'


function LocaleSync() {
  const { data } = useMe()
  useEffect(() => {
    if (data?.locale) i18n.changeLanguage(data.locale)
  }, [data?.locale])
  return null
}

const RecipeFormPage  = lazy(() => import('./components/RecipeFormPage'))
const TodoFormPage    = lazy(() => import('./components/TodoFormPage'))
const ItemFormPage    = lazy(() => import('./components/ItemFormPage'))
const MenuComponent   = lazy(() => import('./components/Menu'))
const SettingsLayout  = lazy(() => import('./components/settings/SettingsLayout'))
const HouseholdSetup  = lazy(() => import('./components/HouseholdSetup'))
const ThemePreview    = lazy(() => import('./components/ThemePreview'))
const OnboardingFlow  = lazy(() => import('./components/OnboardingFlow'))

export type TabId = 'home' | 'calendar' | 'todos' | 'shopping' | 'recipes' | 'menu'

const TAB_PATHS: Record<TabId, string> = {
  home:     '/',
  calendar: '/calendar',
  todos:    '/todos',
  shopping: '/shopping',
  recipes:  '/recipes',
  menu:     '/menu',
}

function pathnameToTab(pathname: string): TabId {
  if (pathname.startsWith('/menu'))     return 'menu'
  if (pathname.startsWith('/calendar')) return 'calendar'
  if (pathname.startsWith('/todos'))    return 'todos'
  if (pathname.startsWith('/shopping')) return 'shopping'
  if (pathname.startsWith('/recipes'))  return 'recipes'
  return 'home'
}

function buildNavTabs(
  t: (key: string) => string,
  pinnedAreas: AreaId[],
): { id: TabId; label: string; icon: ReactNode }[] {
  const areaTab = (id: AreaId): { id: TabId; label: string; icon: ReactNode } => {
    const meta: Record<AreaId, { label: string; icon: ReactNode }> = {
      calendar: { label: t('nav.calendar'), icon: <CalendarDays className="size-5" /> },
      todos:    { label: t('nav.todos'),    icon: <CheckSquare className="size-5" /> },
      shopping: { label: t('nav.shopping'), icon: <ShoppingCart className="size-5" /> },
      recipes:  { label: t('nav.recipes'),  icon: <BookOpen className="size-5" /> },
    }
    return { id: id as TabId, ...meta[id] }
  }
  return [
    { id: 'home' as TabId, label: t('nav.home'), icon: <Home className="size-5" /> },
    ...pinnedAreas.map(areaTab),
    { id: 'menu' as TabId, label: t('nav.menu'), icon: <LayoutGrid className="size-5" /> },
  ]
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  )
}

function SuspenseFallback() {
  return (
    <div className="w-full h-1 bg-primary/20 overflow-hidden">
      <div className="h-full bg-primary animate-pulse" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { householdId, isLoading: isHouseholdLoading, fetchError, refreshHousehold } = useHousehold()
  const { isSignedIn: isClerkSignedIn, isLoaded: isClerkLoaded } = useUser()
  const location = useLocation()

  if (!isClerkLoaded) return <Spinner />

  // Not authenticated → sign-in
  if (!user) return <Navigate to="/sign-in" state={{ from: location }} replace />

  // Clerk user: wait for household fetch, then handle result
  if (isClerkSignedIn) {
    if (isHouseholdLoading) return <Spinner />
    // If the fetch failed (network error, 401, 500, etc.) show a retry screen.
    // Don't redirect to /household/setup — that would be incorrect and confusing.
    if (fetchError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-muted-foreground text-center">
            Could not load your household. Check your connection and try again.
          </p>
          <Button onClick={refreshHousehold} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )
    }
    if (householdId === null) return <Navigate to="/household/setup" replace />
  }

  return <>{children}</>
}

function useAuthLocale() {
  const [searchParams] = useSearchParams()
  const appliedRef = useRef(false)

  useEffect(() => {
    if (appliedRef.current) return
    appliedRef.current = true

    const queryLocale = searchParams.get('locale')
    if (queryLocale) {
      i18n.changeLanguage(normalizeLocale(queryLocale))
      return
    }

    if (i18n.language === 'en') {
      // Check referrer from mycasita.app marketing pages (e.g. /es, /pt-pt, /it)
      const refUrl = document.referrer
        ? (() => { try { return new URL(document.referrer) } catch { return null } })()
        : null
      if (refUrl?.hostname === 'mycasita.app') {
        const segment = refUrl.pathname.split('/').find(Boolean) ?? ''
        const refLocale = normalizeLocale(segment || 'en')
        if (refLocale !== 'en') { i18n.changeLanguage(refLocale); return }
      }

      // Navigator fallback — only when no stored preference exists yet
      const browserLocale = normalizeLocale(navigator.language)
      if (browserLocale !== 'en') i18n.changeLanguage(browserLocale)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- run-once on mount; searchParams read synchronously above
}

function LanguageSelector() {
  const { i18n: i18nInstance } = useTranslation()
  const current = normalizeLocale(i18nInstance.language)
  return (
    <div className="mt-4 flex justify-center">
      <Select value={current} onValueChange={(v) => i18nInstance.changeLanguage(v)}>
        <SelectTrigger className="w-44 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LOCALES.map(({ code, label }) => (
            <SelectItem key={code} value={code} className="text-xs">{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function SignInPage() {
  const { isSignedIn, isLoaded } = useUser()
  useAuthLocale()
  if (!isLoaded) return <Spinner />
  if (isSignedIn) return <Navigate to="/" replace />
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div>
        <SignIn routing="path" path="/sign-in" />
        <LanguageSelector />
      </div>
    </div>
  )
}

function SignUpPage() {
  const { isSignedIn, isLoaded } = useUser()
  useAuthLocale()
  if (!isLoaded) return <Spinner />
  if (isSignedIn) return <Navigate to="/household/setup" replace />
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div>
        <SignUp routing="path" path="/sign-up" />
        <LanguageSelector />
      </div>
    </div>
  )
}

function AppShell() {
  const { t } = useTranslation()
  const [headerContent, setHeaderContent] = useState<ReactNode | null>(null)
  const { householdName } = useHousehold()
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem('casita_onboarding_pending') !== null,
  )
  function handleOnboardingClose() {
    localStorage.removeItem('casita_onboarding_pending')
    setShowOnboarding(false)
  }
  const { data: householdSettings } = useHouseholdSettings()
  const areasConfig = householdSettings?.areasConfig
  const { data: me } = useMe()
  const { data: householdTheme } = useHouseholdTheme()
  const { mutate: updateHouseholdTheme, isPending: themeSaving } = useUpdateHouseholdTheme()
  const { prefs: themePrefs, setPrefs: setThemePrefs } = useTheme(householdTheme, updateHouseholdTheme)

  const qc = useQueryClient()
  const isOnline = useOnlineStatus()
  const [needRefresh, setNeedRefresh] = useState(false)
  const { updateServiceWorker } = useRegisterSW({ onNeedRefresh() { setNeedRefresh(true) } })
  const navigate = useNavigate()
  const location = useLocation()

  const activeTab = pathnameToTab(location.pathname)
  const isSettings = location.pathname.startsWith('/settings')
  const isRecipeDetail = /^\/recipes\/[^/]+$/.test(location.pathname)

  useEffect(() => {
    qc.prefetchQuery({ queryKey: itemKeys.shopping, queryFn: itemsApi.listShopping })
    qc.prefetchQuery({ queryKey: todoKeys.all,      queryFn: todosApi.list })
    qc.prefetchQuery({ queryKey: recipeKeys.all,    queryFn: recipesApi.list })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background">
      <LocaleSync />
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="max-w-xl mx-auto flex items-center px-2 h-14">
          {headerContent ?? (
            isSettings ? (
              <>
                <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="-ml-2">
                  <ArrowLeft />
                </Button>
                <h1 className="flex-1 text-lg font-bold">{t('nav.settings')}</h1>
              </>
            ) : (
              <h1 className="flex-1 text-lg font-bold">{householdName ?? 'Casita'}</h1>
            )
          )}
        </div>
      </header>

      {needRefresh && (
        <div className="bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-sm border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 px-4 py-3 max-w-xl mx-auto">
            <RefreshCw className="size-4 shrink-0" />
            <span className="flex-1">{t('nav.updateAvailable')}</span>
            <button onClick={() => updateServiceWorker(true)} className="font-semibold underline">
              {t('nav.reload')}
            </button>
          </div>
        </div>
      )}

      {!isOnline && (
        <div className="bg-yellow-50 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200 text-sm border-b border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-2 px-4 py-3 max-w-xl mx-auto">
            <WifiOff className="size-4 shrink-0" />
            {t('nav.offline')}
          </div>
        </div>
      )}

      <InstallBanner />

      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingFlow
            householdName={householdName}
            onClose={handleOnboardingClose}
          />
        </Suspense>
      )}

      <div
        className={cn(
          'max-w-xl mx-auto px-4 pt-4',
          isSettings || isRecipeDetail ? 'pb-2' : 'pb-[calc(80px+env(safe-area-inset-bottom))]'
        )}
      >
        <Routes>
          <Route path="/" element={
            <TabErrorBoundary key="home">
              <Suspense fallback={<SuspenseFallback />}>
                <HomeComponent />
              </Suspense>
            </TabErrorBoundary>
          } />
          <Route path="/calendar" element={
            <TabErrorBoundary key="calendar">
              <Suspense fallback={<SuspenseFallback />}>
                <Calendar setHeader={setHeaderContent} />
              </Suspense>
            </TabErrorBoundary>
          } />
          <Route path="/todos" element={
            <TabErrorBoundary key="todos">
              <Suspense fallback={<SuspenseFallback />}>
                <Todos setHeader={setHeaderContent} />
              </Suspense>
            </TabErrorBoundary>
          } />
          <Route path="/shopping/*" element={
            <TabErrorBoundary key="shopping">
              <Suspense fallback={<SuspenseFallback />}>
                <Shopping setHeader={setHeaderContent} />
              </Suspense>
            </TabErrorBoundary>
          } />
          <Route path="/recipes" element={
            <TabErrorBoundary key="recipes">
              <Suspense fallback={<SuspenseFallback />}>
                <Recipes setToolbar={setHeaderContent} />
              </Suspense>
            </TabErrorBoundary>
          } />
          <Route path="/recipes/:id" element={
            <TabErrorBoundary key="recipes">
              <Suspense fallback={<SuspenseFallback />}>
                <Recipes setToolbar={setHeaderContent} />
              </Suspense>
            </TabErrorBoundary>
          } />
          <Route path="/menu" element={
            <TabErrorBoundary key="menu">
              <Suspense fallback={<SuspenseFallback />}>
                <MenuComponent />
              </Suspense>
            </TabErrorBoundary>
          } />
          <Route path="/settings/*" element={
            <TabErrorBoundary key="settings">
              <Suspense fallback={<SuspenseFallback />}>
                <SettingsLayout
                  themePrefs={themePrefs}
                  setThemePrefs={setThemePrefs}
                  themeSaving={themeSaving}
                  setHeader={setHeaderContent}
                />
              </Suspense>
            </TabErrorBoundary>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {!isSettings && !isRecipeDetail && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="max-w-xl mx-auto flex">
            {buildNavTabs(t, computePinnedTabs(me?.tabConfig, areasConfig)).map(({ id, label, icon }) => (
              <button
                key={id}
                data-testid={`nav-tab-${id}`}
                onClick={() => navigate(TAB_PATHS[id])}
                aria-current={activeTab === id ? 'page' : undefined}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                  activeTab === id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/theme-preview" element={
          <Suspense fallback={null}>
            <ThemePreview />
          </Suspense>
        } />
        <Route path="/login" element={<Navigate to="/sign-in" replace />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />

        <Route path="/share/:token" element={<PublicRecipeView />} />
        <Route path="/household/setup" element={<SignedIn><Suspense fallback={<SuspenseFallback />}><HouseholdSetup /></Suspense></SignedIn>} />
        <Route path="/recipes/new" element={
          <ProtectedRoute>
            <Suspense fallback={<SuspenseFallback />}><RecipeFormPage /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/recipes/:id/edit" element={
          <ProtectedRoute>
            <Suspense fallback={<SuspenseFallback />}><RecipeFormPage /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/todos/new" element={
          <ProtectedRoute>
            <Suspense fallback={<SuspenseFallback />}><TodoFormPage /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/todos/:id/edit" element={
          <ProtectedRoute>
            <Suspense fallback={<SuspenseFallback />}><TodoFormPage /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/items/new" element={
          <ProtectedRoute>
            <Suspense fallback={<SuspenseFallback />}><ItemFormPage /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/items/:id/edit" element={
          <ProtectedRoute>
            <Suspense fallback={<SuspenseFallback />}><ItemFormPage /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/*" element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  )
}
