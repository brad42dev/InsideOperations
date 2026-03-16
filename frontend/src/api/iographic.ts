import type { ApiResult } from './client'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export const iographicApi = {
  /**
   * Returns the URL for downloading a .iographic export.
   * Use as href or window.open target for direct download.
   */
  exportGraphicUrl: (id: string): string =>
    `${API_BASE}/api/graphics/${id}/export`,

  /**
   * Imports a .iographic package file.
   * Returns the new graphic ID on success.
   */
  importGraphic: async (file: File): Promise<ApiResult<{ id: string; name: string; ids: string[]; count: number }>> => {
    const token = localStorage.getItem('io_access_token') ?? ''
    const formData = new FormData()
    formData.append('file', file)

    let res: Response
    try {
      res = await fetch(`${API_BASE}/api/graphics/import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: formData,
      })
    } catch {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: 'Network request failed' },
      }
    }

    let json: unknown
    try {
      json = await res.json()
    } catch {
      return {
        success: false,
        error: { code: 'PARSE_ERROR', message: 'Failed to parse server response' },
      }
    }

    if (!res.ok) {
      const errJson = json as { error?: { code: string; message: string }; message?: string }
      return {
        success: false,
        error: errJson.error ?? {
          code: 'SERVER_ERROR',
          message: errJson.message ?? `Server error: ${res.status}`,
        },
      }
    }

    const envelope = json as { success?: boolean; data?: { id: string; name: string; ids: string[]; count: number } }
    if (envelope.data) {
      return { success: true, data: envelope.data }
    }

    return {
      success: false,
      error: { code: 'MISSING_DATA', message: 'No data returned from import' },
    }
  },
}
