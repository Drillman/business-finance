import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { AccountBalance, AccountSummary } from '@shared/types'

export function useAccountBalance() {
  return useQuery({
    queryKey: ['accountBalance'],
    queryFn: () => api.get<AccountBalance>('/account/balance'),
    staleTime: 1000 * 60 * 2,
  })
}

export function useUpdateAccountBalance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (balance: number) =>
      api.put<AccountBalance>('/account/balance', { balance }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountBalance'] })
      queryClient.invalidateQueries({ queryKey: ['accountSummary'] })
    },
  })
}

export function useAccountSummary() {
  return useQuery({
    queryKey: ['accountSummary'],
    queryFn: () => api.get<AccountSummary>('/account/summary'),
    staleTime: 1000 * 60 * 2,
  })
}
