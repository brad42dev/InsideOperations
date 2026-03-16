import { api, type ApiResult } from './client'

export interface SearchResult {
  id: string
  type: 'point' | 'equipment' | 'graphic' | 'dashboard' | 'report' | 'user' | 'role'
  name: string
  description?: string
  href: string
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
}

export const searchApi = {
  search: (
    query: string,
    types?: string[],
    limit?: number,
  ): Promise<ApiResult<SearchResponse>> => {
    const params = new URLSearchParams()
    params.set('q', query)
    if (types && types.length > 0) params.set('types', types.join(','))
    if (limit !== undefined) params.set('limit', String(limit))
    return api.get<SearchResponse>(`/api/search?${params.toString()}`)
  },
}
