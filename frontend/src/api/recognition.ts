import { api } from './client'
import type { ApiResult } from './client'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'io_access_token'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ModelInfo {
  id: string
  domain: string        // "pid" | "dcs"
  version: string
  filename: string
  class_count: number
  loaded: boolean
  uploaded_at: string
  file_size_bytes: number
}

export interface RecognitionResult {
  job_id: string
  status: string
  domain: string
  detections: Detection[]
  ocr_results: unknown[]
  line_results?: unknown[]
  processing_ms: number
}

export interface Detection {
  class_name: string
  confidence: number
  bbox: [number, number, number, number]  // [x1, y1, x2, y2] normalized 0..1
  class_id: number
}

export interface DomainStatus {
  model_loaded: boolean
  hardware: string
  mode: 'gpu' | 'cpu' | 'disabled'
}

export interface RecognitionStatus {
  domains: {
    pid: DomainStatus
    dcs: DomainStatus
  }
}

export interface InferenceOptions {
  confidence_threshold?: number
  domain?: 'pid' | 'dcs' | 'auto'
}

export interface RecognitionClass {
  id: number
  name: string
  display_name: string
  domain: string
  template_available: boolean
}

export interface ClassesResult {
  classes: RecognitionClass[]
  domain: string
}

export interface GenerateGraphicBody {
  detections: Detection[]
  domain: 'pid' | 'dcs'
  source_image_hash: string
}

export interface GenerateGraphicResult {
  graphic_id: string
  unmapped_count: number
}

export interface FeedbackStats {
  total_inferences: number
  total_corrections: number
  correction_rate: number
  top_confused: unknown[]
}

export interface ModelHistoryEntry {
  version: string
  domain: string
  loaded_at: string
  replaced_at: string | null
}

export interface ModelHistory {
  models: ModelHistoryEntry[]
}

export interface GapReport {
  id: string
  filename: string
  imported_at: string
  [key: string]: unknown
}

export interface GapReportList {
  reports: GapReport[]
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const recognitionApi = {
  getStatus(): Promise<ApiResult<RecognitionStatus>> {
    return api.get<RecognitionStatus>('/api/recognition/status')
  },

  listModels(): Promise<ApiResult<ModelInfo[]>> {
    return api.get<ModelInfo[]>('/api/recognition/models')
  },

  getModel(id: string): Promise<ApiResult<ModelInfo>> {
    return api.get<ModelInfo>(`/api/recognition/models/${id}`)
  },

  deleteModel(id: string): Promise<ApiResult<{ deleted: boolean }>> {
    return api.delete<{ deleted: boolean }>(`/api/recognition/models/${id}`)
  },

  /** Run inference on an image file via multipart/form-data */
  async runInference(image: File, options?: InferenceOptions): Promise<ApiResult<RecognitionResult>> {
    const token = localStorage.getItem(TOKEN_KEY)
    const form = new FormData()
    form.append('image', image, image.name)
    if (options !== undefined) {
      form.append('options', JSON.stringify(options))
    }

    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
      const res = await fetch(`${API_BASE}/api/recognition/detect`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: form,
      })
      const json = await res.json()
      if (!res.ok) {
        return {
          success: false,
          error: (json as { error?: { code: string; message: string } }).error ?? {
            code: 'SERVER_ERROR',
            message: `Inference failed: ${res.status}`,
          },
        }
      }
      const envelope = json as { data?: RecognitionResult }
      return { success: true, data: envelope.data as RecognitionResult }
    } catch {
      return { success: false, error: { code: 'NETWORK_ERROR', message: 'Network request failed' } }
    }
  },

  /** Upload a .iomodel file via multipart form. Domain is auto-detected from manifest.json. */
  async uploadModel(file: File): Promise<ApiResult<ModelInfo>> {
    const token = localStorage.getItem(TOKEN_KEY)
    const form = new FormData()
    form.append('file', file, file.name)

    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
      const res = await fetch(`${API_BASE}/api/recognition/models`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: form,
      })
      const json = await res.json()
      if (!res.ok) {
        return {
          success: false,
          error: (json as { error?: { code: string; message: string } }).error ?? {
            code: 'SERVER_ERROR',
            message: `Upload failed: ${res.status}`,
          },
        }
      }
      const envelope = json as { data?: ModelInfo }
      return { success: true, data: envelope.data as ModelInfo }
    } catch {
      return { success: false, error: { code: 'NETWORK_ERROR', message: 'Network request failed' } }
    }
  },

  /** Get the list of recognition classes, optionally filtered by domain */
  getClasses(domain?: 'pid' | 'dcs'): Promise<ApiResult<ClassesResult>> {
    const query = domain ? `?domain=${domain}` : ''
    return api.get<ClassesResult>(`/api/recognition/classes${query}`)
  },

  /** Generate a graphic from a set of detections */
  generateGraphic(body: GenerateGraphicBody): Promise<ApiResult<GenerateGraphicResult>> {
    return api.post<GenerateGraphicResult>('/api/recognition/generate', body)
  },

  /** Get feedback statistics */
  getStats(): Promise<ApiResult<FeedbackStats>> {
    return api.get<FeedbackStats>('/api/recognition/feedback/stats')
  },

  /** Export feedback as .iofeedback package */
  exportFeedback(): Promise<ApiResult<{ exported: boolean }>> {
    return api.post<{ exported: boolean }>('/api/recognition/feedback/export', {})
  },

  /** Submit manual corrections for feedback */
  submitCorrections(corrections: unknown): Promise<ApiResult<{ correction_id: string }>> {
    return api.post<{ correction_id: string }>('/api/recognition/feedback/corrections', corrections)
  },

  /** Clear all accumulated feedback */
  clearFeedback(): Promise<ApiResult<{ cleared_count: number }>> {
    return api.delete<{ cleared_count: number }>('/api/recognition/feedback')
  },

  /** Get model load history, optionally filtered by domain */
  getModelHistory(domain?: 'pid' | 'dcs'): Promise<ApiResult<ModelHistory>> {
    const query = domain ? `?domain=${domain}` : ''
    return api.get<ModelHistory>(`/api/recognition/model/history${query}`)
  },

  /** List all imported gap reports */
  getGapReports(): Promise<ApiResult<GapReportList>> {
    return api.get<GapReportList>('/api/recognition/gap-reports')
  },

  /** Get a specific gap report by ID */
  getGapReport(id: string): Promise<ApiResult<GapReport>> {
    return api.get<GapReport>(`/api/recognition/gap-reports/${id}`)
  },

  /** Delete a specific gap report by ID */
  deleteGapReport(id: string): Promise<ApiResult<{ deleted: boolean }>> {
    return api.delete<{ deleted: boolean }>(`/api/recognition/gap-reports/${id}`)
  },

  /** Upload a .iogap gap report via multipart form */
  async uploadGapReport(file: File): Promise<ApiResult<{ imported: boolean; filename: string }>> {
    const token = localStorage.getItem(TOKEN_KEY)
    const form = new FormData()
    form.append('file', file, file.name)

    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
      const res = await fetch(`${API_BASE}/api/recognition/gap-reports`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: form,
      })
      const json = await res.json()
      if (!res.ok) {
        return {
          success: false,
          error: (json as { error?: { code: string; message: string } }).error ?? {
            code: 'SERVER_ERROR',
            message: `Upload failed: ${res.status}`,
          },
        }
      }
      const envelope = json as { data?: { imported: boolean; filename: string } }
      return { success: true, data: envelope.data as { imported: boolean; filename: string } }
    } catch {
      return { success: false, error: { code: 'NETWORK_ERROR', message: 'Network request failed' } }
    }
  },
}
