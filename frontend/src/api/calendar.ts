import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { CalendarEvent } from './types'

export const calendarKeys = {
  all:   ['calendar'] as const,
  range: (timeMin: string, timeMax: string) => ['calendar', timeMin, timeMax] as const,
}

export function useCalendarEvents(timeMin: string, timeMax: string) {
  return useQuery({
    queryKey: calendarKeys.range(timeMin, timeMax),
    queryFn: () => {
      const params = new URLSearchParams({ timeMin, timeMax })
      return api.get<CalendarEvent[]>(`/calendar?${params}`)
    },
    staleTime: 5 * 60 * 1000,
  })
}
