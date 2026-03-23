// Symbol Library page — Designer module
// Route: /designer/symbols (permission: designer:read)
// See design-docs/35_SHAPE_LIBRARY.md for long-term browser requirements.

import React, { useEffect, useRef, useState } from 'react'
import { graphicsApi } from '../../api/graphics'

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
// Custom shape row
// ---------------------------------------------------------------------------

interface CustomShapeItem {
  id: string
  shape_id: string
  name: string
  category: string
  source: 'user'
  created_at: string | null
}

function CustomShapeRow({
  shape,
  onDelete,
}: {
  shape: CustomShapeItem
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete custom shape "${shape.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await graphicsApi.deleteUserShape(shape.id)
      onDelete(shape.id)
    } catch {
      alert('Failed to delete shape. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
      }}
    >
      {/* Shape icon placeholder */}
      <div
        style={{
          width: 36,
          height: 36,
          background: 'var(--io-surface)',
          border: '1px solid var(--io-border)',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="4" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" style={{ color: 'var(--io-text-muted)' }} />
        </svg>
      </div>

      {/* Name + category */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--io-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shape.name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginTop: 1 }}>
          {shape.category}
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        title="Delete custom shape"
        style={{
          padding: '4px 10px',
          background: 'transparent',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          color: 'var(--io-text-muted)',
          fontSize: 11,
          cursor: deleting ? 'wait' : 'pointer',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 12%, transparent)'
          e.currentTarget.style.borderColor = '#ef4444'
          e.currentTarget.style.color = '#ef4444'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.borderColor = 'var(--io-border)'
          e.currentTarget.style.color = 'var(--io-text-muted)'
        }}
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom Shapes section
// ---------------------------------------------------------------------------

function CustomShapesSection() {
  const [shapes, setShapes] = useState<CustomShapeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadShapes()
  }, [])

  async function loadShapes() {
    setLoading(true)
    setError(null)
    try {
      const resp = await graphicsApi.listUserShapes()
      if (resp.success) {
        setShapes(resp.data.data ?? [])
      } else {
        setError(resp.error.message ?? 'Failed to load custom shapes')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load custom shapes')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-uploaded after a failed attempt
    e.target.value = ''

    setUploading(true)
    setUploadError(null)
    try {
      const result = await graphicsApi.uploadUserShape(file)
      setShapes(prev => [...prev, { ...result, created_at: null }])
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleDelete(id: string) {
    setShapes(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div>
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
            Custom Shapes
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--io-text-secondary)' }}>
            Your uploaded SVG shapes, available in the Designer canvas palette.
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            background: 'var(--io-accent)',
            border: 'none',
            borderRadius: 'var(--io-radius)',
            color: '#09090b',
            fontSize: 12,
            fontWeight: 600,
            cursor: uploading ? 'wait' : 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {uploading ? 'Uploading…' : 'Upload SVG'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".svg,image/svg+xml"
          onChange={handleUpload}
          style={{ display: 'none' }}
        />
      </div>

      {/* Upload error */}
      {uploadError && (
        <div
          style={{
            padding: '10px 12px',
            background: 'color-mix(in srgb, #ef4444 10%, transparent)',
            border: '1px solid color-mix(in srgb, #ef4444 40%, transparent)',
            borderRadius: 'var(--io-radius)',
            fontSize: '12px',
            color: '#ef4444',
            marginBottom: '12px',
          }}
        >
          Upload failed: {uploadError}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ fontSize: '13px', color: 'var(--io-text-muted)', padding: '8px 0' }}>
          Loading custom shapes…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div style={{ fontSize: '13px', color: '#ef4444', padding: '8px 0' }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && shapes.length === 0 && (
        <div
          style={{
            padding: '32px 24px',
            background: 'var(--io-surface-elevated)',
            border: '1px dashed var(--io-border)',
            borderRadius: 'var(--io-radius)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--io-text-primary)', marginBottom: 4 }}>
            No custom shapes yet
          </div>
          <div style={{ fontSize: '12px', color: 'var(--io-text-secondary)', lineHeight: 1.5 }}>
            Upload an SVG file to add it to your custom shape library.
            Custom shapes appear in the Designer canvas palette alongside built-in ISA-101 shapes.
          </div>
        </div>
      )}

      {/* Shape list */}
      {!loading && !error && shapes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {shapes.map(shape => (
            <CustomShapeRow key={shape.id} shape={shape} onDelete={handleDelete} />
          ))}
        </div>
      )}
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
            Browse ISA-101 compliant DCS equipment shapes and manage your custom shapes.
          </p>
        </div>

        {/* Built-in ISA-101 categories */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            ISA-101 Equipment Shapes
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '12px',
            }}
          >
            {SYMBOL_CATEGORIES.map((cat) => (
              <CategoryCard key={cat.id} category={cat} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--io-border)', marginBottom: '32px' }} />

        {/* Custom shapes section */}
        <CustomShapesSection />
      </div>
    </div>
  )
}
