import type { ApiResult } from './client'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'io_access_token'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DcsElementType =
  | 'equipment'
  | 'pipe'
  | 'instrument'
  | 'valve'
  | 'dynamic_text'
  | 'bar_graph'
  | 'status_text'

export type DisplayElementHint =
  | 'text_readout'
  | 'analog_bar'
  | 'fill_gauge'
  | 'sparkline'
  | 'digital_status'

export interface DcsElement {
  id: string
  element_type: DcsElementType
  x: number
  y: number
  width: number
  height: number
  symbol_class: string | null
  tag: string | null
  label: string | null
  display_element_hint: DisplayElementHint | null
  properties: Record<string, unknown>
}

export interface DcsImportResult {
  display_name: string
  width: number
  height: number
  element_count: number
  elements: DcsElement[]
  unresolved_symbols: string[]
  platform: string
  tags: string[]
  manifest_platform: string | null
  import_warnings: string[]
}

export type DcsPlatform =
  | 'honeywell_experion'
  | 'emerson_deltav'
  | 'yokogawa_centum'
  | 'abb_800xa'
  | 'siemens_pcs7'
  | 'foxboro_ia'
  | 'ge_proficy'
  | 'wonderware'
  | 'aspentech_aspen'
  | 'rockwell_factorytalk'
  | 'generic_svg'
  | 'generic_json'

export interface PlatformInfo {
  id: DcsPlatform
  name: string
  /** "full" = supported natively; "kit" = requires extraction kit; "tbd" = not yet evaluated */
  support: 'full' | 'kit' | 'tbd'
  description: string
}

