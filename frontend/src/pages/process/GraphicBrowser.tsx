import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { graphicsApi, type GraphicSummary } from '../../api/graphics'

const RECENT_KEY = 'io-process-recent'
const MAX_RECENT = 5

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function saveRecent(id: string): void {
  const prev = loadRecent().filter((x) => x !== id)
  const next = [id, ...prev].slice(0, MAX_RECENT)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

interface GraphicBrowserProps {
  currentGraphicId: string | null
  onSelect: (graphicId: string) => void
  onClose: () => void
}

export default function GraphicBrowser({ currentGraphicId, onSelect, onClose }: GraphicBrowserProps) {
  const [search, setSearch] = useState('')
  const [recentIds, setRecentIds] = useState<string[]>(loadRecent)
  const panelRef = useRef<HTMLDivElement>(null)

  const { data: result, isLoading, isError } = useQuery({
    queryKey: ['graphics-list'],
    queryFn: async () => {
      const res = await graphicsApi.list()
      if (!res.success) throw new Error(res.error.message)
      return res.data
    },
    staleTime: 30_000,
  })

  const allGraphics: GraphicSummary[] = result ?? []

  const filtered = allGraphics.filter((g) =>
    search.trim() === '' ? true : g.name.toLowerCase().includes(search.toLowerCase()),
  )

  const recentGraphics = recentIds
    .map((id) => allGraphics.find((g) => g.id === id))
    .filter((g): g is GraphicSummary => g !== undefined)

  function handleSelect(id: string) {
    saveRecent(id)
    setRecentIds(loadRecent())
    onSelect(id)
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 51,
          background: 'transparent',
        }}
      />

      {/* Slide-in panel */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 220,
          background: 'var(--io-surface-elevated)',
          borderRight: '1px solid var(--io-border)',
          zIndex: 52,
          display: 'flex',
          flexDirection: 'column',
          animation: 'io-slide-in-left 180ms ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--io-space-3) var(--io-space-3) var(--io-space-2)',
            borderBottom: '1px solid var(--io-border)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--io-text-primary)' }}>
            Graphics
          </span>
          <button
            onClick={onClose}
            aria-label="Close browser"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--io-text-secondary)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: 'var(--io-space-2) var(--io-space-3)' }}>
          <input
            type="search"
            placeholder="Search graphics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--io-surface)',
              border: '1px solid var(--io-border)',
              borderRadius: 4,
              color: 'var(--io-text-primary)',
              fontSize: 12,
              padding: '5px 8px',
              outline: 'none',
            }}
            autoFocus
          />
        </div>

        {/* Scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--io-space-2) var(--io-space-2)' }}>
          {isLoading && (
            <div style={{ padding: 'var(--io-space-3)', color: 'var(--io-text-secondary)', fontSize: 12 }}>
              Loading…
            </div>
          )}
          {isError && (
            <div style={{ padding: 'var(--io-space-3)', color: 'var(--io-color-error)', fontSize: 12 }}>
              Failed to load graphics
            </div>
          )}

          {/* Recent section */}
          {!isLoading && !isError && recentGraphics.length > 0 && search.trim() === '' && (
            <section style={{ marginBottom: 'var(--io-space-2)' }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--io-text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '6px 4px 4px',
                }}
              >
                Recent
              </div>
              {recentGraphics.map((g) => (
                <GraphicItem
                  key={g.id}
                  graphic={g}
                  isActive={g.id === currentGraphicId}
                  onSelect={() => handleSelect(g.id)}
                />
              ))}
            </section>
          )}

          {/* All / filtered section */}
          {!isLoading && !isError && (
            <section>
              {search.trim() === '' && recentGraphics.length > 0 && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--io-text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '6px 4px 4px',
                  }}
                >
                  All
                </div>
              )}
              {filtered.length === 0 && (
                <div style={{ padding: '8px 4px', color: 'var(--io-text-secondary)', fontSize: 12 }}>
                  No graphics found
                </div>
              )}
              {filtered.map((g) => (
                <GraphicItem
                  key={g.id}
                  graphic={g}
                  isActive={g.id === currentGraphicId}
                  onSelect={() => handleSelect(g.id)}
                />
              ))}
            </section>
          )}
        </div>
      </div>

      <style>{`
        @keyframes io-slide-in-left {
          from { transform: translateX(-100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

function GraphicItem({
  graphic,
  isActive,
  onSelect,
}: {
  graphic: GraphicSummary
  isActive: boolean
  onSelect: () => void
}) {
  const typeColor: Record<string, string> = {
    graphic: 'var(--io-color-info)',
    template: 'var(--io-color-warning)',
    symbol: 'var(--io-color-success)',
  }

  return (
    <button
      onClick={onSelect}
      title={graphic.name}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        textAlign: 'left',
        background: isActive ? 'var(--io-surface-active)' : 'none',
        border: 'none',
        borderRadius: 4,
        color: isActive ? 'var(--io-text-primary)' : 'var(--io-text-secondary)',
        cursor: 'pointer',
        fontSize: 12,
        padding: '5px 4px',
        overflow: 'hidden',
      }}
    >
      {/* Type badge */}
      <span
        style={{
          flexShrink: 0,
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          background: typeColor[graphic.type] ?? 'var(--io-color-neutral)',
          color: '#fff',
          borderRadius: 3,
          padding: '1px 4px',
        }}
      >
        {graphic.type.slice(0, 3)}
      </span>
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {graphic.name}
      </span>
    </button>
  )
}
