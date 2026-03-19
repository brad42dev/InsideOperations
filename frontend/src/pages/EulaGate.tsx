import React, { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { authApi } from '../api/auth'
import { LoadingSpinner } from '../shared/components/PermissionGuard'

interface EulaGateProps {
  children: React.ReactNode
}

export default function EulaGate({ children }: EulaGateProps) {
  const { user, pendingEulas, setPendingEulas } = useAuthStore()

  // Fetch pending EULAs when state is unknown (hydrated session, not fresh login)
  // After a fresh login the store already has eula_accepted set from login response.
  const needsCheck = user !== null && pendingEulas === null

  const { data, isLoading, isError } = useQuery({
    queryKey: ['eula-pending'],
    queryFn: async () => {
      const result = await authApi.eulaGetPending()
      if (result.success) return result.data
      throw new Error(result.error?.message ?? 'Failed to check pending EULAs')
    },
    enabled: needsCheck,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  useEffect(() => {
    if (data !== undefined) {
      setPendingEulas(data)
    }
  }, [data, setPendingEulas])

  // Still checking
  if (needsCheck && isLoading) return <LoadingSpinner />

  // If the check fails (network error, expired JWT, etc.), let through —
  // PermissionGuard will handle any real auth failure.
  if (needsCheck && isError) return <>{children}</>

  // Determine pending state
  const pending = pendingEulas ?? (data ?? null)

  if (pending !== null && pending.length > 0) {
    return <Navigate to="/eula" replace />
  }

  return <>{children}</>
}
