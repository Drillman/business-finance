import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { DashboardSummary } from '@shared/types'

export function useDashboardSummary(year: number, month: number) {
  return useQuery({
    queryKey: ['dashboardSummary', year, month],
    queryFn: () =>
      api.get<DashboardSummary>(`/dashboard/summary?year=${year}&month=${month}`),
    staleTime: 1000 * 60 * 2,
  })
}
