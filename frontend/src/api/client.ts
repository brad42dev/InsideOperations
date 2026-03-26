const API_BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'io_access_token'

export interface ApiError {
  code: string
  message: string
  details?: Array<{ field: string; message: string }>
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError }

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      })
      clearTimeout(timeoutId)
      if (!res.ok) return null
      const json = (await res.json()) as { data?: { access_token?: string }; access_token?: string }
      const token = json.data?.access_token ?? (json as { access_token?: string }).access_token
      if (token) {
        localStorage.setItem(TOKEN_KEY, token)
        return token
      }
      return null
    } catch (err) {
      clearTimeout(timeoutId)
      throw err
    }
  } catch {
    return null
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false,
): Promise<ApiResult<T>> {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let res: Response
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        credentials: 'include',
        signal: controller.signal,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      clearTimeout(timeoutId)
    } catch (err) {
      clearTimeout(timeoutId)
      throw err
    }
  } catch (err) {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Network request failed' },
    }
  }

  if (res.status === 401 && !isRetry) {
    // Try to refresh
    if (!isRefreshing) {
      isRefreshing = true
      refreshPromise = doRefresh().finally(() => {
        isRefreshing = false
        refreshPromise = null
      })
    }
    const newToken = await refreshPromise
    if (newToken) {
      return request<T>(method, path, body, true)
    } else {
      // Refresh failed — clear auth and redirect
      localStorage.removeItem(TOKEN_KEY)
      // Dynamically import to avoid circular dep
      import('../store/auth').then((mod) => {
        mod.useAuthStore.getState().clearAuth()
      })
      window.location.href = '/login'
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' },
      }
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
    const errJson = json as {
      error?: ApiError
      code?: string
      message?: string
    }
    return {
      success: false,
      error: errJson.error ?? {
        code: errJson.code ?? 'SERVER_ERROR',
        message: errJson.message ?? `Server error: ${res.status}`,
      },
    }
  }

  // Unwrap envelope.
  // PagedResponse shape: { success, data: T[], pagination: {...} }
  //   → return { data: T[], pagination } so PaginatedResult<T> consumers work.
  // ApiResponse shape:   { success, data: T }
  //   → return data directly.
  // Plain data: return as-is.
  const envelope = json as { success?: boolean; data?: unknown; pagination?: unknown } & Record<string, unknown>
  if ('pagination' in envelope && Array.isArray(envelope.data)) {
    return {
      success: true,
      data: { data: envelope.data, pagination: envelope.pagination } as T,
    }
  }
  if ('data' in envelope) {
    return { success: true, data: envelope.data as T }
  }
  // Some endpoints return plain data
  return { success: true, data: json as T }
}

async function requestForm<T>(method: string, path: string, form: FormData, isRetry = false): Promise<ApiResult<T>> {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  // Do NOT set Content-Type — browser sets it with boundary for multipart/form-data

  let res: Response
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout for file uploads
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        credentials: 'include',
        signal: controller.signal,
        body: form,
      })
      clearTimeout(timeoutId)
    } catch (err) {
      clearTimeout(timeoutId)
      throw err
    }
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Network request failed' },
    }
  }

  if (res.status === 401 && !isRetry) {
    if (!isRefreshing) {
      isRefreshing = true
      refreshPromise = doRefresh().finally(() => {
        isRefreshing = false
        refreshPromise = null
      })
    }
    const newToken = await refreshPromise
    if (newToken) {
      return requestForm<T>(method, path, form, true)
    } else {
      localStorage.removeItem(TOKEN_KEY)
      import('../store/auth').then((mod) => {
        mod.useAuthStore.getState().clearAuth()
      })
      window.location.href = '/login'
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' },
      }
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
    const errJson = json as { error?: ApiError; code?: string; message?: string }
    return {
      success: false,
      error: errJson.error ?? {
        code: errJson.code ?? 'SERVER_ERROR',
        message: errJson.message ?? `Server error: ${res.status}`,
      },
    }
  }

  const envelope = json as { success?: boolean; data?: unknown; pagination?: unknown } & Record<string, unknown>
  if ('pagination' in envelope && Array.isArray(envelope.data)) {
    return { success: true, data: { data: envelope.data, pagination: envelope.pagination } as T }
  }
  if ('data' in envelope) {
    return { success: true, data: envelope.data as T }
  }
  return { success: true, data: json as T }
}

export const api = {
  get<T>(path: string): Promise<ApiResult<T>> {
    return request<T>('GET', path)
  },
  post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    return request<T>('POST', path, body)
  },
  put<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    return request<T>('PUT', path, body)
  },
  patch<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    return request<T>('PATCH', path, body)
  },
  delete<T = void>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return request<T>('DELETE', path, body)
  },
  postForm<T>(path: string, form: FormData): Promise<ApiResult<T>> {
    return requestForm<T>('POST', path, form)
  },
}

export function queryString(params?: Record<string, unknown>): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
}
