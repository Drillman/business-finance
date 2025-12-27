import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useUser, useLogout, useRefreshToken } from '../hooks/useAuth'
import type { User } from '@shared/types'

interface AuthContextType {
  user: User | null | undefined
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => void
  isLoggingOut: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, error } = useUser()
  const logoutMutation = useLogout()
  const refreshMutation = useRefreshToken()
  const queryClient = useQueryClient()

  // Try to refresh token on 401 error
  useEffect(() => {
    if (error && (error as Error).message === 'Non autorisé') {
      refreshMutation.mutate(undefined, {
        onError: () => {
          queryClient.setQueryData(['user'], null)
        },
      })
    }
  }, [error, refreshMutation, queryClient])

  const logout = () => {
    logoutMutation.mutate()
  }

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isAuthenticated: !!user,
        logout,
        isLoggingOut: logoutMutation.isPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
