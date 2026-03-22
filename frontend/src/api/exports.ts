/**
 * Exports API — POST /api/exports
 * Supports both sync (200 + file download) and async (202 + job queued) export modes.
 *
 * Design-docs/25_EXPORT_SYSTEM.md §4
 */

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'io_access_token'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json' | 'parquet' | 'html'

export type ExportScope = 'filtered' | 'all'

export interface CsvOptions {
  delimiter?: ',' | ';' | '\t'
  include_bom?: boolean
}

export interface XlsxOptions {
  include_metadata_sheet?: boolean
}

export type PdfOrientation = 'portrait' | 'landscape'
export type PdfPageSize = 'A4' | 'Letter' | 'Legal' | 'A3'

export interface PdfOptions {
  orientation?: PdfOrientation
  page_size?: PdfPageSize
  include_watermark?: boolean
}

export interface JsonOptions {
  pretty_print?: boolean
}

export type ParquetCompression = 'snappy' | 'zstd'

export interface ParquetOptions {
  compression?: ParquetCompression
}

export interface CreateExportRequest {
  module: string
  entity: string
  format: ExportFormat
  scope: ExportScope
  columns: string[]
  filters?: Record<string, unknown>
  sort_field?: string
  sort_order?: 'asc' | 'desc'
  csv_options?: CsvOptions
  xlsx_options?: XlsxOptions
  pdf_options?: PdfOptions
  json_options?: JsonOptions
  parquet_options?: ParquetOptions
}

export interface ExportJobRef {
  job_id: string
  estimated_rows: number
  message: string
}

export type ExportResult =
  | { type: 'download'; blob: Blob; filename: string }
  | { type: 'queued'; job: ExportJobRef }

// ---------------------------------------------------------------------------
// Helper — derive filename from request
// ---------------------------------------------------------------------------

function derivedFilename(req: CreateExportRequest): string {
  const ext = req.format
  const date = new Date().toISOString().slice(0, 10)
  return req.entity + '-export-' + date + '.' + ext
}

// ---------------------------------------------------------------------------
// exportsApi.create
// ---------------------------------------------------------------------------

export const exportsApi = {
  /**
   * Create an export. Returns either a download (sync) or a job reference (async/queued).
   *
   * - 200 => file bytes returned => trigger browser download
   * - 202 => job queued in background => return job reference for toast
   */
  create: async (req: CreateExportRequest): Promise<ExportResult> => {
    const token = localStorage.getItem(TOKEN_KEY)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = 'Bearer ' + token
    }

    const res = await fetch(API_BASE + '/api/exports', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(req),
    })

    if (res.status === 202) {
      // Async job queued
      let job: ExportJobRef
      try {
        const envelope = (await res.json()) as { data?: ExportJobRef } & Record<string, unknown>
        job = ('data' in envelope ? envelope.data : envelope) as ExportJobRef
      } catch {
        job = { job_id: 'unknown', estimated_rows: 0, message: 'Export queued' }
      }
      return { type: 'queued', job }
    }

    if (!res.ok) {
      let errorMessage = 'Export failed: ' + res.status
      try {
        const errJson = (await res.json()) as { error?: { message: string }; message?: string }
        errorMessage = errJson.error?.message ?? errJson.message ?? errorMessage
      } catch {
        // ignore parse error
      }
      throw new Error(errorMessage)
    }

    // 200 — download the blob
    const blob = await res.blob()
    const contentDisposition = res.headers.get('Content-Disposition') ?? ''
    const filenameMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition)
    const filename = filenameMatch?.[1]?.replace(/['"]/g, '') ?? derivedFilename(req)

    return { type: 'download', blob, filename }
  },

  /**
   * Trigger a browser file download from a Blob.
   */
  triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  /**
   * Preview rows for the export dialog (first 5 rows).
   * POST /api/exports/preview
   */
  preview: async (req: CreateExportRequest): Promise<Record<string, unknown>[]> => {
    const token = localStorage.getItem(TOKEN_KEY)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = 'Bearer ' + token
    }

    try {
      const res = await fetch(API_BASE + '/api/exports/preview', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ ...req, limit: 5 }),
      })

      if (!res.ok) return []

      const envelope = (await res.json()) as { data?: Record<string, unknown>[] } & Record<string, unknown>
      if (Array.isArray(envelope.data)) return envelope.data
      if (Array.isArray(envelope)) return envelope as unknown as Record<string, unknown>[]
      return []
    } catch {
      return []
    }
  },
}
