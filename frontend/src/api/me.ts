import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { LocaleCode } from '../i18n'
import type { TabConfig } from './areas'

interface MeResponse {
  clerkUserId: string
  email: string
  locale: LocaleCode
  tabConfig: TabConfig | null
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<MeResponse>('/me'),
  })
}

export function useUpdateLocale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (locale: LocaleCode) => api.patch<{ ok: boolean; locale: LocaleCode }>('/me', { locale }),
    onSuccess: (data) => {
      qc.setQueryData(['me'], (prev: MeResponse | undefined) =>
        prev ? { ...prev, locale: data.locale } : prev,
      )
    },
  })
}

export function useUpdateTabConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tabConfig: TabConfig | null) =>
      api.patch<{ ok: boolean; tabConfig: TabConfig | null }>('/me', { tabConfig }),
    onSuccess: (data) => {
      qc.setQueryData(['me'], (prev: MeResponse | undefined) =>
        prev ? { ...prev, tabConfig: data.tabConfig } : prev,
      )
    },
  })
}
