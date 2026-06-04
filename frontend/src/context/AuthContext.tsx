import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setUnauthorizedHandler } from '../api/client'

interface AuthUser { email: string }
interface AuthContextValue {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = localStorage.getItem('casita_token')
    const email = localStorage.getItem('casita_email')
    return token && email ? { email } : null
  })
  const navigate = useNavigate()

  useEffect(() => {
    setUnauthorizedHandler(() => {
      localStorage.removeItem('casita_token')
      localStorage.removeItem('casita_email')
      setUser(null)
      navigate('/login', { replace: true })
    })
  }, [navigate])

  async function login(email: string, password: string) {
    const res = await api.post<{ ok: boolean; token?: string; email?: string; error?: string }>(
      '/auth/login', { email, password }
    )
    if (!res.ok || !res.token || !res.email) throw new Error(res.error ?? 'Login failed')
    localStorage.setItem('casita_token', res.token)
    localStorage.setItem('casita_email', res.email)
    setUser({ email: res.email })
  }

  async function logout() {
    try { await api.post('/auth/logout', {}) } catch { /* ignore */ }
    localStorage.removeItem('casita_token')
    localStorage.removeItem('casita_email')
    setUser(null)
    navigate('/login', { replace: true })
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
