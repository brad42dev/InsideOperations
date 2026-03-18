import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logsApi, type LogSegment, type LogTemplate } from '../../api/logs'

// ---------------------------------------------------------------------------
// Field definition (for field_table / field_list segments)
// ---------------------------------------------------------------------------

type FieldType = 'text' | 'number' | 'select'

interface FieldDef {
  name: string
  label: string
  type: FieldType
  options?: string
}

// ---------------------------------------------------------------------------
// Inline new segment form
// ---------------------------------------------------------------------------

function NewSegmentForm({
  onSave,
  onCancel,
  loading,
}: {
  onSave: (data: {
    name: string
    segment_type: string
    content_config: Record<string, unknown>
    is_reusable: boolean
  }) => void
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState('')
  const [segmentType, setSegmentType] = useState<string>('wysiwyg')
  const [isReusable, setIsReusable] = useState(true)
  const [fields, setFields] = useState<FieldDef[]>([])
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')
  const [pointIds, setPointIds] = useState<string[]>([])
  const [newPointId, setNewPointId] = useState('')

  const addField = () => {
    if (!newFieldName.trim()) return
    setFields([
      ...fields,
      {
        name: newFieldName.trim().toLowerCase().replace(/\s+/g, '_'),
        label: newFieldLabel.trim() || newFieldName.trim(),
        type: newFieldType,
      },
    ])
    setNewFieldName('')
    setNewFieldLabel('')
    setNewFieldType('text')
  }

  const removeField = (idx: number) => {
    setFields(fields.filter((_, i) => i !== idx))
  }

  const addPointId = () => {
    const pid = newPointId.trim()
    if (!pid || pointIds.includes(pid)) return
    setPointIds([...pointIds, pid])
    setNewPointId('')
  }

  const buildConfig = (): Record<string, unknown> => {
    if (segmentType === 'field_table' || segmentType === 'field_list') {
      return { fields }
    }
    if (segmentType === 'point_data') {
      return { point_ids: pointIds }
    }
    return {}
  }

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      segment_type: segmentType,
      content_config: buildConfig(),
      is_reusable: isReusable,
    })
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--io-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px',
    display: 'block',
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--io-bg)',
    border: '1px solid var(--io-border)',
    borderRadius: '6px',
    padding: '7px 10px',
    fontSize: '13px',
    color: 'var(--io-text-primary)',
    width: '100%',
  }

  return (
    <div
      style={{
        background: 'var(--io-surface-secondary)',
        border: '1px solid var(--io-accent)',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div style={{ fontWeight: 700, color: 'var(--io-text-primary)', fontSize: '14px' }}>
        New Segment
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 2 }}>
          <label style={labelStyle}>Name</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Segment name"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Type</label>
          <select
            style={inputStyle}
            value={segmentType}
            onChange={(e) => setSegmentType(e.target.value)}
          >
            <option value="wysiwyg">WYSIWYG</option>
            <option value="field_table">Field Table</option>
            <option value="field_list">Field List</option>
            <option value="point_data">Point Data</option>
          </select>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              color: 'var(--io-text-secondary)',
            }}
          >
            <input
              type="checkbox"
              checked={isReusable}
              onChange={(e) => setIsReusable(e.target.checked)}
            />
            Reusable
          </label>
        </div>
      </div>

      {/* Field builder for table/list types */}
      {(segmentType === 'field_table' || segmentType === 'field_list') && (
        <div>
          <label style={labelStyle}>Fields</label>
          {fields.length > 0 && (
            <div
              style={{
                marginBottom: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {fields.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--io-surface)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ flex: 1, color: 'var(--io-text-primary)', fontWeight: 500 }}>
                    {f.label}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--io-text-muted)',
                      background: 'var(--io-surface-secondary)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {f.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeField(idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#f87171',
                      fontSize: '16px',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 2 }}>
              <label style={{ ...labelStyle, marginBottom: '3px' }}>Field name</label>
              <input
                style={inputStyle}
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="e.g. temperature"
                onKeyDown={(e) => e.key === 'Enter' && addField()}
              />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ ...labelStyle, marginBottom: '3px' }}>Label</label>
              <input
                style={inputStyle}
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="e.g. Temperature (°C)"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, marginBottom: '3px' }}>Type</label>
              <select
                style={inputStyle}
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value as FieldType)}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="select">Select</option>
              </select>
            </div>
            <button
              type="button"
              onClick={addField}
              style={{
                background: 'var(--io-surface)',
                border: '1px solid var(--io-border)',
                borderRadius: '6px',
                padding: '7px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--io-text-secondary)',
                flexShrink: 0,
              }}
            >
              + Add
            </button>
          </div>
        </div>
      )}

      {/* Point ID configurator for point_data segments */}
      {segmentType === 'point_data' && (
        <div>
          <label style={labelStyle}>OPC Points to Snapshot</label>
          <p style={{ fontSize: '12px', color: 'var(--io-text-muted)', margin: '0 0 8px' }}>
            These point values are automatically captured when a log entry is created from this template.
          </p>
          {pointIds.length > 0 && (
            <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {pointIds.map((pid) => (
                <div
                  key={pid}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--io-surface)',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ flex: 1, color: 'var(--io-text-primary)', fontFamily: 'var(--io-font-mono, monospace)' }}>
                    {pid}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPointIds(pointIds.filter((p) => p !== pid))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '16px', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={newPointId}
              onChange={(e) => setNewPointId(e.target.value)}
              placeholder="e.g. HCU.FIC101.PV"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPointId())}
            />
            <button
              type="button"
              onClick={addPointId}
              style={{
                background: 'var(--io-surface)',
                border: '1px solid var(--io-border)',
                borderRadius: '6px',
                padding: '7px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--io-text-secondary)',
                flexShrink: 0,
              }}
            >
              + Add
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'none',
            border: '1px solid var(--io-border)',
            borderRadius: '6px',
            padding: '7px 16px',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'var(--io-text-secondary)',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim() || loading}
          style={{
            background: 'var(--io-accent)',
            border: 'none',
            borderRadius: '6px',
            padding: '7px 16px',
            cursor: !name.trim() || loading ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            color: '#fff',
            opacity: !name.trim() || loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Saving...' : 'Create Segment'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main template editor
// ---------------------------------------------------------------------------

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = id === 'new'

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([])
  const [segmentSearch, setSegmentSearch] = useState('')
  const [showNewSegmentForm, setShowNewSegmentForm] = useState(false)

  const { data: allSegments = [], isLoading: segmentsLoading } = useQuery({
    queryKey: ['log-segments'],
    queryFn: async () => {
      const res = await logsApi.listSegments()
      if (!res.success) throw new Error(res.error.message)
      return res.data
    },
  })

  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ['log-template', id],
    queryFn: async () => {
      const res = await logsApi.listTemplates()
      if (!res.success) throw new Error(res.error.message)
      return res.data.find((t: LogTemplate) => t.id === id) ?? null
    },
    enabled: !isNew && !!id,
  })

  // Populate form when editing existing template
  useEffect(() => {
    if (template) {
      setName(template.name)
      setDescription(template.description ?? '')
      setSelectedSegmentIds(template.segment_ids)
    }
  }, [template])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        return logsApi.createTemplate({
          name,
          description: description || undefined,
          segment_ids: selectedSegmentIds,
          is_active: true,
        })
      } else {
        return logsApi.updateTemplate(id!, {
          name,
          description: description || undefined,
          segment_ids: selectedSegmentIds,
          is_active: true,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['log-templates'] })
      navigate('/log')
    },
  })

  const createSegmentMutation = useMutation({
    mutationFn: (data: {
      name: string
      segment_type: string
      content_config: Record<string, unknown>
      is_reusable: boolean
    }) => logsApi.createSegment(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['log-segments'] })
      setShowNewSegmentForm(false)
      if (result.success) {
        setSelectedSegmentIds((prev) => [...prev, result.data.id])
      }
    },
  })

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const next = [...selectedSegmentIds]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    setSelectedSegmentIds(next)
  }

  const moveDown = (idx: number) => {
    if (idx === selectedSegmentIds.length - 1) return
    const next = [...selectedSegmentIds]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    setSelectedSegmentIds(next)
  }

  const removeSegment = (segId: string) => {
    setSelectedSegmentIds((prev) => prev.filter((s) => s !== segId))
  }

  const addSegment = (segId: string) => {
    if (!selectedSegmentIds.includes(segId)) {
      setSelectedSegmentIds((prev) => [...prev, segId])
    }
    setSegmentSearch('')
  }

  const filteredSegments = allSegments.filter(
    (s: LogSegment) =>
      !selectedSegmentIds.includes(s.id) &&
      s.name.toLowerCase().includes(segmentSearch.toLowerCase()),
  )

  const selectedSegments: (LogSegment | undefined)[] = selectedSegmentIds.map((id) =>
    allSegments.find((s: LogSegment) => s.id === id),
  )

  const loading = templateLoading || segmentsLoading

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--io-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '6px',
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--io-bg)',
    border: '1px solid var(--io-border)',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '14px',
    color: 'var(--io-text-primary)',
    width: '100%',
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--io-bg)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--io-border)',
          background: 'var(--io-surface)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <button
          onClick={() => navigate('/log')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--io-text-muted)',
            fontSize: '20px',
            lineHeight: 1,
            padding: '0 4px',
          }}
          title="Back to Log"
        >
          ←
        </button>
        <h2
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--io-text-primary)',
            flex: 1,
          }}
        >
          {isNew ? 'New Template' : 'Edit Template'}
        </h2>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!name.trim() || saveMutation.isPending}
          style={{
            background: 'var(--io-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 20px',
            cursor: !name.trim() || saveMutation.isPending ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            opacity: !name.trim() || saveMutation.isPending ? 0.7 : 1,
          }}
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Template'}
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 24px', maxWidth: '800px', width: '100%', margin: '0 auto' }}>
        {loading && !isNew ? (
          <div style={{ color: 'var(--io-text-muted)', fontSize: '14px' }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Basic info */}
            <div
              style={{
                background: 'var(--io-surface)',
                border: '1px solid var(--io-border)',
                borderRadius: '8px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div>
                <label style={labelStyle}>Name *</label>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Template name"
                />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    minHeight: '72px',
                    fontFamily: 'inherit',
                  }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>

            {/* Segments section */}
            <div
              style={{
                background: 'var(--io-surface)',
                border: '1px solid var(--io-border)',
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--io-text-primary)',
                  }}
                >
                  Segments
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewSegmentForm(true)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--io-border)',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--io-text-secondary)',
                  }}
                >
                  + New Segment
                </button>
              </div>

              {/* Search / add existing segments */}
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <input
                  style={{
                    ...inputStyle,
                    fontSize: '13px',
                    padding: '7px 10px',
                  }}
                  value={segmentSearch}
                  onChange={(e) => setSegmentSearch(e.target.value)}
                  placeholder="Search existing segments to add..."
                />
                {segmentSearch && filteredSegments.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--io-surface)',
                      border: '1px solid var(--io-border)',
                      borderRadius: '6px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                      zIndex: 100,
                      maxHeight: '200px',
                      overflow: 'auto',
                    }}
                  >
                    {filteredSegments.map((seg: LogSegment) => (
                      <div
                        key={seg.id}
                        onClick={() => addSegment(seg.id)}
                        style={{
                          padding: '9px 12px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: 'var(--io-text-primary)',
                          borderBottom: '1px solid var(--io-border)',
                        }}
                        onMouseEnter={(e) => {
                          ;(e.currentTarget as HTMLDivElement).style.background =
                            'var(--io-surface-secondary)'
                        }}
                        onMouseLeave={(e) => {
                          ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{seg.name}</span>
                        <span
                          style={{
                            marginLeft: '8px',
                            fontSize: '11px',
                            color: 'var(--io-text-muted)',
                          }}
                        >
                          {seg.segment_type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* New segment inline form */}
              {showNewSegmentForm && (
                <div style={{ marginBottom: '12px' }}>
                  <NewSegmentForm
                    onSave={(data) => createSegmentMutation.mutate(data)}
                    onCancel={() => setShowNewSegmentForm(false)}
                    loading={createSegmentMutation.isPending}
                  />
                </div>
              )}

              {/* Current segments list */}
              {selectedSegments.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '24px 0',
                    color: 'var(--io-text-muted)',
                    fontSize: '14px',
                  }}
                >
                  No segments added yet. Search above or create a new one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedSegments.map((seg, idx) => (
                    <div
                      key={selectedSegmentIds[idx]}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'var(--io-surface-secondary)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <button
                          type="button"
                          onClick={() => moveUp(idx)}
                          disabled={idx === 0}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: idx === 0 ? 'not-allowed' : 'pointer',
                            color: idx === 0 ? 'var(--io-text-muted)' : 'var(--io-text-secondary)',
                            lineHeight: 1,
                            padding: '1px 4px',
                            fontSize: '12px',
                          }}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(idx)}
                          disabled={idx === selectedSegments.length - 1}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor:
                              idx === selectedSegments.length - 1 ? 'not-allowed' : 'pointer',
                            color:
                              idx === selectedSegments.length - 1
                                ? 'var(--io-text-muted)'
                                : 'var(--io-text-secondary)',
                            lineHeight: 1,
                            padding: '1px 4px',
                            fontSize: '12px',
                          }}
                        >
                          ▼
                        </button>
                      </div>
                      <span
                        style={{
                          fontSize: '13px',
                          color: 'var(--io-text-muted)',
                          minWidth: '24px',
                          textAlign: 'right',
                        }}
                      >
                        {idx + 1}.
                      </span>
                      <div style={{ flex: 1 }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: 'var(--io-text-primary)',
                            fontSize: '14px',
                          }}
                        >
                          {seg?.name ?? selectedSegmentIds[idx]}
                        </span>
                        {seg && (
                          <span
                            style={{
                              marginLeft: '10px',
                              fontSize: '11px',
                              color: 'var(--io-text-muted)',
                              background: 'var(--io-surface)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {seg.segment_type}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSegment(selectedSegmentIds[idx])}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#f87171',
                          fontSize: '18px',
                          lineHeight: 1,
                          padding: '0 4px',
                        }}
                        title="Remove segment"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
