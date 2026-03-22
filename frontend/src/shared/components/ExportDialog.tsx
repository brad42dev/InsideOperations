import React, { useState, useEffect, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useAuthStore } from '../../store/auth'
import {
  exportsApi,
  ExportFormat,
  ExportScope,
  CreateExportRequest,
  CsvOptions,
  XlsxOptions,
  PdfOptions,
  JsonOptions,
  ParquetOptions,
  PdfOrientation,
  PdfPageSize,
  ParquetCompression,
} from '../../api/exports'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnDef {
  id: string
  label: string
}

export interface ExportDialogProps {
  open: boolean
  onClose: () => void
  module: string
  entity: string
  filteredRowCount: number
  totalRowCount: number
  activeFilters?: Record<string, unknown>
  availableColumns: ColumnDef[]
  visibleColumns: string[]
  sortField?: string
  sortOrder?: 'asc' | 'desc'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: 'csv', label: 'CSV' },
  { id: 'xlsx', label: 'Excel (XLSX)' },
  { id: 'pdf', label: 'PDF' },
  { id: 'json', label: 'JSON' },
  { id: 'parquet', label: 'Parquet' },
  { id: 'html', label: 'HTML' },
]

const LARGE_EXPORT_THRESHOLD = 50_000

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--io-text-secondary)',
  marginBottom: '5px',
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--io-surface-sunken)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  color: 'var(--io-text-primary)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  cursor: 'pointer',
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--io-accent)',
  color: '#09090b',
  border: 'none',
  borderRadius: 'var(--io-radius)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  minWidth: '120px',
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  color: 'var(--io-text-secondary)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  fontSize: '13px',
  cursor: 'pointer',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: '16px',
}

// ---------------------------------------------------------------------------
// FormatOptions — renders format-specific options
// ---------------------------------------------------------------------------

