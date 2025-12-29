import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Invoice, CreateInvoiceInput, UpdateInvoiceInput } from '@shared/types'

interface InvoiceListResponse {
  data: Invoice[]
  total: number
  limit: number
  offset: number
}

interface InvoiceListParams {
  month?: string
  year?: number
  client?: string
  limit?: number
  offset?: number
}

interface MonthlySummary {
  year: number
  month: number
  totalHt: string
  totalTtc: string
  taxTotal: string
  count: number
}

interface YearlySummary {
  year: number
  totalHt: string
  totalTtc: string
  taxTotal: string
  count: number
}

export function useInvoices(params: InvoiceListParams = {}) {
  const queryString = new URLSearchParams()
  if (params.month) queryString.set('month', params.month)
  if (params.year) queryString.set('year', params.year.toString())
  if (params.client) queryString.set('client', params.client)
  if (params.limit) queryString.set('limit', params.limit.toString())
  if (params.offset) queryString.set('offset', params.offset.toString())

  const query = queryString.toString()
  const endpoint = query ? `/invoices?${query}` : '/invoices'

  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => api.get<InvoiceListResponse>(endpoint),
    staleTime: 1000 * 60 * 2,
  })
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get<Invoice>(`/invoices/${id}`),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateInvoiceInput) =>
      api.post<Invoice>('/invoices', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoiceSummary'] })
    },
  })
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInvoiceInput }) =>
      api.put<Invoice>(`/invoices/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
      queryClient.invalidateQueries({ queryKey: ['invoiceSummary'] })
    },
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoiceSummary'] })
    },
  })
}

export function useInvoiceMonthlySummary(year: number, month: number) {
  return useQuery({
    queryKey: ['invoiceSummary', year, month],
    queryFn: () =>
      api.get<MonthlySummary>(`/invoices/summary/monthly?year=${year}&month=${month}`),
    staleTime: 1000 * 60 * 2,
  })
}

export function useInvoiceYearlySummary(year: number) {
  return useQuery({
    queryKey: ['invoiceSummary', 'yearly', year],
    queryFn: () =>
      api.get<YearlySummary>(`/invoices/summary/yearly?year=${year}`),
    staleTime: 1000 * 60 * 2,
  })
}

export function useNextInvoiceNumber() {
  return useQuery({
    queryKey: ['invoices', 'nextNumber'],
    queryFn: () => api.get<{ invoiceNumber: string }>('/invoices/next-number'),
    staleTime: 0,
  })
}

export function useInvoiceClients() {
  return useQuery({
    queryKey: ['invoices', 'clients'],
    queryFn: () => api.get<{ clients: string[] }>('/invoices/clients'),
    staleTime: 1000 * 60 * 5,
  })
}

export function useInvoiceDescriptions() {
  return useQuery({
    queryKey: ['invoices', 'descriptions'],
    queryFn: () => api.get<{ descriptions: string[] }>('/invoices/descriptions'),
    staleTime: 1000 * 60 * 5,
  })
}
