/**
 * SaveAsStencilDialog.tsx
 *
 * Modal dialog for saving selected elements as a stencil.
 * Per spec §"Save as Stencil": name, category (flat list or new category),
 * optional tags. No wizard steps.
 */

import React, { useState, useEffect, useRef } from 'react'
import { graphicsApi } from '../../../api/graphics'

// ---------------------------------------------------------------------------

interface SaveAsStencilDialogProps {
  /** Selected scene nodes to save as a stencil */
  nodes: unknown[]
  onClose: () => void
  onSaved: (stencilId: string) => void
}

const BUILTIN_CATEGORIES = [
  'General',
  'Process Equipment',
  'Instrumentation',
  'Valves',
  'Electrical',
  'Civil',
  'Custom',
]

export function SaveAsStencilDialog({ nodes, onClose, onSaved }: SaveAsStencilDialogProps) {
  const [name, setName]           = useState('')
  const [category, setCategory]   = useState('General')
  const [newCategory, setNewCat]  = useState('')
  const [isNewCat, setIsNewCat]   = useState(false)
  const [tags, setTags]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const finalCategory = isNewCat ? newCategory.trim() : category
    if (!name.trim()) { setError('Name is required'); return }
    if (isNewCat && !finalCategory) { setError('Category name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const result = await graphicsApi.createStencil({
        name: name.trim(),
        category: finalCategory,
        tags: tags.trim() || undefined,
        nodes,
      })
      if (!result.success) throw new Error(result.error.message)
      onSaved(result.data.data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    background: 'var(--io-surface-elevated)',
    border: '1px solid var(--io-border)',
    borderRadius: 'var(--io-radius)',
    color: 'var(--io-text-primary)',
    fontSize: 13,
    boxSizing: 'border-box',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000 }}
        onClick={onClose}
      />
      {/* Dialog */}
      <div style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 2001,
        background: 'var(--io-surface)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius-lg)',
        boxShadow: 'var(--io-shadow-lg)',
        width: 360,
        padding: 24,
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--io-text-primary)' }}>
          Save as Stencil
        </div>

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--io-text-secondary)', display: 'block', marginBottom: 4 }}>
              Name *
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Stencil"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--io-text-secondary)', display: 'block', marginBottom: 4 }}>
              Category
            </label>
            <select
              value={isNewCat ? '__new__' : category}
              onChange={e => {
                if (e.target.value === '__new__') { setIsNewCat(true) }
                else { setIsNewCat(false); setCategory(e.target.value) }
              }}
              style={inputStyle}
            >
              {BUILTIN_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__new__">New Category…</option>
            </select>
            {isNewCat && (
              <input
                type="text"
                value={newCategory}
                onChange={e => setNewCat(e.target.value)}
                placeholder="Category name"
                style={{ ...inputStyle, marginTop: 6 }}
              />
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--io-text-secondary)', display: 'block', marginBottom: 4 }}>
              Tags (optional, comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="pipe, fitting, custom"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 12, padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--io-alarm-high)', borderRadius: 4, color: 'var(--io-alarm-high)', fontSize: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '6px 14px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', cursor: 'pointer', fontSize: 13, color: 'var(--io-text-primary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '6px 14px', background: 'var(--io-accent)', border: 'none', borderRadius: 'var(--io-radius)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, color: '#fff', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