function FormatOptions({
  format,
  csvOptions,
  onCsvChange,
  xlsxOptions,
  onXlsxChange,
  pdfOptions,
  onPdfChange,
  jsonOptions,
  onJsonChange,
  parquetOptions,
  onParquetChange,
}: {
  format: ExportFormat
  csvOptions: CsvOptions
  onCsvChange: (o: CsvOptions) => void
  xlsxOptions: XlsxOptions
  onXlsxChange: (o: XlsxOptions) => void
  pdfOptions: PdfOptions
  onPdfChange: (o: PdfOptions) => void
  jsonOptions: JsonOptions
  onJsonChange: (o: JsonOptions) => void
  parquetOptions: ParquetOptions
  onParquetChange: (o: ParquetOptions) => void
}) {
  if (format === 'csv') {
    return (
      <div style={sectionStyle}>
        <label style={labelStyle}>CSV Options</label>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <label style={{ ...labelStyle, marginBottom: '3px' }}>Delimiter</label>
            <select
              style={selectStyle}
              value={csvOptions.delimiter ?? ','}
              onChange={(e) => onCsvChange({ ...csvOptions, delimiter: e.target.value as CsvOptions['delimiter'] })}
            >
              <option value=",">Comma (,)</option>
              <option value=";">Semicolon (;)</option>
              <option value={'\t'}>Tab</option>
            </select>
          </div>
          <label
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', paddingTop: '18px', color: 'var(--io-text-secondary)' }}
          >
            <input
              type="checkbox"
              checked={csvOptions.include_bom ?? false}
              onChange={(e) => onCsvChange({ ...csvOptions, include_bom: e.target.checked })}
              style={{ accentColor: 'var(--io-accent)' }}
            />
            Include UTF-8 BOM
          </label>
        </div>
      </div>
    )
  }

  if (format === 'xlsx') {
    return (
      <div style={sectionStyle}>
        <label style={labelStyle}>XLSX Options</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--io-text-secondary)' }}>
          <input
            type="checkbox"
            checked={xlsxOptions.include_metadata_sheet ?? false}
            onChange={(e) => onXlsxChange({ ...xlsxOptions, include_metadata_sheet: e.target.checked })}
            style={{ accentColor: 'var(--io-accent)' }}
          />
          Include metadata sheet
        </label>
      </div>
    )
  }

  if (format === 'pdf') {
    return (
      <div style={sectionStyle}>
        <label style={labelStyle}>PDF Options</label>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label style={{ ...labelStyle, marginBottom: '3px' }}>Orientation</label>
            <select
              style={selectStyle}
              value={pdfOptions.orientation ?? 'portrait'}
              onChange={(e) => onPdfChange({ ...pdfOptions, orientation: e.target.value as PdfOrientation })}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label style={{ ...labelStyle, marginBottom: '3px' }}>Page Size</label>
            <select
              style={selectStyle}
              value={pdfOptions.page_size ?? 'A4'}
              onChange={(e) => onPdfChange({ ...pdfOptions, page_size: e.target.value as PdfPageSize })}
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
              <option value="A3">A3</option>
            </select>
          </div>
          <label
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', paddingTop: '18px', color: 'var(--io-text-secondary)' }}
          >
            <input
              type="checkbox"
              checked={pdfOptions.include_watermark ?? false}
              onChange={(e) => onPdfChange({ ...pdfOptions, include_watermark: e.target.checked })}
              style={{ accentColor: 'var(--io-accent)' }}
            />
            Watermark
          </label>
        </div>
      </div>
    )
  }

  if (format === 'json') {
    return (
      <div style={sectionStyle}>
        <label style={labelStyle}>JSON Options</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--io-text-secondary)' }}>
          <input
            type="checkbox"
            checked={jsonOptions.pretty_print ?? false}
            onChange={(e) => onJsonChange({ ...jsonOptions, pretty_print: e.target.checked })}
            style={{ accentColor: 'var(--io-accent)' }}
          />
          Pretty-print
        </label>
      </div>
    )
  }

  if (format === 'parquet') {
    return (
      <div style={sectionStyle}>
        <label style={labelStyle}>Parquet Options</label>
        <div style={{ maxWidth: '200px' }}>
          <label style={{ ...labelStyle, marginBottom: '3px' }}>Compression</label>
          <select
            style={selectStyle}
            value={parquetOptions.compression ?? 'snappy'}
            onChange={(e) => onParquetChange({ ...parquetOptions, compression: e.target.value as ParquetCompression })}
          >
            <option value="snappy">Snappy</option>
            <option value="zstd">Zstd</option>
          </select>
        </div>
      </div>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// AsyncConfirmBanner
// ---------------------------------------------------------------------------

function AsyncConfirmBanner({ rowCount, onConfirm, onCancel }: { rowCount: number; onConfirm: () => void; onCancel: () => void }) {
  const formatted = rowCount >= 1000 ? Math.round(rowCount / 1000) + 'K' : String(rowCount)
  return (
    <div
      style={{
        background: 'rgba(234,179,8,0.1)',
        border: '1px solid rgba(234,179,8,0.3)',
        borderRadius: 'var(--io-radius)',
        padding: '12px 14px',
        marginBottom: '16px',
        fontSize: '13px',
        color: 'var(--io-text-secondary)',
      }}
    >
      <p style={{ margin: '0 0 10px' }}>
        This export contains ~{formatted} rows and will be generated in the background. You'll be notified when it's ready.
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button style={btnPrimary} onClick={onConfirm}>
          Queue Export
        </button>
        <button style={btnSecondary} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExportDialog
// ---------------------------------------------------------------------------

export function ExportDialog({
  open,
  onClose,
  module,
  entity,
  filteredRowCount,
  totalRowCount,
  activeFilters,
  availableColumns,
  visibleColumns,
  sortField,
  sortOrder,
}: ExportDialogProps) {
  const [scope, setScope] = useState<ExportScope>('filtered')
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [selectedColumns, setSelectedColumns] = useState<string[]>(visibleColumns)
  const [csvOptions, setCsvOptions] = useState<CsvOptions>({ delimiter: ',', include_bom: false })
  const [xlsxOptions, setXlsxOptions] = useState<XlsxOptions>({ include_metadata_sheet: false })
  const [pdfOptions, setPdfOptions] = useState<PdfOptions>({ orientation: 'portrait', page_size: 'A4', include_watermark: false })
  const [jsonOptions, setJsonOptions] = useState<JsonOptions>({ pretty_print: false })
  const [parquetOptions, setParquetOptions] = useState<ParquetOptions>({ compression: 'snappy' })
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle')
  const [exportProgress, setExportProgress] = useState(0)
  const [exportError, setExportError] = useState<string | null>(null)
  const [showAsyncConfirm, setShowAsyncConfirm] = useState(false)

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setScope('filtered')
      setFormat('csv')
      setSelectedColumns(visibleColumns)
      setExportStatus('idle')
      setExportProgress(0)
      setExportError(null)
      setShowAsyncConfirm(false)
    }
  }, [open, visibleColumns])

  const activeRowCount = scope === 'filtered' ? filteredRowCount : totalRowCount
  const isLargeExport = activeRowCount >= LARGE_EXPORT_THRESHOLD

  // Build request from current state
  const buildRequest = useCallback((): CreateExportRequest => {
    const req: CreateExportRequest = {
      module,
      entity,
      format,
      scope,
      columns: selectedColumns,
      sort_field: sortField,
      sort_order: sortOrder,
    }
    if (scope === 'filtered' && activeFilters && Object.keys(activeFilters).length > 0) {
      req.filters = activeFilters
    }
    if (format === 'csv') req.csv_options = csvOptions
    if (format === 'xlsx') req.xlsx_options = xlsxOptions
    if (format === 'pdf') req.pdf_options = pdfOptions
    if (format === 'json') req.json_options = jsonOptions
    if (format === 'parquet') req.parquet_options = parquetOptions
    return req
  }, [module, entity, format, scope, selectedColumns, sortField, sortOrder, activeFilters, csvOptions, xlsxOptions, pdfOptions, jsonOptions, parquetOptions])

  // Load preview when scope or columns change
  useEffect(() => {
    if (!open) return
    if (selectedColumns.length === 0) {
      setPreviewRows([])
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    exportsApi.preview(buildRequest()).then((rows) => {
      if (!cancelled) {
        setPreviewRows(rows)
        setPreviewLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setPreviewRows([])
        setPreviewLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [open, scope, selectedColumns, buildRequest])

  function toggleColumn(id: string) {
    setSelectedColumns((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  function selectAllColumns() {
    setSelectedColumns(availableColumns.map((c) => c.id))
  }

  function clearAllColumns() {
    setSelectedColumns([])
  }

  async function doExport() {
    setExportStatus('exporting')
    setExportError(null)
    setExportProgress(20)

    try {
      const req = buildRequest()
      // Simulate progress milestones
      const timer = setInterval(() => {
        setExportProgress((p) => Math.min(p + 15, 85))
      }, 300)

      const result = await exportsApi.create(req)
      clearInterval(timer)
      setExportProgress(100)

      if (result.type === 'download') {
        exportsApi.triggerDownload(result.blob, result.filename)
        setExportStatus('success')
        setTimeout(() => {
          onClose()
          setExportStatus('idle')
        }, 1200)
      } else {
        // queued
        setExportStatus('success')
        setTimeout(() => {
          onClose()
          setExportStatus('idle')
        }, 1500)
      }
    } catch (err) {
      setExportStatus('error')
      setExportError(err instanceof Error ? err.message : 'Export failed')
    }
  }

  function handleExportClick() {
    if (isLargeExport) {
      setShowAsyncConfirm(true)
    } else {
      doExport()
    }
  }

  const exportButtonLabel = (() => {
    if (exportStatus === 'exporting') return 'Exporting... ' + exportProgress + '%'
    if (exportStatus === 'success') return 'Exported!'
    if (isLargeExport) return 'Start Export'
    return 'Export'
  })()

  const previewColumns = selectedColumns.length > 0
    ? selectedColumns.slice(0, 6)
    : availableColumns.slice(0, 6).map((c) => c.id)

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 200,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: '10px',
            padding: '24px',
            width: '620px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            overflowY: 'auto',
            zIndex: 201,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <Dialog.Title style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
              Export {entity}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--io-text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
              >
                &#x2715;
              </button>
            </Dialog.Close>
          </div>

          {/* Row count summary */}
          <div
            style={{
              background: 'var(--io-surface-sunken)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '13px',
              color: 'var(--io-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>
              <strong style={{ color: 'var(--io-text-primary)' }}>{activeRowCount.toLocaleString()}</strong> rows
              {scope === 'filtered' && activeFilters && Object.keys(activeFilters).length > 0 && (
                <span style={{ color: 'var(--io-text-muted)' }}> (filtered)</span>
              )}
              {' '}of {totalRowCount.toLocaleString()} total
            </span>
          </div>

          {/* Async confirm banner */}
          {showAsyncConfirm && (
            <AsyncConfirmBanner
              rowCount={activeRowCount}
              onConfirm={() => { setShowAsyncConfirm(false); doExport() }}
              onCancel={() => setShowAsyncConfirm(false)}
            />
          )}

          {/* Error banner */}
          {exportStatus === 'error' && exportError && (
            <div
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--io-radius)',
                padding: '10px 14px',
                color: 'var(--io-danger)',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {exportError}
            </div>
          )}

          {/* Scope selector */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Scope</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['filtered', 'all'] as ExportScope[]).map((s) => (
                <button
                  key={s}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--io-radius)',
                    border: '1px solid ' + (scope === s ? 'var(--io-accent)' : 'var(--io-border)'),
                    background: scope === s ? 'rgba(var(--io-accent-rgb, 234,179,8),0.15)' : 'transparent',
                    color: scope === s ? 'var(--io-accent)' : 'var(--io-text-secondary)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: scope === s ? 600 : 400,
                  }}
                  onClick={() => setScope(s)}
                >
                  {s === 'filtered'
                    ? 'Current filtered view (' + filteredRowCount.toLocaleString() + ')'
                    : 'All rows (' + totalRowCount.toLocaleString() + ')'}
                </button>
              ))}
            </div>
          </div>

          {/* Format selector */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Format</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'var(--io-radius)',
                    border: '1px solid ' + (format === f.id ? 'var(--io-accent)' : 'var(--io-border)'),
                    background: format === f.id ? 'rgba(var(--io-accent-rgb, 234,179,8),0.15)' : 'transparent',
                    color: format === f.id ? 'var(--io-accent)' : 'var(--io-text-secondary)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: format === f.id ? 600 : 400,
                  }}
                  onClick={() => setFormat(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Format-specific options */}
          <FormatOptions
            format={format}
            csvOptions={csvOptions}
            onCsvChange={setCsvOptions}
            xlsxOptions={xlsxOptions}
            onXlsxChange={setXlsxOptions}
            pdfOptions={pdfOptions}
            onPdfChange={setPdfOptions}
            jsonOptions={jsonOptions}
            onJsonChange={setJsonOptions}
            parquetOptions={parquetOptions}
            onParquetChange={setParquetOptions}
          />

          {/* Column picker */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                Columns ({selectedColumns.length} / {availableColumns.length})
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--io-accent)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                  onClick={selectAllColumns}
                >
                  Select all
                </button>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--io-text-muted)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                  onClick={clearAllColumns}
                >
                  Clear
                </button>
              </div>
            </div>
            <div
              style={{
                maxHeight: '140px',
                overflowY: 'auto',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                padding: '6px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '2px',
              }}
            >
              {availableColumns.map((col) => (
                <label
                  key={col.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'var(--io-text-secondary)',
                    background: selectedColumns.includes(col.id) ? 'var(--io-surface-sunken)' : 'transparent',
                    minWidth: '120px',
                    flex: '0 0 auto',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col.id)}
                    onChange={() => toggleColumn(col.id)}
                    style={{ accentColor: 'var(--io-accent)' }}
                  />
                  {col.label}
                </label>
              ))}
              {availableColumns.length === 0 && (
                <div style={{ padding: '8px', fontSize: '12px', color: 'var(--io-text-muted)' }}>
                  No columns available
                </div>
              )}
            </div>
          </div>

          {/* 5-row preview */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Preview (first 5 rows)</label>
            <div
              style={{
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                overflow: 'hidden',
                overflowX: 'auto',
              }}
            >
              {previewLoading ? (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--io-text-muted)' }}>
                  Loading preview...
                </div>
              ) : previewRows.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--io-text-muted)' }}>
                  {selectedColumns.length === 0 ? 'Select at least one column.' : 'No preview available.'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--io-surface-primary)', borderBottom: '1px solid var(--io-border)' }}>
                      {previewColumns.map((colId) => {
                        const def = availableColumns.find((c) => c.id === colId)
                        return (
                          <th
                            key={colId}
                            style={{
                              padding: '6px 10px',
                              textAlign: 'left',
                              fontWeight: 600,
                              color: 'var(--io-text-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {def?.label ?? colId}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr
                        key={i}
                        style={{ borderBottom: i < previewRows.length - 1 ? '1px solid var(--io-border-subtle)' : undefined }}
                      >
                        {previewColumns.map((colId) => (
                          <td
                            key={colId}
                            style={{ padding: '5px 10px', color: 'var(--io-text-secondary)', whiteSpace: 'nowrap', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {row[colId] == null ? '' : String(row[colId])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <Dialog.Close asChild>
              <button style={btnSecondary} disabled={exportStatus === 'exporting'}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              style={{
                ...btnPrimary,
                opacity: exportStatus === 'exporting' || exportStatus === 'success' ? 0.7 : 1,
                cursor: exportStatus === 'exporting' ? 'not-allowed' : 'pointer',
              }}
              onClick={handleExportClick}
              disabled={exportStatus === 'exporting' || exportStatus === 'success' || selectedColumns.length === 0}
            >
              {exportButtonLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// ExportButton — split button with quick-format dropdown
// ---------------------------------------------------------------------------

export interface ExportButtonProps {
  module: string
  entity: string
  filteredRowCount: number
  totalRowCount: number
  activeFilters?: Record<string, unknown>
  availableColumns: ColumnDef[]
  visibleColumns: string[]
  sortField?: string
  sortOrder?: 'asc' | 'desc'
}

const QUICK_FORMATS: ExportFormat[] = ['csv', 'xlsx', 'pdf', 'json', 'parquet']

export function ExportButton({
  module,
  entity,
  filteredRowCount,
  totalRowCount,
  activeFilters,
  availableColumns,
  visibleColumns,
  sortField,
  sortOrder,
}: ExportButtonProps) {
  const permissions = useAuthStore((s) => s.user?.permissions ?? [])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [quickExporting, setQuickExporting] = useState<ExportFormat | null>(null)

  // Permission check: hide entirely if missing <module>:export
  const hasPermission = permissions.includes(module + ':export') || permissions.includes('settings:export') || permissions.includes('system:export_data')
  if (!hasPermission) return null

  async function quickExport(format: ExportFormat) {
    setDropdownOpen(false)
    setQuickExporting(format)
    try {
      const result = await exportsApi.create({
        module,
        entity,
        format,
        scope: 'filtered',
        columns: visibleColumns.length > 0 ? visibleColumns : availableColumns.map((c) => c.id),
        filters: activeFilters,
        sort_field: sortField,
        sort_order: sortOrder,
      })
      if (result.type === 'download') {
        exportsApi.triggerDownload(result.blob, result.filename)
      }
    } catch {
      // silent — user can use full dialog for error visibility
    } finally {
      setQuickExporting(null)
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Left: open dialog */}
      <button
        style={{
          padding: '7px 14px',
          background: 'transparent',
          color: 'var(--io-text-secondary)',
          border: '1px solid var(--io-border)',
          borderRight: 'none',
          borderRadius: 'var(--io-radius) 0 0 var(--io-radius)',
          fontSize: '13px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          whiteSpace: 'nowrap',
        }}
        onClick={() => setDialogOpen(true)}
        disabled={!!quickExporting}
      >
        {quickExporting ? 'Exporting...' : 'Export'}
      </button>

      {/* Right: chevron opens quick-format picker */}
      <button
        style={{
          padding: '7px 8px',
          background: 'transparent',
          color: 'var(--io-text-secondary)',
          border: '1px solid var(--io-border)',
          borderRadius: '0 var(--io-radius) var(--io-radius) 0',
          fontSize: '12px',
          cursor: 'pointer',
          lineHeight: 1,
        }}
        onClick={() => setDropdownOpen((v) => !v)}
        disabled={!!quickExporting}
        aria-label="Quick format export"
      >
        &#x25BE;
      </button>

      {/* Quick-format dropdown */}
      {dropdownOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
            onClick={() => setDropdownOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              background: 'var(--io-surface-elevated)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              zIndex: 999,
              minWidth: '150px',
              overflow: 'hidden',
            }}
          >
            {QUICK_FORMATS.map((fmt) => (
              <button
                key={fmt}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 14px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--io-text-secondary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--io-surface-secondary)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                onClick={() => quickExport(fmt)}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Full Export Dialog */}
      <ExportDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        module={module}
        entity={entity}
        filteredRowCount={filteredRowCount}
        totalRowCount={totalRowCount}
        activeFilters={activeFilters}
        availableColumns={availableColumns}
        visibleColumns={visibleColumns}
        sortField={sortField}
        sortOrder={sortOrder}
      />
    </div>
  )
}
