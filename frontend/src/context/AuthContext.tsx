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
}

const HouseholdContext = createContext<HouseholdState | null>(null)

// ---------------------------------------------------------------------------
// AuthProvider — registers Clerk's getToken with the api client and provides
// both the auth and household contexts to the subtree
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser()
  const { getToken, signOut } = useClerkAuth()

  // Register Clerk's getToken as the api client's token getter on mount.
  // This replaces the localStorage fallback for all api requests.
  useEffect(() => {
    setTokenGetter(() => getToken())
  }, [getToken])

  // Derive auth user from Clerk user
  const authUser: AuthUser | null =
    isClerkLoaded && clerkUser
      ? { email: clerkUser.primaryEmailAddress?.emailAddress ?? '' }
      : null

  // login/logout are kept for backward compat with Login.tsx / AccountSetup.tsx.
  // They will be replaced by Clerk's own UI flows in a later wave; for now they
  // call the legacy API endpoint and are no-ops in the Clerk sense.
  async function login(email: string, password: string) {
    // Legacy path: call the old /auth/login endpoint. The token returned is
    // stored in localStorage as fallback until Clerk session is established.
    const res = await api.post<{ ok: boolean; token?: string; email?: string; error?: string }>(
      '/auth/login', { email, password }
    )
    if (!res.ok || !res.token || !res.email) throw new Error(res.error ?? 'Login failed')
    localStorage.setItem('casita_token', res.token)
    localStorage.setItem('casita_email', res.email)
  }

  async function logout() {
    try { await signOut() } catch { /* ignore */ }
    localStorage.removeItem('casita_token')
    localStorage.removeItem('casita_email')
  }

  // ---------------------------------------------------------------------------
  // Household state — fetched whenever the Clerk user changes
  // ---------------------------------------------------------------------------
  const [householdState, setHouseholdState] = useState<HouseholdState>({
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
      .get<{ householdId: string; name: string; role: 'owner' | 'member' }>('/household/me')
      .then(data => {
        if (cancelled) return
        setHouseholdState({
          householdId: data.householdId,
          householdName: data.name,
          role: data.role,
          isLoading: false,
        })
      })
      .catch(() => {
        if (cancelled) return
        setHouseholdState({ householdId: null, householdName: null, role: null, isLoading: false })
      })

    return () => { cancelled = true }
  }, [clerkUser, isClerkLoaded])

  return (
    <AuthContext.Provider value={{ user: authUser, login, logout }}>
      <HouseholdContext.Provider value={householdState}>
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

/** Alias kept so callers can import { HouseholdProvider } if they prefer */
export const HouseholdProvider = AuthProvider

export function useHousehold(): HouseholdState {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used inside AuthProvider')
  return ctx
}
