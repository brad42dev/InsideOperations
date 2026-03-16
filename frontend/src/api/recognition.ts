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
  processing_ms: number
}

export interface Detection {
  class_name: string
  confidence: number
  bbox: [number, number, number, number]  // [x1, y1, x2, y2] normalized 0..1
  class_id: number
}

export interface RecognitionStatus {
  models_loaded: number
  models_total: number
  pid_model: string | null
  dcs_model: string | null
  onnx_available: boolean
}

export interface RunInferenceBody {
  graphic_id?: string
  domain: string
  image_base64?: string
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

  runInference(body: RunInferenceBody): Promise<ApiResult<RecognitionResult>> {
    return api.post<RecognitionResult>('/api/recognition/infer', body)
  },

  /** Upload a .iomodel file via multipart form */
  async uploadModel(file: File, domain: string): Promise<ApiResult<ModelInfo>> {
    const token = localStorage.getItem(TOKEN_KEY)
    const form = new FormData()
    form.append('domain', domain)
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
