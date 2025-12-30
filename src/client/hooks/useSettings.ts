import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Settings, UpdateSettingsInput } from '@shared/types'

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    staleTime: 1000 * 60 * 5,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateSettingsInput) =>
      api.put<Settings>('/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      // Also invalidate income-tax summary since additionalTaxableIncome affects it
      queryClient.invalidateQueries({ queryKey: ['incomeTaxSummary'] })
    },
  })
}
