import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { CalendarEvent } from './types'

export const calendarKeys = {
  all: ['calendar'] as const,
}

export function useCalendarEvents() {
  return useQuery({ queryKey: calendarKeys.all, queryFn: () => api.get<CalendarEvent[]>('/calendar') })
}
