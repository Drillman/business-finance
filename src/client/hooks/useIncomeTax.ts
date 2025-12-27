import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type {
  IncomeTaxPayment,
  CreateIncomeTaxPaymentInput,
  UpdateIncomeTaxPaymentInput,
  IncomeTaxSummary,
} from '@shared/types'

interface IncomeTaxPaymentListResponse {
  data: IncomeTaxPayment[]
  total: number
  limit: number
  offset: number
}

interface IncomeTaxPaymentListParams {
  year?: number
  status?: 'pending' | 'paid'
  limit?: number
  offset?: number
}

export function useIncomeTaxPayments(params: IncomeTaxPaymentListParams = {}) {
  const queryString = new URLSearchParams()
  if (params.year) queryString.set('year', params.year.toString())
  if (params.status) queryString.set('status', params.status)
  if (params.limit) queryString.set('limit', params.limit.toString())
  if (params.offset) queryString.set('offset', params.offset.toString())

  const query = queryString.toString()
  const endpoint = query ? `/income-tax/payments?${query}` : '/income-tax/payments'

  return useQuery({
    queryKey: ['incomeTaxPayments', params],
    queryFn: () => api.get<IncomeTaxPaymentListResponse>(endpoint),
    staleTime: 1000 * 60 * 2,
  })
}

export function useIncomeTaxPayment(id: string | null) {
  return useQuery({
    queryKey: ['incomeTaxPayment', id],
    queryFn: () => api.get<IncomeTaxPayment>(`/income-tax/payments/${id}`),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  })
}

export function useCreateIncomeTaxPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateIncomeTaxPaymentInput) =>
      api.post<IncomeTaxPayment>('/income-tax/payments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomeTaxPayments'] })
      queryClient.invalidateQueries({ queryKey: ['incomeTaxSummary'] })
      queryClient.invalidateQueries({ queryKey: ['accountSummary'] })
    },
  })
}

export function useUpdateIncomeTaxPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIncomeTaxPaymentInput }) =>
      api.put<IncomeTaxPayment>(`/income-tax/payments/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['incomeTaxPayments'] })
      queryClient.invalidateQueries({ queryKey: ['incomeTaxPayment', id] })
      queryClient.invalidateQueries({ queryKey: ['incomeTaxSummary'] })
      queryClient.invalidateQueries({ queryKey: ['accountSummary'] })
    },
  })
}

export function useDeleteIncomeTaxPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/income-tax/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomeTaxPayments'] })
      queryClient.invalidateQueries({ queryKey: ['incomeTaxSummary'] })
      queryClient.invalidateQueries({ queryKey: ['accountSummary'] })
    },
  })
}

export function useIncomeTaxSummary(year: number) {
  return useQuery({
    queryKey: ['incomeTaxSummary', year],
    queryFn: () => api.get<IncomeTaxSummary>(`/income-tax/summary?year=${year}`),
    staleTime: 1000 * 60 * 2,
  })
}
