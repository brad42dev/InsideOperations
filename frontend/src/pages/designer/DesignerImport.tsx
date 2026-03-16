import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { iographicApi } from '../../api/iographic'
import {
  uploadDcsImport,
  createGraphicFromDcsResult,
  PLATFORMS,
  type DcsPlatform,
  type DcsImportResult,
} from '../../api/dcsImport'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3 | 4
type ActiveTab = 'file' | 'dcs'

interface ParsedResult {
  elementCount: number
  elementTypes: Record<string, number>
  name: string
  format: string
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current, steps }: { current: Step; steps: string[] }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        marginBottom: '32px',
      }}
    >
      {steps.map((label, i) => {
        const stepNum = (i + 1) as Step
        const isDone = stepNum < current
        const isActive = stepNum === current
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDone
                    ? 'var(--io-accent)'
                    : isActive
                    ? 'var(--io-accent)'
                    : 'var(--io-surface-secondary)',
                  border: `2px solid ${isDone || isActive ? 'var(--io-accent)' : 'var(--io-border)'}`,
                  fontSize: '12px',
                  fontWeight: 700,
                  color: isDone || isActive ? '#09090b' : 'var(--io-text-muted)',
                  flexShrink: 0,
                }}
              >
                {isDone ? '\u2713' : stepNum}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: isActive ? 'var(--io-accent)' : 'var(--io-text-muted)',
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  background: isDone ? 'var(--io-accent)' : 'var(--io-border)',
                  margin: '0 8px',
                  marginBottom: '16px',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DCS Import Tab
// ---------------------------------------------------------------------------

type DcsStep = 'platform' | 'upload' | 'parse' | 'preview' | 'convert' | 'converting'

function DcsImportTab() {
  const navigate = useNavigate()
  const [dcsStep, setDcsStep] = useState<DcsStep>('platform')
  const [selectedPlatform, setSelectedPlatform] = useState<DcsPlatform | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [dcsResult, setDcsResult] = useState<DcsImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handlePlatformSelect(id: DcsPlatform) {
    setSelectedPlatform(id)
    setDcsStep('upload')
    setSelectedFile(null)
    setParseError(null)
    setDcsResult(null)
  }

  function handleFileSelect(file: File) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setParseError('Please upload a .zip file containing the extraction kit output.')
      return
    }
    setSelectedFile(file)
    setParseError(null)
  }

  function handleDropZoneClick() {
    fileRef.current?.click()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  async function handleParse() {
    if (!selectedFile || !selectedPlatform) return
    setDcsStep('parse')
    setParseError(null)

    const result = await uploadDcsImport(selectedPlatform, selectedFile)
    if (!result.success) {
      setParseError(result.error.message)
      setDcsStep('upload')
      return
    }

    setDcsResult(result.data)
    setDcsStep('preview')
  }

  async function handleCreateGraphic() {
    if (!dcsResult) return
    setDcsStep('converting')
    setConvertError(null)

    const result = await createGraphicFromDcsResult(dcsResult)
    if (!result.success) {
      setConvertError(result.error.message)
      setDcsStep('preview')
      return
    }

    navigate(`/designer/graphics/${result.data.id}/edit`)
  }

  // ── Platform selection grid ───────────────────────────────────────────────
  if (dcsStep === 'platform') {
    return (
      <div>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Select DCS Platform
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
          Choose the DCS or HMI platform that produced the graphic files you want to import.
          Platforms marked "Kit Required" need an extraction kit run on your DCS workstation first.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '10px',
            marginBottom: '24px',
          }}
        >
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePlatformSelect(p.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '6px',
                padding: '14px',
                background: 'var(--io-surface-secondary)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--io-accent)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--io-border)'
              }}
            >
              {/* Icon letter */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background:
                    p.support === 'full'
                      ? 'var(--io-accent)'
                      : p.support === 'kit'
                      ? 'var(--io-surface-elevated)'
                      : 'var(--io-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: p.support === 'full' ? '#09090b' : 'var(--io-text-muted)',
                  flexShrink: 0,
                  border: '1px solid var(--io-border)',
                }}
              >
                {p.name[0]}
              </div>

              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--io-text-primary)', lineHeight: 1.3 }}>
                {p.name}
              </div>

              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 7px',
                  borderRadius: '100px',
                  background:
                    p.support === 'full'
                      ? 'rgba(var(--io-accent-rgb, 250,204,21),0.15)'
                      : p.support === 'kit'
                      ? 'var(--io-surface-elevated)'
                      : 'transparent',
                  color:
                    p.support === 'full'
                      ? 'var(--io-accent)'
                      : p.support === 'tbd'
                      ? 'var(--io-text-muted)'
                      : 'var(--io-text-secondary)',
                  border: `1px solid ${
                    p.support === 'full'
                      ? 'var(--io-accent)'
                      : p.support === 'kit'
                      ? 'var(--io-border)'
                      : 'transparent'
                  }`,
                  fontWeight: 500,
                }}
              >
                {p.support === 'full' ? 'Full support' : p.support === 'kit' ? 'Kit required' : 'TBD'}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Upload zone ───────────────────────────────────────────────────────────
  if (dcsStep === 'upload') {
    const platform = PLATFORMS.find((p) => p.id === selectedPlatform)!
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <button
            onClick={() => setDcsStep('platform')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--io-text-muted)',
              cursor: 'pointer',
              fontSize: '13px',
              padding: 0,
            }}
          >
            &larr; Platforms
          </button>
          <span style={{ color: 'var(--io-border)' }}>/</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            {platform.name}
          </span>
        </div>

        <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Upload Extraction Kit Output
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
          {platform.support === 'full'
            ? platform.description
            : `Run the ${platform.name} extraction kit on your DCS workstation, then upload the output .zip here.`}
        </p>

        <div
          onClick={handleDropZoneClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? 'var(--io-accent)' : 'var(--io-border)'}`,
            borderRadius: 'var(--io-radius)',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'var(--io-accent-subtle)' : 'var(--io-surface-secondary)',
            transition: 'border-color 0.15s, background 0.15s',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.5 }}>&#x1F4C2;</div>
          {selectedFile ? (
            <>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: '4px' }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
                {(selectedFile.size / 1024).toFixed(1)} KB &mdash; click to change
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: '4px' }}>
                Drag and drop or click to select
              </div>
              <div style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
                Accepts .zip files
              </div>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        {parseError && (
          <div
            style={{
              marginBottom: '16px',
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-danger, #ef4444)',
              fontSize: '13px',
            }}
          >
            {parseError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setDcsStep('platform')}
            style={{
              padding: '8px 18px',
              background: 'transparent',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Back
          </button>
          <button
            onClick={handleParse}
            disabled={!selectedFile}
            style={{
              padding: '8px 18px',
              background: 'var(--io-accent)',
              border: 'none',
              borderRadius: 'var(--io-radius)',
              color: '#09090b',
              cursor: !selectedFile ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              opacity: !selectedFile ? 0.6 : 1,
            }}
          >
            Parse File
          </button>
        </div>
      </div>
    )
  }

  // ── Parsing spinner ───────────────────────────────────────────────────────
  if (dcsStep === 'parse') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: '32px', marginBottom: '16px', animation: 'io-spin 1s linear infinite', display: 'inline-block' }}>&#x27F3;</div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: '4px' }}>
          Parsing DCS graphic...
        </div>
        <div style={{ fontSize: '13px', color: 'var(--io-text-secondary)' }}>
          Extracting elements from {selectedFile?.name}
        </div>
      </div>
    )
  }

  // ── Converting spinner ────────────────────────────────────────────────────
  if (dcsStep === 'converting') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: '32px', marginBottom: '16px', animation: 'io-spin 1s linear infinite', display: 'inline-block' }}>&#x27F3;</div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: '4px' }}>
          Creating graphic...
        </div>
        <div style={{ fontSize: '13px', color: 'var(--io-text-secondary)' }}>
          Building your I/O graphic from the imported elements
        </div>
      </div>
    )
  }

  // ── Preview step ──────────────────────────────────────────────────────────
  if (dcsStep === 'preview' && dcsResult) {
    // Tally element types
    const typeCounts: Record<string, number> = {}
    for (const el of dcsResult.elements) {
      typeCounts[el.element_type] = (typeCounts[el.element_type] ?? 0) + 1
    }
    const taggedCount = dcsResult.elements.filter((el) => el.tag).length

    return (
      <div>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Parse Complete
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
          Review the extracted elements, then click &ldquo;Create Graphic&rdquo; to open in the Designer.
        </p>

        {/* Summary card */}
        <div
          style={{
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginBottom: '2px' }}>Display Name</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)' }}>{dcsResult.display_name}</div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginBottom: '2px' }}>Dimensions</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
                {dcsResult.width} &times; {dcsResult.height}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginBottom: '2px' }}>Elements</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--io-accent)' }}>
                {dcsResult.element_count.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginBottom: '2px' }}>Tagged</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
                {taggedCount}
              </div>
            </div>
          </div>

          {/* Element type breakdown */}
          {Object.keys(typeCounts).length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginBottom: '6px' }}>Element Types</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {Object.entries(typeCounts).map(([type, count]) => (
                  <span
                    key={type}
                    style={{
                      fontSize: '12px',
                      padding: '3px 8px',
                      borderRadius: '100px',
                      background: 'var(--io-surface-secondary)',
                      color: 'var(--io-text-secondary)',
                      border: '1px solid var(--io-border)',
                    }}
                  >
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Unresolved symbols warning */}
        {dcsResult.unresolved_symbols.length > 0 && (
          <div
            style={{
              marginBottom: '16px',
              padding: '10px 14px',
              background: 'rgba(234,179,8,0.08)',
              border: '1px solid rgba(234,179,8,0.35)',
              borderRadius: 'var(--io-radius)',
              fontSize: '13px',
            }}
          >
            <div style={{ fontWeight: 600, color: '#ca8a04', marginBottom: '4px' }}>
              {dcsResult.unresolved_symbols.length} unresolved symbol{dcsResult.unresolved_symbols.length > 1 ? 's' : ''}
            </div>
            <div style={{ color: 'var(--io-text-secondary)', fontSize: '12px' }}>
              These source element types have no matching I/O symbol template and will be imported as generic shapes:{' '}
              {dcsResult.unresolved_symbols.join(', ')}
            </div>
          </div>
        )}

        {/* Scrollable element table */}
        {dcsResult.elements.length > 0 && (
          <div
            style={{
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              marginBottom: '16px',
              maxHeight: '240px',
              overflowY: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr
                  style={{
                    background: 'var(--io-surface-secondary)',
                    position: 'sticky',
                    top: 0,
                  }}
                >
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--io-text-muted)', borderBottom: '1px solid var(--io-border)' }}>
                    ID
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--io-text-muted)', borderBottom: '1px solid var(--io-border)' }}>
                    Type
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--io-text-muted)', borderBottom: '1px solid var(--io-border)' }}>
                    Symbol Class
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--io-text-muted)', borderBottom: '1px solid var(--io-border)' }}>
                    Tag
                  </th>
                </tr>
              </thead>
              <tbody>
                {dcsResult.elements.slice(0, 200).map((el, i) => (
                  <tr
                    key={el.id}
                    style={{
                      background: i % 2 === 0 ? 'transparent' : 'var(--io-surface-secondary)',
                    }}
                  >
                    <td style={{ padding: '6px 12px', color: 'var(--io-text-muted)', fontFamily: 'monospace' }}>
                      {el.id}
                    </td>
                    <td style={{ padding: '6px 12px', color: 'var(--io-text-secondary)' }}>
                      {el.element_type}
                    </td>
                    <td style={{ padding: '6px 12px', color: 'var(--io-text-secondary)' }}>
                      {el.symbol_class ?? '—'}
                    </td>
                    <td style={{ padding: '6px 12px', color: 'var(--io-text-primary)', fontFamily: 'monospace', fontSize: '11px' }}>
                      {el.tag ?? '—'}
                    </td>
                  </tr>
                ))}
                {dcsResult.elements.length > 200 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ padding: '8px 12px', color: 'var(--io-text-muted)', textAlign: 'center', fontSize: '12px' }}
                    >
                      + {(dcsResult.elements.length - 200).toLocaleString()} more elements not shown
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {convertError && (
          <div
            style={{
              marginBottom: '16px',
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-danger, #ef4444)',
              fontSize: '13px',
            }}
          >
            {convertError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              setDcsStep('upload')
              setDcsResult(null)
            }}
            style={{
              padding: '8px 18px',
              background: 'transparent',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Back
          </button>
          <button
            onClick={handleCreateGraphic}
            style={{
              padding: '8px 18px',
              background: 'var(--io-accent)',
              border: 'none',
              borderRadius: 'var(--io-radius)',
              color: '#09090b',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Create Graphic
          </button>
        </div>
      </div>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// DesignerImport
// ---------------------------------------------------------------------------

export default function DesignerImport() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ActiveTab>('file')

  // File import state
  const [step, setStep] = useState<Step>(1)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const ACCEPTED_TYPES = ['.svg', '.json', '.dxf', '.iographic']

  function getFileFormat(file: File): string {
    const name = file.name.toLowerCase()
    if (name.endsWith('.iographic')) return 'iographic'
    if (name.endsWith('.svg')) return 'svg'
    if (name.endsWith('.dxf')) return 'dxf'
    if (name.endsWith('.json')) return 'json'
    return 'unknown'
  }

  function handleFileSelect(file: File) {
    const fmt = getFileFormat(file)
    if (fmt === 'unknown') {
      setParseError('Unsupported file type. Please use .svg, .json, .dxf, or .iographic')
      return
    }
    setSelectedFile(file)
    setParseError(null)
    setParsedResult(null)
  }

  function handleDropZoneClick() {
    fileRef.current?.click()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  async function handleParseOrImport() {
    if (!selectedFile) return
    const fmt = getFileFormat(selectedFile)

    // .iographic: skip parse steps, import directly
    if (fmt === 'iographic') {
      setIsImporting(true)
      setImportError(null)
      try {
        const r = await iographicApi.importGraphic(selectedFile)
        if (!r.success) throw new Error(r.error.message)
        // Single graphic → open it directly. Multiple → go to the list so the
        // user can see everything that was imported.
        if (r.data.count === 1) {
          navigate(`/designer/graphics/${r.data.id}/edit`)
        } else {
          navigate('/designer/graphics', {
            state: { importedCount: r.data.count, importedIds: r.data.ids },
          })
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Import failed')
      } finally {
        setIsImporting(false)
      }
      return
    }

    // SVG/DXF/JSON: call parse endpoint
    setIsParsing(true)
    setParseError(null)
    setStep(2)

    try {
      const API_BASE = import.meta.env.VITE_API_URL ?? ''
      const token = localStorage.getItem('io_access_token') ?? ''
      const formData = new FormData()
      formData.append('file', selectedFile)

      const endpoint = fmt === 'dxf' ? '/api/parse/dxf' : '/api/parse/svg'
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(json.message ?? `Parse failed (${res.status})`)
      }

      const json = (await res.json()) as {
        data?: {
          element_count?: number
          element_types?: Record<string, number>
        }
      }
      const data = json.data ?? {}

      setParsedResult({
        elementCount: data.element_count ?? 0,
        elementTypes: data.element_types ?? {},
        name: selectedFile.name.replace(/\.[^.]+$/, ''),
        format: fmt,
      })
      setStep(3)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Parse failed')
      setStep(1)
    } finally {
      setIsParsing(false)
    }
  }

  async function handleConvertToGraphic() {
    if (!selectedFile || !parsedResult) return
    setIsImporting(true)
    setImportError(null)
    setStep(4)

    try {
      const API_BASE = import.meta.env.VITE_API_URL ?? ''
      const token = localStorage.getItem('io_access_token') ?? ''
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('name', parsedResult.name)

      const res = await fetch(`${API_BASE}/api/parse/convert-graphic`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(json.message ?? `Conversion failed (${res.status})`)
      }

      const json = (await res.json()) as { data?: { id?: string } }
      const id = json.data?.id
      if (id) {
        navigate(`/designer/graphics/${id}/edit`)
      } else {
        throw new Error('No graphic ID returned')
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Conversion failed')
      setStep(3)
    } finally {
      setIsImporting(false)
    }
  }

  const FILE_STEPS = ['Select File', 'Parsing', 'Preview', 'Converting']

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
          &larr; Designer
        </button>
        <span style={{ color: 'var(--io-border)' }}>/</span>
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Import Graphics
        </span>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--io-border)',
          background: 'var(--io-surface)',
          padding: '0 24px',
          flexShrink: 0,
        }}
      >
        {(
          [
            { id: 'file' as const, label: 'File Import' },
            { id: 'dcs' as const, label: 'DCS Graphics' },
          ] as { id: ActiveTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--io-accent)' : 'transparent'}`,
              color: activeTab === tab.id ? 'var(--io-accent)' : 'var(--io-text-muted)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? 600 : 400,
              marginBottom: '-1px',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>

          {/* ── File Import tab ── */}
          {activeTab === 'file' && (
            <>
              <StepIndicator current={step} steps={FILE_STEPS} />

              {/* Step 1: File selection */}
              {step === 1 && (
                <div>
                  <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
                    Select a file to import
                  </h3>
                  <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
                    Supported formats: SVG, DXF, JSON, or .iographic package files.
                    .iographic files are imported directly without a parse step.
                  </p>

                  <div
                    onClick={handleDropZoneClick}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{
                      border: `2px dashed ${isDragging ? 'var(--io-accent)' : 'var(--io-border)'}`,
                      borderRadius: 'var(--io-radius)',
                      padding: '40px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: isDragging ? 'var(--io-accent-subtle)' : 'var(--io-surface-secondary)',
                      transition: 'border-color 0.15s, background 0.15s',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.6 }}>&#x2B06;</div>
                    {selectedFile ? (
                      <>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: '4px' }}>
                          {selectedFile.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
                          {(selectedFile.size / 1024).toFixed(1)} KB &mdash; click to change
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: '4px' }}>
                          Drag and drop or click to select
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
                          {ACCEPTED_TYPES.join(', ')}
                        </div>
                      </>
                    )}
                  </div>

                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(',')}
                    style={{ display: 'none' }}
                    onChange={handleInputChange}
                  />

                  {parseError && (
                    <div
                      style={{
                        marginBottom: '16px',
                        padding: '10px 14px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 'var(--io-radius)',
                        color: 'var(--io-danger, #ef4444)',
                        fontSize: '13px',
                      }}
                    >
                      {parseError}
                    </div>
                  )}

                  {importError && (
                    <div
                      style={{
                        marginBottom: '16px',
                        padding: '10px 14px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 'var(--io-radius)',
                        color: 'var(--io-danger, #ef4444)',
                        fontSize: '13px',
                      }}
                    >
                      {importError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => navigate('/designer/graphics')}
                      style={{
                        padding: '8px 18px',
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
                      onClick={handleParseOrImport}
                      disabled={!selectedFile || isImporting}
                      style={{
                        padding: '8px 18px',
                        background: 'var(--io-accent)',
                        border: 'none',
                        borderRadius: 'var(--io-radius)',
                        color: '#09090b',
                        cursor: !selectedFile || isImporting ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        opacity: !selectedFile || isImporting ? 0.6 : 1,
                      }}
                    >
                      {isImporting
                        ? 'Importing...'
                        : selectedFile && getFileFormat(selectedFile) === 'iographic'
                        ? 'Import'
                        : 'Parse File'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Parsing */}
              {step === 2 && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: '32px', marginBottom: '16px', animation: 'io-spin 1s linear infinite', display: 'inline-block' }}>&#x27F3;</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: '4px' }}>
                    {isParsing ? 'Parsing file...' : 'Processing...'}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--io-text-secondary)' }}>
                    Extracting elements from {selectedFile?.name}
                  </div>
                </div>
              )}

              {/* Step 3: Preview */}
              {step === 3 && parsedResult && (
                <div>
                  <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
                    Parse complete
                  </h3>
                  <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
                    Review the parsed content below, then convert to a graphic to open in the designer.
                  </p>

                  <div
                    style={{
                      background: 'var(--io-surface-elevated)',
                      border: '1px solid var(--io-border)',
                      borderRadius: 'var(--io-radius)',
                      padding: '16px',
                      marginBottom: '20px',
                    }}
                  >
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginBottom: '2px' }}>File</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
                        {selectedFile?.name}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        marginBottom: '12px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginBottom: '2px' }}>Total Elements</div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--io-accent)' }}>
                          {parsedResult.elementCount.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginBottom: '2px' }}>Format</div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)', textTransform: 'uppercase' }}>
                          {parsedResult.format}
                        </div>
                      </div>
                    </div>

                    {Object.keys(parsedResult.elementTypes).length > 0 && (
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginBottom: '8px' }}>Element Types</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {Object.entries(parsedResult.elementTypes).map(([type, count]) => (
                            <span
                              key={type}
                              style={{
                                fontSize: '12px',
                                padding: '3px 8px',
                                borderRadius: '100px',
                                background: 'var(--io-surface-secondary)',
                                color: 'var(--io-text-secondary)',
                              }}
                            >
                              {type}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {importError && (
                    <div
                      style={{
                        marginBottom: '16px',
                        padding: '10px 14px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 'var(--io-radius)',
                        color: 'var(--io-danger, #ef4444)',
                        fontSize: '13px',
                      }}
                    >
                      {importError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setStep(1); setParsedResult(null) }}
                      style={{
                        padding: '8px 18px',
                        background: 'transparent',
                        border: '1px solid var(--io-border)',
                        borderRadius: 'var(--io-radius)',
                        color: 'var(--io-text-secondary)',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      Back
                    </button>
                    <button
                      onClick={handleConvertToGraphic}
                      disabled={isImporting}
                      style={{
                        padding: '8px 18px',
                        background: 'var(--io-accent)',
                        border: 'none',
                        borderRadius: 'var(--io-radius)',
                        color: '#09090b',
                        cursor: isImporting ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        opacity: isImporting ? 0.6 : 1,
                      }}
                    >
                      Convert to Graphic
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Converting */}
              {step === 4 && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: '32px', marginBottom: '16px', animation: 'io-spin 1s linear infinite', display: 'inline-block' }}>&#x27F3;</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: '4px' }}>
                    Converting to graphic...
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--io-text-secondary)' }}>
                    Creating your graphic in the Designer
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── DCS Graphics tab ── */}
          {activeTab === 'dcs' && <DcsImportTab />}

        </div>
      </div>

      <style>{`
        @keyframes io-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
