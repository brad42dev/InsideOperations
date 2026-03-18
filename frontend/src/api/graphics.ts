import { api, queryString } from './client'
import type { GraphicDocument, GraphicSummary } from '../shared/types/graphics'

export interface DesignObjectSummary extends GraphicSummary {}

export interface DesignObjectCreateRequest {
  name: string
  scene_data: GraphicDocument
}

export interface DesignObjectUpdateRequest {
  name?: string
  scene_data?: GraphicDocument
}

export interface ShapeBatchResponse {
  [shapeId: string]: {
    svg: string
    sidecar: Record<string, unknown>
  }
}

export const graphicsApi = {
  /** List all design objects (graphics) */
  list: (params?: { scope?: 'console' | 'process'; mode?: 'graphic' | 'dashboard' | 'report' }) =>
    api.get<{ data: DesignObjectSummary[]; total: number }>(
      `/api/v1/design-objects${queryString(params as Record<string, unknown>)}`
    ),

  /** Get a single graphic by ID */
  get: (id: string) =>
    api.get<{ data: { id: string; name: string; scene_data: GraphicDocument; version: number; updatedAt: string } }>(
      `/api/v1/design-objects/${id}`
    ),

  /** Create a new graphic */
  create: (payload: DesignObjectCreateRequest) =>
    api.post<{ data: { id: string } }>('/api/v1/design-objects', payload),

  /** Update an existing graphic */
  update: (id: string, payload: DesignObjectUpdateRequest) =>
    api.put<{ data: { id: string; version: number } }>(`/api/v1/design-objects/${id}`, payload),

  /** Delete a graphic */
  remove: (id: string) =>
    api.delete(`/api/v1/design-objects/${id}`),

  /** Batch fetch shapes from the shape library */
  batchShapes: (shapeIds: string[]) =>
    api.post<ShapeBatchResponse>('/api/v1/shapes/batch', { shapeIds }),

  /** Get a graphic's thumbnail URL */
  thumbnailUrl: (id: string) => `/api/v1/design-objects/${id}/thumbnail.png`,

  /** Upload an image asset */
  uploadImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ data: { hash: string; url: string } }>('/api/v1/image-assets', form)
  },

  /** Get image asset URL by hash */
  imageUrl: (hash: string) => `/api/v1/image-assets/${hash}`,

  /** Export a graphic as a .iographic ZIP (returns Blob) */
  exportIographic: async (id: string, description?: string): Promise<Blob> => {
    const resp = await fetch(`/api/v1/design-objects/${id}/export/iographic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: description ?? '' }),
      credentials: 'include',
    })
    if (!resp.ok) throw new Error(`Export failed: ${resp.statusText}`)
    return resp.blob()
  },

  /** Analyze a .iographic file before import (returns structured analysis) */
  analyzeIographic: async (file: File): Promise<IographicAnalysis> => {
    const form = new FormData()
    form.append('file', file)
    const resp = await fetch('/api/v1/design-objects/import/iographic/analyze', {
      method: 'POST',
      body: form,
      credentials: 'include',
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ message: resp.statusText }))
      throw new Error(err.message ?? 'Analysis failed')
    }
    const json = await resp.json()
    return json.data as IographicAnalysis
  },

  /** Commit an import after user resolves decisions */
  commitIographic: async (file: File, options: IographicImportOptions): Promise<IographicImportResult> => {
    const form = new FormData()
    form.append('file', file)
    form.append('options', JSON.stringify(options))
    const resp = await fetch('/api/v1/design-objects/import/iographic', {
      method: 'POST',
      body: form,
      credentials: 'include',
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ message: resp.statusText }))
      throw new Error(err.message ?? 'Import failed')
    }
    const json = await resp.json()
    return json.data as IographicImportResult
  },
}

// ── .iographic import/export types ──────────────────────────────────────────

export interface IographicManifest {
  format: 'iographic'
  format_version: string
  generator: { application: string; version: string; instance_id?: string }
  exported_at: string
  exported_by: string
  description?: string
  graphics: Array<{ directory: string; name: string; type: string }>
  shapes: Array<{ directory: string; name: string; shape_id: string }>
  stencils: Array<{ directory: string; name: string }>
  shape_dependencies: string[]
  point_tags: string[]
  checksum: string
}

export interface IographicTagResolution {
  tag: string
  source_hint?: string
  status: 'resolved' | 'ambiguous' | 'unresolved'
  resolved_to?: string  // point UUID if resolved
  candidates?: Array<{ id: string; tagname: string; source: string }>
}

export interface IographicShapeStatus {
  shape_id: string
  name?: string
  status: 'available' | 'missing' | 'custom_new' | 'custom_exists'
  action?: 'import' | 'use_existing' | 'import_as_copy' | 'skip'
}

export interface IographicAnalysis {
  manifest: IographicManifest
  tag_resolutions: IographicTagResolution[]
  shape_statuses: IographicShapeStatus[]
  stencil_statuses: Array<{ stencil_id: string; name: string; status: 'new' | 'exists' }>
  valid: boolean
  errors: string[]
}

export interface IographicImportOptions {
  tag_mappings: Array<{ original_tag: string; mapped_tag?: string; action: 'keep' | 'remap' | 'skip' }>
  shape_actions: Array<{ shape_id: string; action: 'import' | 'use_existing' | 'import_as_copy' | 'skip' }>
  stencil_actions: Array<{ stencil_id: string; action: 'import' | 'use_existing' | 'skip' }>
  target_name?: string
  import_as: 'draft' | 'published'
  overwrite: boolean
}

export interface IographicImportResult {
  graphics_imported: number
  shapes_imported: number
  stencils_imported: number
  bindings_resolved: number
  bindings_unresolved: number
  bindings_total: number
  unresolved_tags: string[]
  missing_shapes: string[]
  graphic_ids: string[]
}
