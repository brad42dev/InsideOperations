import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

// ---------------------------------------------------------------------------
// LoadingSpinner
// ---------------------------------------------------------------------------
export function LoadingSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--io-border)',
          borderTopColor: 'var(--io-accent)',
          borderRadius: '50%',
          animation: 'io-spin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes io-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ForbiddenPage
// ---------------------------------------------------------------------------
export function ForbiddenPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: 'var(--io-text-secondary)',
        gap: '12px',
      }}
    >
      <span style={{ fontSize: '48px' }}>⊘</span>
      <h2
        style={{
          margin: 0,
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--io-text-primary)',
        }}
      >
        Access Denied
      </h2>
      <p style={{ margin: 0, fontSize: '14px' }}>
        You do not have permission to view this page.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PermissionGuard
// ---------------------------------------------------------------------------
interface PermissionGuardProps {
  permission: string | null
  children: React.ReactNode
}

export default function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) return <LoadingSpinner />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (permission && !user?.permissions.includes(permission)) return <ForbiddenPage />
  return <>{children}</>
}
