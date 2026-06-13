import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { LocaleCode } from '../i18n'

interface MeResponse {
  clerkUserId: string
  email: string
  locale: LocaleCode
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