export const PLATFORMS: PlatformInfo[] = [
  {
    id: 'generic_svg',
    name: 'Generic SVG',
    support: 'full',
    description: 'ZIP containing one or more SVG files with optional data-tag attributes',
  },
  {
    id: 'generic_json',
    name: 'Generic JSON',
    support: 'full',
    description: 'ZIP containing display.json in I/O intermediate format',
  },
  {
    id: 'honeywell_experion',
    name: 'Honeywell Experion PKS',
    support: 'kit',
    description: 'HMIWeb .htm files with VML shapes and tag bindings',
  },
  {
    id: 'emerson_deltav',
    name: 'Emerson DeltaV Live',
    support: 'kit',
    description: 'Live Enterprise View HTML5/SVG or SQL extraction',
  },
  {
    id: 'yokogawa_centum',
    name: 'Yokogawa CENTUM VP',
    support: 'kit',
    description: 'WPF/XAML graphic files from engineering workstation',
  },
  {
    id: 'abb_800xa',
    name: 'ABB 800xA',
    support: 'tbd',
    description: 'Aspect Object database — pending hands-on evaluation',
  },
  {
    id: 'siemens_pcs7',
    name: 'Siemens PCS 7 / WinCC Classic',
    support: 'kit',
    description: 'VBA extraction via WinCC ODK on engineering workstation',
  },
  {
    id: 'foxboro_ia',
    name: 'Foxboro I/A Series',
    support: 'kit',
    description: 'ASCII .g display files — direct file copy, no special tools needed',
  },
  {
    id: 'ge_proficy',
    name: 'GE iFIX / Proficy',
    support: 'kit',
    description: 'Native SVG export via iFIX Export Picture utility',
  },
  {
    id: 'wonderware',
    name: 'AVEVA InTouch / Wonderware',
    support: 'kit',
    description: 'InTouch XML Export or GRAccess API extraction',
  },
  {
    id: 'aspentech_aspen',
    name: 'AspenTech Aspen',
    support: 'tbd',
    description: 'Pending extraction path evaluation',
  },
  {
    id: 'rockwell_factorytalk',
    name: 'Rockwell FactoryTalk View',
    support: 'kit',
    description: 'Native XML export via Graphics Import Export Wizard',
  },
]

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export interface DcsImportJobSummary {
  id: string
  platform: string
  display_name: string
  element_count: number
  created_at: string
  /** 'preview' | 'partial' | 'ready' */
  status: string
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Fetch all DCS import jobs for the current user, ordered newest-first.
 */
export async function listImportJobs(): Promise<ApiResult<DcsImportJobSummary[]>> {
  const token = localStorage.getItem(TOKEN_KEY) ?? ''

  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/designer/import/dcs`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
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

  const envelope = json as { success?: boolean; data?: { jobs?: DcsImportJobSummary[] } }
  if (envelope.data?.jobs !== undefined) {
    return { success: true, data: envelope.data.jobs }
  }

  return {
    success: false,
    error: { code: 'MISSING_DATA', message: 'No job list returned' },
  }
}

/**
 * Upload a ZIP file to the DCS import endpoint.
 * Returns the parsed intermediate representation.
 */
export async function uploadDcsImport(
  platform: DcsPlatform,
  file: File,
): Promise<ApiResult<DcsImportResult>> {
  const token = localStorage.getItem(TOKEN_KEY) ?? ''
  const formData = new FormData()
  formData.append('platform', platform)
  formData.append('file', file)

  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/dcs-import`, {
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
    const errJson = json as {
      error?: { code: string; message: string }
      message?: string
    }
    return {
      success: false,
      error: errJson.error ?? {
        code: 'SERVER_ERROR',
        message: errJson.message ?? `Server error: ${res.status}`,
      },
    }
  }

  const envelope = json as { success?: boolean; data?: DcsImportResult }
  if (envelope.data) {
    return { success: true, data: envelope.data }
  }

  return {
    success: false,
    error: { code: 'MISSING_DATA', message: 'No data returned from DCS import' },
  }
}

/**
 * Convert a DcsImportResult into a new I/O graphic via POST /api/graphics.
 * Returns the new graphic ID.
 */
export async function createGraphicFromDcsResult(
  result: DcsImportResult,
): Promise<ApiResult<{ id: string }>> {
  const token = localStorage.getItem(TOKEN_KEY) ?? ''

  // Build a minimal SVG canvas from the parsed elements
  const svgElements = result.elements
    .map((el) => {
      if (el.element_type === 'pipe') {
        return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="none" stroke="#808080" stroke-width="2"/>`
      }
      if (el.element_type === 'dynamic_text' || el.element_type === 'instrument') {
        const text = el.label ?? el.tag ?? el.id
        return `<text x="${el.x}" y="${el.y + el.height * 0.5}" font-size="12" fill="#334155">${escapeXml(text)}</text>`
      }
      // Default: rect placeholder with symbol class label
      const label = el.symbol_class ?? el.element_type
      return [
        `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="none" stroke="#64748b" stroke-width="1.5" rx="2"/>`,
        `<text x="${el.x + el.width / 2}" y="${el.y + el.height / 2 + 4}" text-anchor="middle" font-size="10" fill="#64748b">${escapeXml(label)}</text>`,
      ].join('\n')
    })
    .join('\n')

  const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${result.width}" height="${result.height}" viewBox="0 0 ${result.width} ${result.height}">
  <rect width="${result.width}" height="${result.height}" fill="#f8fafc"/>
  ${svgElements}
</svg>`

  // Build bindings from elements that have tags
  const bindings: Record<string, unknown> = {}
  for (const el of result.elements) {
    if (el.tag) {
      bindings[el.id] = {
        tagId: el.tag,
        displayHint: el.display_element_hint ?? 'text_readout',
        symbolClass: el.symbol_class,
      }
    }
  }

  const body = {
    name: result.display_name,
    type: 'graphic',
    svg_data: svgData,
    bindings: Object.keys(bindings).length > 0 ? bindings : undefined,
    metadata: {
      width: result.width,
      height: result.height,
      viewBox: `0 0 ${result.width} ${result.height}`,
      description: `Imported from DCS platform: ${result.platform}`,
    },
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/graphics`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body),
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
    const errJson = json as {
      error?: { code: string; message: string }
      message?: string
    }
    return {
      success: false,
      error: errJson.error ?? {
        code: 'SERVER_ERROR',
        message: errJson.message ?? `Server error: ${res.status}`,
      },
    }
  }

  const envelope = json as { success?: boolean; data?: { id?: string } }
  const id = envelope.data?.id
  if (id) {
    return { success: true, data: { id } }
  }

  return {
    success: false,
    error: { code: 'MISSING_DATA', message: 'No graphic ID returned' },
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
