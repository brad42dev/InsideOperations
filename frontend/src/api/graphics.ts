import { api, type ApiResult } from './client'
import type { GraphicDocument, GraphicBindings } from '../shared/types/graphics'

export interface GraphicSummary {
  id: string
  name: string
  type: string
  /** Optional module tag from metadata.module — "process", "console", or absent (untagged) */
  module?: string
  created_at: string
  created_by: string
  bindings_count: number
}

export interface CreateGraphicBody {
  name: string
  type: 'graphic' | 'template' | 'symbol'
  svg_data: string
  bindings?: GraphicBindings
  metadata?: { width: number; height: number; viewBox?: string; description?: string }
}

export interface ShapeObject {
  id: string
  name: string
  type: 'shape' | 'stencil'
  svg_data: string
  category?: string
  tags?: string[]
  created_at: string
}

export interface CreateShapeBody {
  name: string
  type: 'shape' | 'stencil'
  svg_data: string
  category?: string
  tags?: string[]
}

export const graphicsApi = {
  list: (module?: 'process' | 'console'): Promise<ApiResult<GraphicSummary[]>> =>
    api.get<GraphicSummary[]>(module ? `/api/graphics?module=${module}` : '/api/graphics'),

  get: (id: string): Promise<ApiResult<GraphicDocument>> =>
    api.get<GraphicDocument>(`/api/graphics/${id}`),

  create: (body: CreateGraphicBody): Promise<ApiResult<GraphicDocument>> =>
    api.post<GraphicDocument>('/api/graphics', body),

  update: (id: string, body: Partial<CreateGraphicBody>): Promise<ApiResult<GraphicDocument>> =>
    api.put<GraphicDocument>(`/api/graphics/${id}`, body),

  remove: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/graphics/${id}`),

  tileInfo: (id: string): Promise<ApiResult<{
    tile_base_url: string
    max_zoom: number
    tile_size: number
    width: number
    height: number
  }>> =>
    api.get(`/api/graphics/${id}/tile-info`),

  listShapes: (type?: 'shape' | 'stencil'): Promise<ApiResult<ShapeObject[]>> =>
    api.get<ShapeObject[]>(`/api/design-objects${type ? `?type=${type}` : ''}`),

  createShape: (body: CreateShapeBody): Promise<ApiResult<ShapeObject>> =>
    api.post<ShapeObject>('/api/design-objects', body),
}
