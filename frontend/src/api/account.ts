import { useMutation } from '@tanstack/react-query'
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
