import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { User, LoginInput, RegisterInput, AuthResponse, Passkey } from '@shared/types'

export function useUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: () => api.get<User>('/auth/me'),
    retry: false,
    staleTime: 1000 * 60 * 5,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: LoginInput) =>
      api.post<AuthResponse>('/auth/login', data),
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data.user)
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: RegisterInput) =>
      api.post<AuthResponse>('/auth/register', data),
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data.user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(['user'], null)
      queryClient.clear()
    },
  })
}

export function useRefreshToken() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.post<AuthResponse>('/auth/refresh'),
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data.user)
    },
  })
}

// Passkey hooks
export function usePasskeys() {
  return useQuery({
    queryKey: ['passkeys'],
    queryFn: () => api.get<Passkey[]>('/passkeys'),
    staleTime: 1000 * 60 * 5,
  })
}

export function useDeletePasskey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/passkeys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] })
    },
  })
}

export function useRenamePasskey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, deviceName }: { id: string; deviceName: string }) =>
      api.patch<{ success: boolean }>(`/passkeys/${id}`, { deviceName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] })
    },
  })
}
