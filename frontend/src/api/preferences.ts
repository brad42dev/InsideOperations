/**
 * preferences — thin client for /api/user/preferences
 *
 * The backend stores a single JSONB blob per user.  Any key set via PATCH is
 * merge-applied (jsonb || operator), so callers can safely write individual
 * keys without stomping other keys.
 *
 * Spec: process-implementation-spec.md §10.6 (minimap / sidebar state persisted
 * in user preferences), §API table row for PATCH /api/user/preferences.
 */

import { api } from './client'

export interface UserPreferences {
  /** Minimap visibility in the main Process view (true = visible) */
  process_minimap_visible?: boolean
  /** Sidebar visibility in the main Process view */
  process_sidebar_visible?: boolean
  /** Sidebar width (px) in the main Process view */
  process_sidebar_width?: number
  // Extend with other module preference keys as needed
  [key: string]: unknown
}

export const preferencesApi = {
  /** Fetch the current user's full preferences object. */
  get(): Promise<import('./client').ApiResult<UserPreferences>> {
    return api.get<UserPreferences>('/api/user/preferences')
  },

  /**
   * Merge-patch user preferences.  Only the keys provided are updated;
   * all other keys are left unchanged (uses jsonb || on the backend).
   */
  patch(prefs: Partial<UserPreferences>): Promise<import('./client').ApiResult<UserPreferences>> {
    return api.patch<UserPreferences>('/api/user/preferences', { preferences: prefs })
  },
}
