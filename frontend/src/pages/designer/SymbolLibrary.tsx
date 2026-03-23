// Symbol Library page — Designer module
// Route: /designer/symbols (permission: designer:read)
// See design-docs/35_SHAPE_LIBRARY.md for long-term browser requirements.

// ---------------------------------------------------------------------------
// Category data (Tier 1 DCS equipment shapes per doc 35)
// ---------------------------------------------------------------------------

interface SymbolCategory {
  id: string
  label: string
  description: string
  count: number
}

const SYMBOL_CATEGORIES: SymbolCategory[] = [
  { id: 'vessels', label: 'Vessels', description: 'Tanks, drums, and storage vessels', count: 6 },
  { id: 'pumps', label: 'Pumps', description: 'Centrifugal, positive-displacement, and specialty pumps', count: 5 },
  { id: 'valves', label: 'Valves', description: 'Gate, globe, ball, butterfly, and control valves', count: 8 },
  { id: 'heat-exchangers', label: 'Heat Exchangers', description: 'Shell-and-tube, plate, and air coolers', count: 4 },
  { id: 'columns', label: 'Columns', description: 'Distillation and absorption columns', count: 2 },
  { id: 'compressors', label: 'Compressors', description: 'Centrifugal and reciprocating compressors', count: 4 },
  { id: 'instruments', label: 'Instruments', description: 'Transmitters, indicators, and controllers', count: 12 },
  { id: 'piping', label: 'Piping', description: 'Pipes, fittings, and flow direction indicators', count: 8 },
]

// ---------------------------------------------------------------------------
// SymbolCategory card
// ---------------------------------------------------------------------------

function CategoryCard({ category }: { category: SymbolCategory }) {
  return (
    <div
      style={{
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: 0,
        cursor: 'default',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--io-text-primary)',
          }}
        >
          {category.label}
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--io-accent)',
            background: 'color-mix(in srgb, var(--io-accent) 12%, transparent)',
            borderRadius: '4px',
            padding: '2px 7px',
          }}
        >
          {category.count}
        </span>
      </div>
      <div
        style={{
          fontSize: '12px',
          color: 'var(--io-text-secondary)',
          lineHeight: 1.4,
        }}
      >
        {category.description}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SymbolLibrary page
// ---------------------------------------------------------------------------

export default function SymbolLibrary() {
  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: 'var(--io-surface-primary)',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Page header */}
        <div style={{ marginBottom: '24px' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--io-text-primary)',
            }}
          >
            Symbol Library
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '13px',
              color: 'var(--io-text-secondary)',
            }}
          >
            Browse and search ISA-101 compliant DCS equipment shapes for use in process graphics.
          </p>
        </div>

        {/* Category grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '12px',
            marginBottom: '32px',
          }}
        >
          {SYMBOL_CATEGORIES.map((cat) => (
            <CategoryCard key={cat.id} category={cat} />
          ))}
        </div>

        {/* Placeholder notice */}
        <div
          style={{
            padding: '20px 24px',
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            fontSize: '13px',
            color: 'var(--io-text-secondary)',
            lineHeight: 1.6,
          }}
        >
          The full interactive symbol browser with SVG preview, drag-to-canvas, and search will be
          available in a future release. Shapes from this library are already accessible via the
          left-panel palette inside the Designer canvas.
        </div>
      </div>
    </div>
  )
}
