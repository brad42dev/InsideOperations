import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { graphicsApi, type ShapeObject } from '../../api/graphics'

// ---------------------------------------------------------------------------
// Built-in ISA-101 shape index types
// ---------------------------------------------------------------------------

interface BuiltinShapeEntry {
  id: string
  category: string
  name: string
  svg: string
  meta: string
}

interface ShapeIndex {
  version: string
  shapes: BuiltinShapeEntry[]
}

// ---------------------------------------------------------------------------
// Built-in shape card (rendered from SVG URL)
// ---------------------------------------------------------------------------

function BuiltinShapeCard({ shape }: { shape: BuiltinShapeEntry }) {
  return (
    <div
      style={{
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        overflow: 'hidden',
        cursor: 'grab',
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/io-shape-url', shape.svg)
        e.dataTransfer.setData('application/io-shape-id', shape.id)
        e.dataTransfer.setData('application/io-shape-name', shape.name)
        e.dataTransfer.effectAllowed = 'copy'
      }}
    >
      {/* SVG preview via img tag */}
      <div
        style={{
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a1a',
          padding: '8px',
        }}
      >
        <img
          src={shape.svg}
          alt={shape.name}
          style={{ width: '40px', height: '40px', objectFit: 'contain' }}
          loading="lazy"
        />
      </div>

      <div style={{ padding: '8px 10px' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--io-text-primary)',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {shape.name}
        </span>
        <div style={{ fontSize: '10px', color: 'var(--io-text-muted)', marginTop: '4px', textTransform: 'capitalize' }}>
          {shape.category}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Symbol card
// ---------------------------------------------------------------------------

function SymbolCard({
  shape,
  onDelete,
}: {
  shape: ShapeObject
  onDelete: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      style={{
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* SVG preview */}
      <div
        style={{
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--io-surface-secondary)',
          padding: '8px',
        }}
        dangerouslySetInnerHTML={{ __html: shape.svg_data }}
      />

      <div style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--io-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {shape.name}
          </span>

          <div style={{ position: 'relative', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--io-text-muted)',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: '13px',
              }}
            >
              ⋯
            </button>

            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 4px)',
                    minWidth: '120px',
                    background: 'var(--io-surface-elevated)',
                    border: '1px solid var(--io-border)',
                    borderRadius: 'var(--io-radius)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    zIndex: 99,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => { onDelete(shape.id); setMenuOpen(false) }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--io-danger, #ef4444)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--io-surface-secondary)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tags */}
        {shape.tags && shape.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '4px' }}>
            {shape.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: '10px',
                  padding: '1px 4px',
                  borderRadius: '100px',
                  background: 'var(--io-surface-secondary)',
                  color: 'var(--io-text-muted)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div style={{ fontSize: '10px', color: 'var(--io-text-muted)', marginTop: '4px', textTransform: 'capitalize' }}>
          {shape.type}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Upload modal
// ---------------------------------------------------------------------------

function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void
  onUploaded: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'shape' | 'stencil'>('shape')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [svgContent, setSvgContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.svg')) {
      setError('Only SVG files are supported.')
      return
    }
    setFileName(file.name)
    if (!name) setName(file.name.replace(/\.svg$/i, ''))
    const reader = new FileReader()
    reader.onload = (ev) => {
      setSvgContent(ev.target?.result as string)
      setError(null)
    }
    reader.readAsText(file)
  }

  const handleUpload = async () => {
    if (!name.trim()) { setError('Name is required.'); return }
    if (!svgContent) { setError('Please select an SVG file.'); return }
    setIsUploading(true)
    setError(null)
    try {
      const r = await graphicsApi.createShape({
        name: name.trim(),
        type,
        svg_data: svgContent,
        category: category.trim() || undefined,
        tags: tags.trim() ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      })
      if (!r.success) throw new Error(r.error.message)
      onUploaded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          padding: '24px',
          width: '400px',
          maxWidth: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Upload Symbol
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* File picker */}
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: '100%',
                padding: '20px',
                background: 'var(--io-surface-secondary)',
                border: '1px dashed var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-muted)',
                cursor: 'pointer',
                fontSize: '13px',
                textAlign: 'center',
              }}
            >
              {fileName ? `Selected: ${fileName}` : 'Click to select SVG file'}
            </button>
            <input ref={fileRef} type="file" accept=".svg" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--io-text-secondary)' }}>Name *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                padding: '7px 10px',
                background: 'var(--io-surface-secondary)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--io-text-secondary)' }}>Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'shape' | 'stencil')}
              style={{
                padding: '7px 10px',
                background: 'var(--io-surface-secondary)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="shape">Shape</option>
              <option value="stencil">Stencil</option>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--io-text-secondary)' }}>Category</span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Pumps, Valves, Vessels"
              style={{
                padding: '7px 10px',
                background: 'var(--io-surface-secondary)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--io-text-secondary)' }}>Tags (comma-separated)</span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. ISA-101, centrifugal, rotating"
              style={{
                padding: '7px 10px',
                background: 'var(--io-surface-secondary)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </label>

          {error && (
            <div style={{ fontSize: '12px', color: 'var(--io-danger, #ef4444)', padding: '6px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--io-radius)' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              background: 'transparent',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            style={{
              padding: '7px 16px',
              background: 'var(--io-accent)',
              border: 'none',
              borderRadius: 'var(--io-radius)',
              color: '#09090b',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              opacity: isUploading ? 0.6 : 1,
            }}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DesignerSymbolLibrary
// ---------------------------------------------------------------------------

const TYPE_FILTERS = ['All', 'shape', 'stencil', 'symbol']
const CATEGORY_LABELS: Record<string, string> = {
  valves:          'Valves',
  pumps:           'Pumps',
  compressors:     'Compressors',
  rotating:        'Rotating',
  drivers:         'Drivers',
  'heat-transfer': 'Heat Transfer',
  vessels:         'Vessels',
  tanks:           'Tanks',
  separation:      'Separation',
  instrumentation: 'Instrumentation',
  instruments:     'Instruments',
  control:         'Control',
  actuators:       'Actuators',
  agitators:       'Agitators',
  supports:        'Supports',
  indicators:      'Indicators',
  piping:          'Piping',
  parts:           'Parts',
}

export default function DesignerSymbolLibrary() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [showUpload, setShowUpload] = useState(false)
  const [builtinCategory, setBuiltinCategory] = useState('All')

  // Built-in ISA-101 shape library from static index
  const builtinQuery = useQuery<ShapeIndex>({
    queryKey: ['builtin-shapes-index'],
    queryFn: async () => {
      const res = await fetch('/shapes/index.json')
      if (!res.ok) throw new Error('Failed to load built-in shape index')
      return res.json() as Promise<ShapeIndex>
    },
    staleTime: Infinity,
  })

  const query = useQuery({
    queryKey: ['design-objects'],
    queryFn: async () => {
      const r = await graphicsApi.listShapes()
      if (!r.success) throw new Error(r.error.message)
      return r.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Use the graphics delete endpoint for design objects
      const r = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/design-objects/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('io_access_token') ?? ''}`,
        },
      })
      if (!r.ok) throw new Error('Delete failed')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['design-objects'] })
    },
  })

  const shapes: ShapeObject[] = query.data ?? []
  const filtered = shapes.filter((s) => {
    const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'All' || s.type === typeFilter
    return matchesSearch && matchesType
  })

  function handleDelete(id: string) {
    if (window.confirm('Delete this symbol? This cannot be undone.')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--io-surface-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 20px',
          height: '48px',
          flexShrink: 0,
          background: 'var(--io-surface)',
          borderBottom: '1px solid var(--io-border)',
        }}
      >
        <button
          onClick={() => navigate('/designer')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--io-text-muted)',
            cursor: 'pointer',
            fontSize: '13px',
            padding: '4px 0',
          }}
        >
          ← Designer
        </button>
        <span style={{ color: 'var(--io-border)' }}>/</span>
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Symbol Library
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowUpload(true)}
          style={{
            padding: '6px 14px',
            background: 'var(--io-accent)',
            border: 'none',
            borderRadius: 'var(--io-radius)',
            color: '#09090b',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          + Upload Symbol
        </button>
      </div>

      {/* Filters */}
      <div
        style={{
          padding: '10px 20px 0',
          background: 'var(--io-surface)',
          borderBottom: '1px solid var(--io-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Search symbols..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '280px',
              padding: '7px 10px',
              background: 'var(--io-surface-elevated)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-primary)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {TYPE_FILTERS.map((t) => {
            const isActive = t === typeFilter
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                style={{
                  padding: '0 16px',
                  height: '36px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--io-accent)' : '2px solid transparent',
                  color: isActive ? 'var(--io-accent)' : 'var(--io-text-secondary)',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        {/* ---- Built-in ISA-101 Shapes ---- */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--io-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ISA-101 Built-in Shapes
            </h2>
            {/* Category filter for built-ins */}
            <select
              value={builtinCategory}
              onChange={(e) => setBuiltinCategory(e.target.value)}
              style={{
                padding: '4px 8px',
                background: 'var(--io-surface-elevated)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-secondary)',
                fontSize: '12px',
                outline: 'none',
              }}
            >
              <option value="All">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {builtinQuery.isLoading && (
            <div style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>Loading built-in shapes...</div>
          )}

          {builtinQuery.isError && (
            <div style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>Built-in shapes unavailable.</div>
          )}

          {builtinQuery.data && (() => {
            const allBuiltins = builtinQuery.data.shapes
            const filtered = allBuiltins.filter((s) => {
              const matchesCategory = builtinCategory === 'All' || s.category === builtinCategory
              const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase())
              return matchesCategory && matchesSearch
            })

            if (filtered.length === 0) {
              return (
                <div style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>
                  No built-in shapes match your filters.
                </div>
              )
            }

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                {filtered.map((s) => (
                  <BuiltinShapeCard key={s.id} shape={s} />
                ))}
              </div>
            )
          })()}
        </section>

        {/* ---- Custom Uploaded Symbols ---- */}
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: 'var(--io-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Custom Symbols
          </h2>

          {query.isLoading && (
            <div style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>Loading symbols...</div>
          )}

          {query.isError && (
            <div
              style={{
                padding: '20px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-danger, #ef4444)',
                fontSize: '13px',
              }}
            >
              Failed to load symbols.
            </div>
          )}

          {!query.isLoading && !query.isError && filtered.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '40px 20px',
                gap: '12px',
                color: 'var(--io-text-muted)',
              }}
            >
              <span style={{ fontSize: '36px', opacity: 0.3 }}>⬡</span>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--io-text-secondary)' }}>
                {search || typeFilter !== 'All' ? 'No symbols match your filters' : 'No custom symbols yet'}
              </p>
              {!search && typeFilter === 'All' && (
                <button
                  onClick={() => setShowUpload(true)}
                  style={{
                    marginTop: '8px',
                    padding: '7px 16px',
                    background: 'var(--io-accent)',
                    border: 'none',
                    borderRadius: 'var(--io-radius)',
                    color: '#09090b',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  Upload Symbol
                </button>
              )}
            </div>
          )}

          {!query.isLoading && filtered.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
              {filtered.map((s) => (
                <SymbolCard key={s.id} shape={s} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </section>

      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            void queryClient.invalidateQueries({ queryKey: ['design-objects'] })
          }}
        />
      )}
    </div>
  )
}
