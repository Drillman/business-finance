import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { TaxPayment, CreateTaxPaymentInput, UpdateTaxPaymentInput } from '@shared/types'

interface TaxPaymentListResponse {
  data: TaxPayment[]
  total: number
  limit: number
  offset: number
}

interface TaxPaymentListParams {
  year?: number
  status?: 'pending' | 'paid'
  limit?: number
  offset?: number
}

interface TvaSummary {
  startDate: string
  endDate: string
  tvaCollected: string
  tvaRecoverable: string
  netTva: string
  totalPaid: string
  totalPending: string
  balance: string
}

interface MonthlyTvaData {
  month: number
  year: number
  tvaCollected: string
  tvaRecoverable: string
  netTva: string
  paidAmount: string
  pendingAmount: string
  dueDate: string
  paymentStatus: 'paid' | 'pending' | 'due' | 'overdue' | 'upcoming' | 'not_due'
}

interface MonthlyTvaResponse {
  year: number
  months: MonthlyTvaData[]
}

export function useTaxPayments(params: TaxPaymentListParams = {}) {
  const queryString = new URLSearchParams()
  if (params.year) queryString.set('year', params.year.toString())
  if (params.status) queryString.set('status', params.status)
  if (params.limit) queryString.set('limit', params.limit.toString())
  if (params.offset) queryString.set('offset', params.offset.toString())

  const query = queryString.toString()
  const endpoint = query ? `/tva/payments?${query}` : '/tva/payments'

  return useQuery({
    queryKey: ['taxPayments', params],
    queryFn: () => api.get<TaxPaymentListResponse>(endpoint),
    staleTime: 1000 * 60 * 2,
  })
}

export function useTaxPayment(id: string | null) {
  return useQuery({
    queryKey: ['taxPayment', id],
    queryFn: () => api.get<TaxPayment>(`/tva/payments/${id}`),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  })
}

export function useCreateTaxPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateTaxPaymentInput) =>
      api.post<TaxPayment>('/tva/payments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxPayments'] })
      queryClient.invalidateQueries({ queryKey: ['tvaSummary'] })
      queryClient.invalidateQueries({ queryKey: ['monthlyTva'] })
    },
  })
}

export function useUpdateTaxPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaxPaymentInput }) =>
      api.put<TaxPayment>(`/tva/payments/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['taxPayments'] })
      queryClient.invalidateQueries({ queryKey: ['taxPayment', id] })
      queryClient.invalidateQueries({ queryKey: ['tvaSummary'] })
      queryClient.invalidateQueries({ queryKey: ['monthlyTva'] })
    },
  })
}

export function useDeleteTaxPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/tva/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxPayments'] })
      queryClient.invalidateQueries({ queryKey: ['tvaSummary'] })
      queryClient.invalidateQueries({ queryKey: ['monthlyTva'] })
    },
  })
}

export function useTvaSummary(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['tvaSummary', startDate, endDate],
    queryFn: () =>
      api.get<TvaSummary>(`/tva/summary?startDate=${startDate}&endDate=${endDate}`),
    enabled: !!startDate && !!endDate,
    staleTime: 1000 * 60 * 2,
  })
}

export function useMonthlyTva(year: number) {
  return useQuery({
    queryKey: ['monthlyTva', year],
    queryFn: () => api.get<MonthlyTvaResponse>(`/tva/monthly?year=${year}`),
    staleTime: 1000 * 60 * 2,
  })
}
