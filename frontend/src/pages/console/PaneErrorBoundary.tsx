import React from 'react'

interface Props {
  paneId: string
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Per-pane error boundary.
 *
 * Wraps a single pane's content so that a rendering crash is contained to that
 * pane only. Other panes and the workspace chrome continue rendering normally.
 *
 * Uses a class component because React requires `componentDidCatch` to be
 * defined on a class component — functional error boundaries are not supported.
 */
export class PaneErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Structured log for observability.
    // TODO: forward to the io-observability tracing pipeline once the
    // frontend tracing hook is available (tracked in observability spec).
    console.error('[IO PaneError]', {
      paneId: this.props.paneId,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    })
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 20,
            background: 'var(--io-surface-sunken)',
            height: '100%',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--io-alarm-high)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span
            style={{
              fontSize: 13,
              color: 'var(--io-text-muted)',
              textAlign: 'center',
            }}
          >
            This pane encountered an error.
          </span>
          <button
            onClick={this.handleReload}
            style={{
              marginTop: 4,
              padding: '5px 14px',
              borderRadius: 'var(--io-radius)',
              border: '1px solid var(--io-border)',
              background: 'var(--io-surface-secondary)',
              color: 'var(--io-text-primary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Reload pane
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
