import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { calendarKeys } from './calendar'
import type { UserCalendar } from './types'

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
      qc.invalidateQueries({ queryKey: calendarKeys.all })
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

export async function initiateGoogleConnect(): Promise<void> {
  const { url } = await api.get<{ url: string }>('/auth/google')
  window.location.href = url
}
