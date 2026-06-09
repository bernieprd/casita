import { useState, useEffect, lazy, Suspense, type ReactNode } from 'react'
import { Settings, WifiOff, RefreshCw, ArrowLeft, Home, CalendarDays, CheckSquare, ShoppingCart, BookOpen } from 'lucide-react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { itemKeys, itemsApi, todoKeys, todosApi } from './api'
import { useOnlineStatus } from './useOnlineStatus'
import { TabErrorBoundary } from './components/TabErrorBoundary'
import HomeComponent from './components/Home'
import Calendar from './components/Calendar'
import Todos from './components/Todos'
import Shopping from './components/Shopping'
import Recipes from './components/Recipes'
import PublicRecipeView from './components/PublicRecipeView'
import { SignIn, SignUp, SignedIn, useUser } from '@clerk/clerk-react'
import { AuthProvider, useAuth, useHousehold } from './context/AuthContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRegisterSW } from 'virtual:pwa-register/react'
import InstallBanner from './components/InstallBanner'

const RecipeFormPage  = lazy(() => import('./components/RecipeFormPage'))
const SettingsPage    = lazy(() => import('./components/Settings'))
const HouseholdSetup  = lazy(() => import('./components/HouseholdSetup'))
const ThemePreview    = lazy(() => import('./components/ThemePreview'))

export type TabId = 'home' | 'calendar' | 'todos' | 'shopping' | 'recipes'

const TAB_PATHS: Record<TabId, string> = {
  home:     '/',
  calendar: '/calendar',
  todos:    '/todos',
  shopping: '/shopping',
  recipes:  '/recipes',
}

function pathnameToTab(pathname: string): TabId {
  if (pathname.startsWith('/calendar')) return 'calendar'
  if (pathname.startsWith('/todos'))    return 'todos'
  if (pathname.startsWith('/shopping')) return 'shopping'
  if (pathname.startsWith('/recipes'))  return 'recipes'
  return 'home'
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
  const { householdId, isLoading: isHouseholdLoading } = useHousehold()
  const { isSignedIn: isClerkSignedIn, isLoaded: isClerkLoaded } = useUser()
  const location = useLocation()

  if (!isClerkLoaded) return <Spinner />

  // Not authenticated → sign-in
  if (!user) return <Navigate to="/sign-in" state={{ from: location }} replace />

  // Clerk user: wait for household fetch, then redirect to setup if needed
  if (isClerkSignedIn) {
    if (isHouseholdLoading) return <Spinner />
    if (householdId === null) return <Navigate to="/household/setup" replace />
  }

  return <>{children}</>
}

function SignInPage() {
  const { isSignedIn, isLoaded } = useUser()
  if (!isLoaded) return <Spinner />
  if (isSignedIn) return <Navigate to="/" replace />
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn routing="path" path="/sign-in" />
    </div>
  )
}

function SignUpPage() {
  const { isSignedIn, isLoaded } = useUser()
  if (!isLoaded) return <Spinner />
  if (isSignedIn) return <Navigate to="/household/setup" replace />
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignUp routing="path" path="/sign-up" />
    </div>
  )
}

function AppShell() {
  const [headerContent, setHeaderContent] = useState<ReactNode | null>(null)
  const { householdName } = useHousehold()
  const qc = useQueryClient()
  const isOnline = useOnlineStatus()
  const [needRefresh, setNeedRefresh] = useState(false)
  const { updateServiceWorker } = useRegisterSW({ onNeedRefresh() { setNeedRefresh(true) } })
  const navigate = useNavigate()
  const location = useLocation()

  const activeTab = pathnameToTab(location.pathname)
  const isSettings = location.pathname === '/settings'
  const isRecipeDetail = /^\/recipes\/[^/]+$/.test(location.pathname)

  useEffect(() => {
    qc.prefetchQuery({ queryKey: itemKeys.shopping, queryFn: itemsApi.listShopping })
    qc.prefetchQuery({ queryKey: todoKeys.all,      queryFn: todosApi.list })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="max-w-xl mx-auto flex items-center px-2 h-14">
          {headerContent ?? (
            isSettings ? (
              <>
                <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="-ml-2">
                  <ArrowLeft />
                </Button>
                <h1 className="flex-1 text-lg font-bold">Settings</h1>
              </>
            ) : (
              <>
                <h1 className="flex-1 text-lg font-bold">{householdName ?? 'Casita'}</h1>
                {activeTab === 'home' && (
                  <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
                    <Settings />
                  </Button>
                )}
              </>
            )
          )}
        </div>
      </header>

      {needRefresh && (
        <div className="bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-sm border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 px-4 py-1.5 max-w-xl mx-auto">
            <RefreshCw className="size-4 shrink-0" />
            <span className="flex-1">Update available</span>
            <button onClick={() => updateServiceWorker(true)} className="font-semibold underline">
              Reload
            </button>
          </div>
        </div>
      )}

      {!isOnline && (
        <div className="bg-yellow-50 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200 text-sm border-b border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-2 px-4 py-1.5 max-w-xl mx-auto">
            <WifiOff className="size-4 shrink-0" />
            Offline — showing cached data
          </div>
        </div>
      )}

      <InstallBanner />

      <div
        className={cn(
          'max-w-xl mx-auto px-4 pt-4',
          isSettings || isRecipeDetail ? 'pb-2' : 'pb-[calc(80px+env(safe-area-inset-bottom))]'
        )}
      >
        <Routes>
          <Route path="/" element={
            <TabErrorBoundary key="home">
              <HomeComponent />
            </TabErrorBoundary>
          } />
          <Route path="/calendar" element={
            <TabErrorBoundary key="calendar">
              <Calendar setHeader={setHeaderContent} />
            </TabErrorBoundary>
          } />
          <Route path="/todos" element={
            <TabErrorBoundary key="todos">
              <Todos setHeader={setHeaderContent} />
            </TabErrorBoundary>
          } />
          <Route path="/shopping/*" element={
            <TabErrorBoundary key="shopping">
              <Shopping setHeader={setHeaderContent} />
            </TabErrorBoundary>
          } />
          <Route path="/recipes" element={
            <TabErrorBoundary key="recipes">
              <Recipes setToolbar={setHeaderContent} />
            </TabErrorBoundary>
          } />
          <Route path="/recipes/:id" element={
            <TabErrorBoundary key="recipes">
              <Recipes setToolbar={setHeaderContent} />
            </TabErrorBoundary>
          } />
          <Route path="/settings" element={<TabErrorBoundary key="settings"><Suspense fallback={<SuspenseFallback />}><SettingsPage /></Suspense></TabErrorBoundary>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {!isSettings && !isRecipeDetail && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="max-w-xl mx-auto flex">
            {(
              [
                { id: 'home'     as TabId, label: 'Home',     icon: <Home className="size-5" /> },
                { id: 'calendar' as TabId, label: 'Calendar', icon: <CalendarDays className="size-5" /> },
                { id: 'todos'    as TabId, label: 'Todos',    icon: <CheckSquare className="size-5" /> },
                { id: 'shopping' as TabId, label: 'Shopping', icon: <ShoppingCart className="size-5" /> },
                { id: 'recipes'  as TabId, label: 'Recipes',  icon: <BookOpen className="size-5" /> },
              ] satisfies { id: TabId; label: string; icon: ReactNode }[]
            ).map(({ id, label, icon }) => (
              <button
                key={id}
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
        <Route path="/*" element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  )
}
