import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { UserCalendar } from './types'

const BASE_URL = (import.meta.env.VITE_WORKER_URL as string | undefined) || 'http://localhost:8787'

export const googleCalendarKeys = {
  status:    ['google-calendar', 'status'] as const,
  calendars: ['google-calendar', 'calendars'] as const,
}

export function useGoogleStatus() {
  return useQuery({
    queryKey: googleCalendarKeys.status,
    queryFn: () => api.get<{ connected: boolean }>('/auth/google/status'),
    staleTime: 0,
  })
}

export function useUserCalendars() {
  return useQuery({
    queryKey: googleCalendarKeys.calendars,
    queryFn: () => api.get<{ calendars: UserCalendar[], connected: boolean }>('/user-calendars'),
    staleTime: 0,
  })
}

export function useUpdateUserCalendars() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (calendars: UserCalendar[]) => api.put<{ ok: boolean }>('/user-calendars', calendars),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: googleCalendarKeys.calendars })
    },
  })
}

export function useDisconnectGoogle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete('/auth/google'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: googleCalendarKeys.status })
      qc.invalidateQueries({ queryKey: googleCalendarKeys.calendars })
    },
  })
}

export function buildGoogleConnectUrl(): string {
  return `${BASE_URL}/auth/google?session=${localStorage.getItem('casita_token') ?? ''}`
}
