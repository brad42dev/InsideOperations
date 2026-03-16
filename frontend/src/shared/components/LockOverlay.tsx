import { useEffect } from 'react'
import { useUiStore } from '../../store/ui'

export default function LockOverlay() {
  const { isLocked, unlock } = useUiStore()

  useEffect(() => {
    if (!isLocked) return

    function handleInteraction() {
      unlock()
    }

    window.addEventListener('keydown', handleInteraction)
    window.addEventListener('mousedown', handleInteraction)
    window.addEventListener('touchstart', handleInteraction)

    return () => {
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('mousedown', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
    }
  }, [isLocked, unlock])

  if (!isLocked) return null

  return (
    <div
      role="dialog"
      aria-label="Screen locked"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        pointerEvents: 'all',
        background: 'rgba(9, 9, 11, 0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        cursor: 'pointer',
      }}
    >
      {/* Logo mark */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '12px',
          background: 'var(--io-accent-subtle)',
          border: '1px solid var(--io-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: 'var(--io-accent)',
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '-0.5px',
          }}
        >
          I/O
        </span>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--io-text-primary)',
            marginBottom: '8px',
          }}
        >
          Screen Locked
        </div>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--io-text-muted)',
          }}
        >
          Click anywhere or press any key to continue
        </div>
      </div>

      {/* Lock icon indicator */}
      <div
        style={{
          fontSize: '28px',
          color: 'var(--io-text-muted)',
          userSelect: 'none',
        }}
      >
        ⚿
      </div>
    </div>
  )
}
