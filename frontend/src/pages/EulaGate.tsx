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
  const { user, setEulaAccepted } = useAuthStore()

  // Only fetch when status is unknown (hydrated session, not fresh login)
  const needsCheck = user?.eula_accepted === undefined

  const { data, isLoading, isError } = useQuery({
    queryKey: ['eula-status'],
    queryFn: async () => {
      const result = await authApi.eulaStatus()
      if (result.success) return result.data
      // Throw so isError is set — do NOT return accepted:false, which would
      // redirect to /eula even when the failure is a network error or expired JWT.
      throw new Error(result.error?.message ?? 'Failed to check EULA status')
    },
    enabled: needsCheck,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  useEffect(() => {
    if (data !== undefined) {
      setEulaAccepted(data.accepted)
    }
  }, [data, setEulaAccepted])

  // Still checking
  if (needsCheck && isLoading) return <LoadingSpinner />

  // If the status check itself fails (network error, expired JWT, etc.), let the user
  // through — PermissionGuard will handle any real auth failure, and we should not
  // redirect to /eula based on a transient query error.
  if (needsCheck && isError) return <>{children}</>

  // Determine accepted state: from store if known, from query result if just fetched
  const accepted = user?.eula_accepted !== undefined ? user.eula_accepted : data?.accepted

  if (accepted === false) return <Navigate to="/eula" replace />

  return <>{children}</>
}
