import { useState, useEffect, type ReactNode } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import RefreshIcon from '@mui/icons-material/Refresh'
import SettingsIcon from '@mui/icons-material/Settings'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import HomeIcon from '@mui/icons-material/Home'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { itemKeys, itemsApi, todoKeys, todosApi, recipeKeys } from './api'
import { useOnlineStatus } from './useOnlineStatus'
import { TabErrorBoundary } from './components/TabErrorBoundary'
import Home from './components/Home'
import Calendar from './components/Calendar'
import Todos from './components/Todos'
import Shopping from './components/Shopping'
import Recipes from './components/Recipes'
import RecipeFormPage from './components/RecipeFormPage'
import PublicRecipeView from './components/PublicRecipeView'
import Settings from './components/Settings'
import { SignIn, SignedIn, useUser } from '@clerk/clerk-react'
import { AuthProvider, useAuth, useHousehold } from './context/AuthContext'
import AccountSetup from './components/AccountSetup'
import HouseholdSetup from './components/HouseholdSetup'

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

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { householdId, isLoading: isHouseholdLoading } = useHousehold()
  const { isSignedIn: isClerkSignedIn, isLoaded: isClerkLoaded } = useUser()
  const location = useLocation()

  // Wait for Clerk to finish loading before making any auth decision.
  // Without this, we redirect to /sign-in on every load even for signed-in users.
  if (!isClerkLoaded) return null

  // Not authenticated → sign-in
  if (!user) return <Navigate to="/sign-in" state={{ from: location }} replace />

  // Clerk user: wait for household fetch, then redirect to setup if needed
  if (isClerkSignedIn) {
    if (isHouseholdLoading) return null
    if (householdId === null) return <Navigate to="/household/setup" replace />
  }

  return <>{children}</>
}

// Redirects already-signed-in users away from the sign-in page to prevent
// Clerk from looping when it detects a live session on its own SignIn component.
function SignInPage() {
  const { isSignedIn, isLoaded } = useUser()
  if (!isLoaded) return null
  if (isSignedIn) return <Navigate to="/" replace />
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <SignIn routing="virtual" />
    </Box>
  )
}

function AppShell() {
  const [recipeDetailBar, setRecipeDetailBar] = useState<ReactNode | null>(null)
  const qc = useQueryClient()
  const isOnline = useOnlineStatus()
  const navigate = useNavigate()
  const location = useLocation()

  const activeTab = pathnameToTab(location.pathname)
  const isSettings = location.pathname === '/settings'

  useEffect(() => {
    qc.prefetchQuery({ queryKey: itemKeys.shopping, queryFn: itemsApi.listShopping })
    qc.prefetchQuery({ queryKey: todoKeys.all,      queryFn: todosApi.list })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRefresh() {
    if (activeTab === 'shopping') {
      qc.invalidateQueries({ queryKey: itemKeys.shopping })
      qc.invalidateQueries({ queryKey: itemKeys.all })
    } else if (activeTab === 'recipes') {
      qc.invalidateQueries({ queryKey: recipeKeys.all })
    }
  }

  const canRefresh = activeTab === 'shopping' || activeTab === 'recipes'

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="inherit" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ px: { xs: 2 } }}>
          {recipeDetailBar ?? (
            isSettings ? (
              <>
                <IconButton onClick={() => navigate('/calendar')} size="small" color="inherit" edge="start">
                  <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ flex: 1 }}>
                  Settings
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ flex: 1 }}>
                  Casita
                </Typography>
                {canRefresh && (
                  <IconButton onClick={handleRefresh} size="small" color="inherit">
                    <RefreshIcon />
                  </IconButton>
                )}
                {activeTab === 'calendar' && (
                  <IconButton onClick={() => navigate('/settings')} size="small" color="inherit">
                    <SettingsIcon />
                  </IconButton>
                )}
              </>
            )
          )}
        </Toolbar>
      </AppBar>

      {!isOnline && (
        <Alert
          severity="warning"
          icon={<WifiOffIcon fontSize="small" />}
          sx={{ borderRadius: 0, py: 0.5 }}
        >
          Offline — showing cached data
        </Alert>
      )}

      <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 2, paddingBottom: isSettings ? 2 : 'calc(80px + env(safe-area-inset-bottom))' }}>
        <Routes>
          <Route path="/" element={
            <TabErrorBoundary key="home">
              <Home />
            </TabErrorBoundary>
          } />
          <Route path="/calendar" element={
            <TabErrorBoundary key="calendar">
              <Calendar />
            </TabErrorBoundary>
          } />
          <Route path="/todos" element={
            <TabErrorBoundary key="todos">
              <Todos />
            </TabErrorBoundary>
          } />
          <Route path="/shopping/*" element={
            <TabErrorBoundary key="shopping">
              <Shopping />
            </TabErrorBoundary>
          } />
          <Route path="/recipes" element={
            <TabErrorBoundary key="recipes">
              <Recipes setToolbar={setRecipeDetailBar} />
            </TabErrorBoundary>
          } />
          <Route path="/recipes/:id" element={
            <TabErrorBoundary key="recipes">
              <Recipes setToolbar={setRecipeDetailBar} />
            </TabErrorBoundary>
          } />
          <Route path="/settings" element={<TabErrorBoundary key="settings"><Settings /></TabErrorBoundary>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>

      {!isSettings && (
        <Paper
          elevation={0}
          sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100, paddingBottom: 'env(safe-area-inset-bottom)', borderTop: '1px solid', borderColor: 'divider' }}
        >
          <BottomNavigation
            value={activeTab}
            onChange={(_, v: TabId) => navigate(TAB_PATHS[v])}
            sx={{ maxWidth: 600, mx: 'auto' }}
          >
            <BottomNavigationAction label="Home"     value="home"     icon={<HomeIcon />} />
            <BottomNavigationAction label="Calendar" value="calendar" icon={<CalendarMonthIcon />} />
            <BottomNavigationAction label="Todos"    value="todos"    icon={<CheckBoxIcon />} />
            <BottomNavigationAction label="Shopping" value="shopping" icon={<ShoppingCartIcon />} />
            <BottomNavigationAction label="Recipes"  value="recipes"  icon={<MenuBookIcon />} />
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Navigate to="/sign-in" replace />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/setup" element={<AccountSetup />} />
        <Route path="/share/:token" element={<PublicRecipeView />} />
        <Route path="/household/setup" element={<SignedIn><HouseholdSetup /></SignedIn>} />
        <Route path="/recipes/new" element={
          <ProtectedRoute>
            <RecipeFormPage />
          </ProtectedRoute>
        } />
        <Route path="/recipes/:id/edit" element={
          <ProtectedRoute>
            <RecipeFormPage />
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
