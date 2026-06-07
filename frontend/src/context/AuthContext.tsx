import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react'
import { api, setTokenGetter } from '../api/client'

// ---------------------------------------------------------------------------
// Auth context — wraps Clerk identity, keeps backward-compatible shape for
// components that import { useAuth } (App.tsx ProtectedRoute, Login, AccountSetup)
// ---------------------------------------------------------------------------

interface AuthUser { email: string }
interface AuthContextValue {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ---------------------------------------------------------------------------
// Household context — fetched from /household/me after Clerk user is loaded
// ---------------------------------------------------------------------------

export interface HouseholdState {
  householdId: string | null
  householdName: string | null
  role: 'owner' | 'member' | null
  isLoading: boolean
  refreshHousehold: () => void
}

const HouseholdContext = createContext<(HouseholdState & { refreshHousehold: () => void }) | null>(null)

// ---------------------------------------------------------------------------
// AuthProvider — registers Clerk's getToken with the api client and provides
// both the auth and household contexts to the subtree
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser()
  const { getToken, signOut } = useClerkAuth()

  // Legacy KV session state — used as fallback when no Clerk session exists.
  // Initialised from localStorage so a page refresh preserves the session.
  const [legacyUser, setLegacyUser] = useState<AuthUser | null>(() => {
    const email = localStorage.getItem('casita_email')
    const token = localStorage.getItem('casita_token')
    return email && token ? { email } : null
  })

  // Register token getter: Clerk JWT first, localStorage KV token as fallback.
  useEffect(() => {
    setTokenGetter(async () => {
      const clerkToken = await getToken()
      if (clerkToken) return clerkToken
      return localStorage.getItem('casita_token')
    })
  }, [getToken])

  // Clerk user takes precedence; fall back to legacy localStorage session.
  const authUser: AuthUser | null =
    isClerkLoaded && clerkUser
      ? { email: clerkUser.primaryEmailAddress?.emailAddress ?? '' }
      : legacyUser

  async function login(email: string, password: string) {
    const res = await api.post<{ ok: boolean; token?: string; email?: string; error?: string }>(
      '/auth/login', { email, password }
    )
    if (!res.ok || !res.token || !res.email) throw new Error(res.error ?? 'Login failed')
    localStorage.setItem('casita_token', res.token)
    localStorage.setItem('casita_email', res.email)
    setLegacyUser({ email: res.email })
  }

  async function logout() {
    try { await signOut() } catch { /* ignore */ }
    localStorage.removeItem('casita_token')
    localStorage.removeItem('casita_email')
    setLegacyUser(null)
  }

  // ---------------------------------------------------------------------------
  // Household state — fetched whenever the Clerk user changes
  // ---------------------------------------------------------------------------
  const [refreshKey, setRefreshKey] = useState(0)
  const refreshHousehold = () => setRefreshKey(k => k + 1)

  const [householdState, setHouseholdState] = useState<Omit<HouseholdState, 'refreshHousehold'>>({
    householdId: null,
    householdName: null,
    role: null,
    isLoading: true,
  })

  useEffect(() => {
    if (!isClerkLoaded) return
    if (!clerkUser) {
      setHouseholdState({ householdId: null, householdName: null, role: null, isLoading: false })
      return
    }

    let cancelled = false
    setHouseholdState(prev => ({ ...prev, isLoading: true }))

    api
      .get<{ householdId: string; householdName: string; role: 'owner' | 'member' }>('/household/me')
      .then(data => {
        if (cancelled) return
        setHouseholdState({
          householdId: data.householdId,
          householdName: data.householdName,
          role: data.role,
          isLoading: false,
        })
      })
      .catch(() => {
        if (cancelled) return
        setHouseholdState({ householdId: null, householdName: null, role: null, isLoading: false })
      })

    return () => { cancelled = true }
  }, [clerkUser, isClerkLoaded, refreshKey])

  return (
    <AuthContext.Provider value={{ user: authUser, login, logout }}>
      <HouseholdContext.Provider value={{ ...householdState, refreshHousehold }}>
        {children}
      </HouseholdContext.Provider>
    </AuthContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function useHousehold(): HouseholdState & { refreshHousehold: () => void } {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used inside AuthProvider')
  return ctx
}
