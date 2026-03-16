import { useUiStore } from '../../store/ui'
import { type Theme } from '../../shared/theme/tokens'

interface ThemeOption {
  id: Theme
  label: string
  description: string
  preview: {
    surface: string
    surface2: string
    text: string
    accent: string
    border: string
  }
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'dark',
    label: 'Dark',
    description: 'High-contrast dark theme for low-light environments',
    preview: {
      surface: '#09090b',
      surface2: '#18181b',
      text: '#fafafa',
      accent: '#2dd4bf',
      border: '#3f3f46',
    },
  },
  {
    id: 'light',
    label: 'Light',
    description: 'Clean light theme for well-lit control rooms',
    preview: {
      surface: '#ffffff',
      surface2: '#f9fafb',
      text: '#09090b',
      accent: '#0d9488',
      border: '#e4e4e7',
    },
  },
  {
    id: 'hphmi',
    label: 'HP HMI',
    description: 'ISA-101 high-performance HMI palette (slate-blue base)',
    preview: {
      surface: '#0f172a',
      surface2: '#1e293b',
      text: '#e2e8f0',
      accent: '#2dd4bf',
      border: '#334155',
    },
  },
]

function ThemePreview({ preview }: { preview: ThemeOption['preview'] }) {
  return (
    <div
      style={{
        borderRadius: '8px',
        overflow: 'hidden',
        border: `1px solid ${preview.border}`,
        background: preview.surface,
        height: '80px',
        position: 'relative',
      }}
    >
      {/* Simulated sidebar strip */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '28px',
          background: preview.surface2,
          borderRight: `1px solid ${preview.border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '8px',
          gap: '4px',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '16px',
              height: '4px',
              borderRadius: '2px',
              background: i === 0 ? preview.accent : preview.border,
              opacity: i === 0 ? 1 : 0.5,
            }}
          />
        ))}
      </div>

      {/* Simulated content */}
      <div
        style={{
          position: 'absolute',
          left: '36px',
          top: '10px',
          right: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            height: '6px',
            borderRadius: '3px',
            background: preview.text,
            width: '60%',
            opacity: 0.8,
          }}
        />
        {/* Content lines */}
        {[100, 80, 90].map((w, i) => (
          <div
            key={i}
            style={{
              height: '4px',
              borderRadius: '2px',
              background: preview.text,
              width: `${w}%`,
              opacity: 0.2,
            }}
          />
        ))}
        {/* Accent chip */}
        <div
          style={{
            height: '4px',
            borderRadius: '2px',
            background: preview.accent,
            width: '40%',
            opacity: 0.7,
          }}
        />
      </div>
    </div>
  )
}

export default function AppearancePage() {
  const { theme, setTheme } = useUiStore()

  return (
    <div style={{ maxWidth: '700px' }}>
      <h2
        style={{
          margin: '0 0 4px',
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--io-text-primary)',
        }}
      >
        Appearance
      </h2>
      <p
        style={{
          margin: '0 0 28px',
          fontSize: '13px',
          color: 'var(--io-text-muted)',
        }}
      >
        Choose a theme for the interface. Your selection is saved locally in this browser.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {THEME_OPTIONS.map((option) => {
          const isActive = theme === option.id
          return (
            <button
              key={option.id}
              onClick={() => setTheme(option.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '16px',
                borderRadius: '10px',
                border: isActive
                  ? '2px solid var(--io-accent)'
                  : '2px solid var(--io-border)',
                background: isActive ? 'var(--io-accent-subtle)' : 'var(--io-surface-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
                position: 'relative',
              }}
              aria-pressed={isActive}
            >
              {/* Active checkmark */}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--io-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    color: '#000',
                    fontWeight: 700,
                  }}
                >
                  ✓
                </div>
              )}

              <ThemePreview preview={option.preview} />

              <div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--io-accent)' : 'var(--io-text-primary)',
                    marginBottom: '4px',
                  }}
                >
                  {option.label}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--io-text-muted)',
                    lineHeight: 1.4,
                  }}
                >
                  {option.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
