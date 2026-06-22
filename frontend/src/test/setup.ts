import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from './msw-server'

// Node.js 22 declares `localStorage` as undefined unless --localstorage-file is provided.
// jsdom does not always override this in Vitest's environment setup, which causes api/client.ts
// (which calls localStorage.getItem for the auth token) to throw inside mutation functions.
if (typeof localStorage === 'undefined') {
  const _store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => _store[key] ?? null,
    setItem: (key: string, value: string) => { _store[key] = value },
    removeItem: (key: string) => { delete _store[key] },
    clear: () => { Object.keys(_store).forEach(k => delete _store[k]) },
    key: (n: number) => Object.keys(_store)[n] ?? null,
    get length() { return Object.keys(_store).length },
  })
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
