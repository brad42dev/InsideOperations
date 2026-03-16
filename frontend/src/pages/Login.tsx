import React, { useState, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { authProvidersApi, PublicProvider } from '../api/authProviders'
import { api } from '../api/client'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, isLoading, isAuthenticated, user } = useAuthStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(searchParams.get('error'))

  // LDAP provider-specific login state
  const [ldapProviderId, setLdapProviderId] = useState<string | null>(null)
  const [ldapUsername, setLdapUsername] = useState('')
  const [ldapPassword, setLdapPassword] = useState('')
  const [ldapLoading, setLdapLoading] = useState(false)

  // Fetch public SSO providers
  const { data: providersResult } = useQuery({
    queryKey: ['public-auth-providers'],
    queryFn: () => authProvidersApi.listPublic(),
    staleTime: 5 * 60 * 1000,
  })
  const ssoProviders: PublicProvider[] = providersResult?.success ? providersResult.data : []
  const oidcProviders = ssoProviders.filter((p) => p.provider_type === 'oidc')
  const samlProviders = ssoProviders.filter((p) => p.provider_type === 'saml')
  const ldapProviders = ssoProviders.filter((p) => p.provider_type === 'ldap')

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && user) {
      const dest =
        user.permissions.includes('console:read') ? '/console' : '/settings/users'
      navigate(dest, { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  async function handleSsoLogin(provider: PublicProvider) {
    setError(null)
    if (provider.provider_type === 'oidc') {
      const result = await api.post<{ authorization_url: string }>(
        `/api/auth/oidc/${provider.id}/login`,
        {},
      )
      if (result.success) {
        window.location.href = result.data.authorization_url
      } else {
        setError(result.error.message)
      }
    } else if (provider.provider_type === 'saml') {
      const result = await api.post<{ redirect_url?: string }>(
        `/api/auth/saml/${provider.id}/login`,
        {},
      )
      if (result.success && result.data.redirect_url) {
        window.location.href = result.data.redirect_url
      } else if (!result.success) {
        setError(result.error.message)
      }
    }
  }

  async function handleLdapSubmit(e: FormEvent, provider: PublicProvider) {
    e.preventDefault()
    if (!ldapUsername || !ldapPassword) return
    setError(null)
    setLdapLoading(true)
    try {
      const result = await api.post<{ access_token: string }>(
        `/api/auth/ldap/${provider.id}/login`,
        { username: ldapUsername, password: ldapPassword },
      )
      if (result.success) {
        const { useAuthStore: store } = await import('../store/auth')
        store.getState().setAccessToken(result.data.access_token)
        navigate('/', { replace: true })
      } else {
        setError(result.error.message)
      }
    } finally {
      setLdapLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(username, password)
      // Navigation handled by the effect above
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--io-surface-sunken)',
    border: '1px solid var(--io-border)',
    borderRadius: 'var(--io-radius)',
    color: 'var(--io-text-primary)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--io-text-secondary)',
    marginBottom: '6px',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--io-surface-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
        }}
      >
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: 'var(--io-accent-subtle)',
              border: '1px solid var(--io-accent)',
              marginBottom: '16px',
            }}
          >
            <span
              style={{
                color: 'var(--io-accent)',
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '-0.5px',
              }}
            >
              I/O
            </span>
          </div>
          <h1
            style={{
              color: 'var(--io-text-primary)',
              fontSize: '22px',
              fontWeight: 600,
              margin: '0 0 4px',
            }}
          >
            Inside/Operations
          </h1>
          <p
            style={{
              color: 'var(--io-text-muted)',
              fontSize: '13px',
              margin: 0,
            }}
          >
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--io-surface-secondary)',
            border: '1px solid var(--io-border)',
            borderRadius: '10px',
            padding: '28px',
          }}
        >
          {error && (
            <div
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--io-radius)',
                padding: '10px 14px',
                color: 'var(--io-danger)',
                fontSize: '13px',
                marginBottom: '20px',
              }}
            >
              {error}
            </div>
          )}

          {/* SSO provider buttons */}
          {ssoProviders.length > 0 && (
            <>
              {(oidcProviders.length > 0 || samlProviders.length > 0) && (
                <div style={{ marginBottom: '20px' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--io-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: '10px',
                    }}
                  >
                    Single Sign-On
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[...oidcProviders, ...samlProviders].map((provider) => (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => handleSsoLogin(provider)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'var(--io-surface-sunken)',
                          border: '1px solid var(--io-border)',
                          borderRadius: 'var(--io-radius)',
                          color: 'var(--io-text-primary)',
                          fontSize: '14px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'border-color 0.15s',
                        }}
                      >
                        Sign in with {provider.display_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {ldapProviders.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--io-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: '10px',
                    }}
                  >
                    Directory Sign-In
                  </div>
                  {ldapProviders.map((provider) => (
                    <div key={provider.id} style={{ marginBottom: '12px' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: 'var(--io-text-secondary)',
                          marginBottom: '8px',
                        }}
                      >
                        {provider.display_name}
                      </div>
                      {ldapProviderId === provider.id ? (
                        <form onSubmit={(e) => handleLdapSubmit(e, provider)}>
                          <div style={{ marginBottom: '10px' }}>
                            <label style={labelStyle}>Username</label>
                            <input
                              style={inputStyle}
                              type="text"
                              autoComplete="username"
                              value={ldapUsername}
                              onChange={(e) => setLdapUsername(e.target.value)}
                              placeholder="Domain username"
                              required
                              disabled={ldapLoading}
                            />
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={labelStyle}>Password</label>
                            <input
                              style={inputStyle}
                              type="password"
                              autoComplete="current-password"
                              value={ldapPassword}
                              onChange={(e) => setLdapPassword(e.target.value)}
                              placeholder="Password"
                              required
                              disabled={ldapLoading}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="submit"
                              disabled={ldapLoading}
                              style={{
                                flex: 1,
                                padding: '9px',
                                background: 'var(--io-accent)',
                                color: '#09090b',
                                border: 'none',
                                borderRadius: 'var(--io-radius)',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: ldapLoading ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {ldapLoading ? 'Signing in…' : 'Sign In'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setLdapProviderId(null)}
                              style={{
                                padding: '9px 14px',
                                background: 'transparent',
                                color: 'var(--io-text-secondary)',
                                border: '1px solid var(--io-border)',
                                borderRadius: 'var(--io-radius)',
                                fontSize: '13px',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setLdapProviderId(provider.id)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'var(--io-surface-sunken)',
                            border: '1px solid var(--io-border)',
                            borderRadius: 'var(--io-radius)',
                            color: 'var(--io-text-primary)',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'border-color 0.15s',
                          }}
                        >
                          Sign in with {provider.display_name}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Divider before local form */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ flex: 1, height: '1px', background: 'var(--io-border)' }} />
                <span style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>
                  or sign in with username
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--io-border)' }} />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="username" style={labelStyle}>
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                disabled={isLoading}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="password" style={labelStyle}>
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isLoading}
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !username || !password}
              style={{
                width: '100%',
                padding: '11px',
                background: isLoading ? 'var(--io-accent-subtle)' : 'var(--io-accent)',
                color: isLoading ? 'var(--io-accent)' : '#09090b',
                border: 'none',
                borderRadius: 'var(--io-radius)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background 0.15s',
              }}
            >
              {isLoading ? (
                <>
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid currentColor',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.7s linear infinite',
                    }}
                  />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: var(--io-accent) !important; }
        input::placeholder { color: var(--io-text-muted); }
      `}</style>
    </div>
  )
}
