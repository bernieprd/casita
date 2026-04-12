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
import WifiOffIcon from '@mui/icons-material/WifiOff'
import HomeIcon from '@mui/icons-material/Home'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import { useQueryClient } from '@tanstack/react-query'
import { itemKeys, itemsApi, todoKeys, todosApi, recipeKeys } from './api'
import { useOnlineStatus } from './useOnlineStatus'
import { TabErrorBoundary } from './components/TabErrorBoundary'
import Home from './components/Home'
import Calendar from './components/Calendar'
import Todos from './components/Todos'
import Shopping from './components/Shopping'
import Recipes from './components/Recipes'

export type TabId = 'home' | 'calendar' | 'todos' | 'shopping' | 'recipes'

export default function App() {
  const [tab, setTab] = useState<TabId>('home')
  const [recipeDeepLink, setRecipeDeepLink] = useState<string | null>(null)
  const [recipeDetailBar, setRecipeDetailBar] = useState<ReactNode | null>(null)
  const qc = useQueryClient()
  const isOnline = useOnlineStatus()

  // Prime the Workbox cache on first load so shopping list + todos are
  // available offline even before the user visits those tabs.
  useEffect(() => {
    qc.prefetchQuery({ queryKey: itemKeys.shopping, queryFn: itemsApi.listShopping })
    qc.prefetchQuery({ queryKey: todoKeys.all,      queryFn: todosApi.list })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleNavigate(nextTab: TabId, recipeId?: string) {
    if (recipeId) setRecipeDeepLink(recipeId)
    setTab(nextTab)
  }

  function handleRefresh() {
    if (tab === 'shopping') {
      qc.invalidateQueries({ queryKey: itemKeys.shopping })
      qc.invalidateQueries({ queryKey: itemKeys.all })
    } else if (tab === 'recipes') {
      qc.invalidateQueries({ queryKey: recipeKeys.all })
    }
  }

  const canRefresh = tab === 'shopping' || tab === 'recipes'

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="inherit" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ px: { xs: 2 } }}>
          {recipeDetailBar ?? (
            <>
              <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ flex: 1 }}>
                Casita
              </Typography>
              {canRefresh && (
                <IconButton onClick={handleRefresh} size="small" color="inherit">
                  <RefreshIcon />
                </IconButton>
              )}
            </>
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

      <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 2, paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        {tab === 'home'     && <TabErrorBoundary key="home">    <Home onNavigate={handleNavigate} /></TabErrorBoundary>}
        {tab === 'calendar' && <TabErrorBoundary key="calendar"><Calendar /></TabErrorBoundary>}
        {tab === 'todos'    && <TabErrorBoundary key="todos">   <Todos /></TabErrorBoundary>}
        {tab === 'shopping' && <TabErrorBoundary key="shopping"><Shopping /></TabErrorBoundary>}
        {tab === 'recipes'  && (
          <TabErrorBoundary key="recipes">
            <Recipes
              initialRecipeId={recipeDeepLink}
              onInitialRecipeIdConsumed={() => setRecipeDeepLink(null)}
              setToolbar={setRecipeDetailBar}
            />
          </TabErrorBoundary>
        )}
      </Box>

      <Paper
        elevation={0}
        sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100, paddingBottom: 'env(safe-area-inset-bottom)', borderTop: '1px solid', borderColor: 'divider' }}
      >
        <BottomNavigation
          value={tab}
          onChange={(_, v: TabId) => setTab(v)}
          sx={{ maxWidth: 600, mx: 'auto' }}
        >
          <BottomNavigationAction label="Home"     value="home"     icon={<HomeIcon />} />
          <BottomNavigationAction label="Calendar" value="calendar" icon={<CalendarMonthIcon />} />
          <BottomNavigationAction label="Todos"    value="todos"    icon={<CheckBoxIcon />} />
          <BottomNavigationAction label="Shopping" value="shopping" icon={<ShoppingCartIcon />} />
          <BottomNavigationAction label="Recipes"  value="recipes"  icon={<MenuBookIcon />} />
        </BottomNavigation>
      </Paper>
    </Box>
  )
}
