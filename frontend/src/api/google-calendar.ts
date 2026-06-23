import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { calendarKeys } from './calendar'
import type { UserCalendar, ConnectedAccount } from './types'

export const googleCalendarKeys = {
  status:    ['google-calendar', 'status'] as const,
  calendars: ['google-calendar', 'calendars'] as const,
}

export function useGoogleStatus() {
  return useQuery({
    queryKey: googleCalendarKeys.status,
    queryFn: () => api.get<{ accounts: ConnectedAccount[] }>('/auth/google/status'),
    staleTime: 5 * 60 * 1000,
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
    onMutate: async (calendars) => {
      await qc.cancelQueries({ queryKey: googleCalendarKeys.calendars })
      const previous = qc.getQueryData<{ calendars: UserCalendar[]; connected: boolean }>(googleCalendarKeys.calendars)
      qc.setQueryData<{ calendars: UserCalendar[]; connected: boolean }>(
        googleCalendarKeys.calendars,
        old => old ? { ...old, calendars } : old
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(googleCalendarKeys.calendars, ctx.previous)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: googleCalendarKeys.calendars })
      qc.invalidateQueries({ queryKey: calendarKeys.all })
    },
  })
}

export function useDisconnectGoogle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (accountEmail?: string) =>
      accountEmail
        ? api.delete(`/auth/google?account=${encodeURIComponent(accountEmail)}`)
        : api.delete('/auth/google'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: googleCalendarKeys.status })
      qc.invalidateQueries({ queryKey: googleCalendarKeys.calendars })
      qc.invalidateQueries({ queryKey: calendarKeys.all })
    },
  })
}

export async function initiateGoogleConnect(): Promise<void> {
  const { url } = await api.get<{ url: string }>('/auth/google')
  window.location.href = url
}
