import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => api.delete('/account'),
  })
}

export function useExportAccount() {
  return useMutation({
    mutationFn: async () => {
      const blob = await api.blob('/account/export')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'casita-export.json'
      a.click()
      URL.revokeObjectURL(url)
    },
  })
}

export interface CommsPreferences {
  email_notifications_enabled: boolean
  email_frequency: 'instant' | 'off'
}

export function useCommsPreferences() {
  return useQuery({
    queryKey: ['comms-preferences'],
    queryFn: () => api.get<CommsPreferences>('/account/comms-preferences'),
  })
}

export function useUpdateCommsPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (prefs: CommsPreferences) =>
      api.patch<{ ok: boolean }>('/account/comms-preferences', prefs),
    onSuccess: (_data, variables) => {
      qc.setQueryData(['comms-preferences'], variables)
    },
  })
}
