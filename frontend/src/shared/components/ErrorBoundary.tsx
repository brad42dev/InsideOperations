import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  module?: string  // e.g. "Console", "Designer" — shown in error message
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[IO ErrorBoundary${this.props.module ? ` / ${this.props.module}` : ''}]`, error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', minHeight: '200px', gap: '12px', padding: '24px',
          color: 'var(--io-text-secondary)', fontFamily: 'sans-serif',
        }}>
          <div style={{ fontSize: '32px' }}>⚠</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            {this.props.module ? `${this.props.module} failed to load` : 'Something went wrong'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--io-text-muted)', maxWidth: '400px', textAlign: 'center' }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '8px', padding: '6px 16px', borderRadius: 'var(--io-radius)',
              border: '1px solid var(--io-border)', background: 'var(--io-surface-secondary)',
              color: 'var(--io-text-primary)', cursor: 'pointer', fontSize: '13px',
            }}
          >
            {this.props.module ? `Reload ${this.props.module}` : 'Reload Module'}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
