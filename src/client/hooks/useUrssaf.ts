import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { UrssafPayment, CreateUrssafPaymentInput, UpdateUrssafPaymentInput } from '@shared/types'

interface UrssafPaymentListResponse {
  data: UrssafPayment[]
  total: number
  limit: number
  offset: number
}

interface UrssafPaymentListParams {
  year?: number
  status?: 'pending' | 'paid'
  limit?: number
  offset?: number
}

interface TrimesterData {
  trimester: number
  startDate: string
  endDate: string
  actualRevenue: string
  estimatedAmount: string
  payment: UrssafPayment | null
}

interface UrssafSummary {
  year: number
  urssafRate: number
  trimesters: TrimesterData[]
  totals: {
    totalRevenue: string
    totalAmount: string
    totalPaid: string
    totalPending: string
  }
}

interface UrssafCalculation {
  revenue: string
  rate: number
  amount: string
}

export function useUrssafPayments(params: UrssafPaymentListParams = {}) {
  const queryString = new URLSearchParams()
  if (params.year) queryString.set('year', params.year.toString())
  if (params.status) queryString.set('status', params.status)
  if (params.limit) queryString.set('limit', params.limit.toString())
  if (params.offset) queryString.set('offset', params.offset.toString())

  const query = queryString.toString()
  const endpoint = query ? `/urssaf/payments?${query}` : '/urssaf/payments'

  return useQuery({
    queryKey: ['urssafPayments', params],
    queryFn: () => api.get<UrssafPaymentListResponse>(endpoint),
    staleTime: 1000 * 60 * 2,
  })
}

export function useUrssafPayment(id: string | null) {
  return useQuery({
    queryKey: ['urssafPayment', id],
    queryFn: () => api.get<UrssafPayment>(`/urssaf/payments/${id}`),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  })
}

export function useCreateUrssafPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateUrssafPaymentInput) =>
      api.post<UrssafPayment>('/urssaf/payments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['urssafPayments'] })
      queryClient.invalidateQueries({ queryKey: ['urssafSummary'] })
    },
  })
}

export function useUpdateUrssafPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUrssafPaymentInput }) =>
      api.put<UrssafPayment>(`/urssaf/payments/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['urssafPayments'] })
      queryClient.invalidateQueries({ queryKey: ['urssafPayment', id] })
      queryClient.invalidateQueries({ queryKey: ['urssafSummary'] })
    },
  })
}

export function useDeleteUrssafPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/urssaf/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['urssafPayments'] })
      queryClient.invalidateQueries({ queryKey: ['urssafSummary'] })
    },
  })
}

export function useUrssafSummary(year: number) {
  return useQuery({
    queryKey: ['urssafSummary', year],
    queryFn: () => api.get<UrssafSummary>(`/urssaf/summary?year=${year}`),
    staleTime: 1000 * 60 * 2,
  })
}

export function useCalculateUrssaf() {
  return useMutation({
    mutationFn: (revenue: number) =>
      api.post<UrssafCalculation>('/urssaf/calculate', { revenue }),
  })
}
