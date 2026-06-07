const BASE_URL = (import.meta.env.VITE_WORKER_URL as string | undefined) || 'http://localhost:8787'

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn }

// Module-level async token getter. When set (e.g. by Clerk), used instead of localStorage.
let getTokenFn: (() => Promise<string | null>) | null = null
export function setTokenGetter(fn: () => Promise<string | null>) { getTokenFn = fn }

async function getToken(): Promise<string | null> {
  if (getTokenFn) return getTokenFn()
  return localStorage.getItem('casita_token')
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken()
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeader, ...init?.headers },
  })

  if (res.status === 204) return undefined as T

  const data = await res.json()
  if (res.status === 401) {
    console.warn('[casita] 401 on:', path, '— token present:', !!token)
    if (token) onUnauthorized?.()
    throw new ApiError(401, (data as { error?: string }).error ?? 'Unauthorized')
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? res.statusText)
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
}

export async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function uploadPhoto(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const token = await getToken()
  const res = await fetch(`${BASE_URL}/recipe-photos`, {
    method: 'POST',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  const data = await res.json()
  if (res.status === 401) {
    if (token) onUnauthorized?.()
    throw new ApiError(401, (data as { error?: string }).error ?? 'Unauthorized')
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? res.statusText)
  return (data as { url: string }).url
}
