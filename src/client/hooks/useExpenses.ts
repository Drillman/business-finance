import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Expense, CreateExpenseInput, UpdateExpenseInput, ExpenseCategory } from '@shared/types'

interface ExpenseListResponse {
  data: Expense[]
  total: number
  limit: number
  offset: number
}

interface ExpenseListParams {
  month?: string
  category?: ExpenseCategory
  isRecurring?: boolean
  limit?: number
  offset?: number
}

interface MonthlySummary {
  year: number
  month: number
  totalHt: string
  totalTax: string
  recoverableTax: string
  count: number
  byCategory: {
    category: string
    total: string
    count: number
  }[]
}

export function useExpenses(params: ExpenseListParams = {}) {
  const queryString = new URLSearchParams()
  if (params.month) queryString.set('month', params.month)
  if (params.category) queryString.set('category', params.category)
  if (params.isRecurring !== undefined) queryString.set('isRecurring', params.isRecurring.toString())
  if (params.limit) queryString.set('limit', params.limit.toString())
  if (params.offset) queryString.set('offset', params.offset.toString())

  const query = queryString.toString()
  const endpoint = query ? `/expenses?${query}` : '/expenses'

  return useQuery({
    queryKey: ['expenses', params],
    queryFn: () => api.get<ExpenseListResponse>(endpoint),
    staleTime: 1000 * 60 * 2,
  })
}

export function useExpense(id: string | null) {
  return useQuery({
    queryKey: ['expense', id],
    queryFn: () => api.get<Expense>(`/expenses/${id}`),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateExpenseInput) =>
      api.post<Expense>('/expenses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] })
    },
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseInput }) =>
      api.put<Expense>(`/expenses/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense', id] })
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] })
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] })
    },
  })
}

export function useExpenseMonthlySummary(year: number, month: number) {
  return useQuery({
    queryKey: ['expenseSummary', year, month],
    queryFn: () =>
      api.get<MonthlySummary>(`/expenses/summary/monthly?year=${year}&month=${month}`),
    staleTime: 1000 * 60 * 2,
  })
}

export function useRecurringExpenses() {
  return useQuery({
    queryKey: ['expenses', 'recurring'],
    queryFn: () => api.get<{ data: Expense[] }>('/expenses/recurring'),
    staleTime: 1000 * 60 * 2,
  })
}
