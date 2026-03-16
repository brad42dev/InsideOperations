import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export default function OidcCallback() {
  const navigate = useNavigate()
  const setAccessToken = useAuthStore((s) => s.setAccessToken)

  useEffect(() => {
    // Try URL params first, then hash fragment
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''))
    const token = params.get('access_token') || hashParams.get('access_token')

    if (token) {
      setAccessToken(token)
      navigate('/', { replace: true })
    } else {
      const error = params.get('error') || 'Authentication failed'
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true })
    }
  }, [navigate, setAccessToken])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: 'var(--io-text-secondary)' }}>Completing sign-in…</p>
    </div>
  )
}
