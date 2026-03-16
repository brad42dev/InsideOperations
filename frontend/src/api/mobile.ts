/**
 * mobile.ts — Typed API client for mobile-specific endpoints.
 *
 * These endpoints live under /api/mobile/ and are optimised for the PWA:
 * - Batch round sync for efficient offline queue drain
 * - Active rounds pre-cache (full detail for offline use)
 * - Presence heartbeat (periodic GPS + status reporting)
 * - Mobile config (sync/heartbeat intervals, GPS requirements)
 * - Lightweight health check (no auth, used for connectivity detection)
 */

import { api, type ApiResult } from './client'
import type { RoundInstanceDetail } from './rounds'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MobileConfig {
  sync_interval_ms: number
  heartbeat_interval_ms: number
  offline_cache_duration_mins: number
  gps_required: boolean
  min_touch_target_px: number
}

export interface MobileSyncPayload {
  checkpoint_index: number
  response_value: string
  notes?: string
  captured_at?: string
  gps_lat?: number
  gps_lon?: number
}

export interface BatchSyncResult {
  synced: number
  failed: number
  instance_id: string
  instance_status: string
}

export interface MobileHealthResult {
  ok: boolean
  ts: string
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const mobileApi = {
  /**
   * GET /api/mobile/config
   *
   * Returns mobile-specific PWA configuration (sync/heartbeat intervals,
   * GPS requirements, minimum touch target size).  Call once on startup and
   * cache the result in memory for the session.
   */
  async getConfig(): Promise<ApiResult<MobileConfig>> {
    return api.get<MobileConfig>('/api/mobile/config')
  },

  /**
   * GET /api/mobile/rounds/active
   *
   * Returns all round instances currently locked to the authenticated user
   * with status = 'in_progress', including full template + checkpoint data
   * and existing responses.  Use this to pre-populate the offline cache when
   * starting a round.
   */
  async getActiveRounds(): Promise<ApiResult<RoundInstanceDetail[]>> {
    return api.get<RoundInstanceDetail[]>('/api/mobile/rounds/active')
  },

  /**
   * POST /api/mobile/rounds/sync
   *
   * Batch submit pending checkpoint responses for a single round instance.
   * Far more efficient than one request per checkpoint on poor connections.
   *
   * @param instanceId  UUID of the round instance
   * @param responses   Array of pending checkpoint responses
   * @returns           Number of responses successfully synced + failed count
   */
  async syncRounds(
    instanceId: string,
    responses: MobileSyncPayload[],
  ): Promise<ApiResult<BatchSyncResult>> {
    return api.post<BatchSyncResult>('/api/mobile/rounds/sync', {
      instance_id: instanceId,
      responses,
    })
  },

  /**
   * POST /api/mobile/presence
   *
   * Update the authenticated user's presence / location.  Call this
   * periodically (every `heartbeat_interval_ms` from config) while the app
   * is in the foreground and the user is on-site.
   *
   * @param status          "on_site" | "off_site" | "active" | "online"
   * @param lat             GPS latitude (optional)
   * @param lon             GPS longitude (optional)
   * @param accuracyMeters  GPS accuracy in metres (optional)
   */
  async updatePresence(
    status: string,
    lat?: number,
    lon?: number,
    accuracyMeters?: number,
  ): Promise<ApiResult<{ acknowledged: boolean }>> {
    return api.post<{ acknowledged: boolean }>('/api/mobile/presence', {
      status,
      gps_lat: lat,
      gps_lon: lon,
      accuracy_meters: accuracyMeters,
    })
  },

  /**
   * GET /api/mobile/health
   *
   * Lightweight connectivity check — no auth required.  Use this to detect
   * whether the server is reachable before attempting authenticated requests.
   *
   * Note: This endpoint is public (no JWT required).  It uses a direct fetch
   * rather than the authenticated `api.get` helper so that it works before
   * the user logs in or when the token has expired.
   */
  async health(): Promise<MobileHealthResult | null> {
    try {
      const res = await fetch('/api/mobile/health')
      if (!res.ok) return null
      return (await res.json()) as MobileHealthResult
    } catch {
      return null
    }
  },
}
