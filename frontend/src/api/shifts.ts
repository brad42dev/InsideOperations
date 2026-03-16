import { api, queryString } from './client'
import type { ApiResult } from './client'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ShiftPattern {
  id: string
  name: string
  pattern_type: string
  description: string | null
  config: Record<string, unknown>
  created_at: string
  created_by: string | null
}

export interface ShiftCrew {
  id: string
  name: string
  description: string | null
  color: string
  created_at: string
  created_by: string | null
  member_count: number | null
}

export interface ShiftCrewMember {
  id: string
  crew_id: string
  user_id: string
  display_name: string | null
  email: string | null
  role_label: string | null
  added_at: string
}

export interface ShiftCrewDetail {
  crew: ShiftCrew
  members: ShiftCrewMember[]
}

export interface ShiftAssignment {
  id: string
  shift_id: string
  user_id: string
  display_name: string | null
  email: string | null
  role_label: string | null
  source: string
  created_at: string
}

export interface Shift {
  id: string
  name: string
  crew_id: string | null
  crew_name: string | null
  pattern_id: string | null
  start_time: string
  end_time: string
  handover_minutes: number
  notes: string | null
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  created_at: string
  created_by: string | null
}

export interface ShiftDetail {
  shift: Shift
  assignments: ShiftAssignment[]
}

export interface PresenceStatus {
  user_id: string
  display_name: string | null
  email: string | null
  employee_id: string | null
  on_site: boolean
  last_seen_at: string | null
  last_area: string | null
  last_door: string | null
  stale_at: string | null
  on_shift: boolean
  current_shift_id: string | null
  updated_at: string
}

export interface MusterPoint {
  id: string
  name: string
  description: string | null
  area: string | null
  capacity: number | null
  latitude: number | null
  longitude: number | null
  door_ids: string[]
  enabled: boolean
  created_at: string
  created_by: string | null
}

export interface MusterEvent {
  id: string
  trigger_type: string
  trigger_ref_id: string | null
  declared_by: string
  declared_by_name: string | null
  declared_at: string
  resolved_by: string | null
  resolved_at: string | null
  total_on_site: number | null
  notes: string | null
  status: 'active' | 'resolved'
  accounting_total: number | null
  accounting_accounted: number | null
}

export interface MusterAccounting {
  id: string
  muster_event_id: string
  user_id: string
  display_name: string | null
  email: string | null
  muster_point_id: string | null
  muster_point_name: string | null
  status: 'unaccounted' | 'accounted_badge' | 'accounted_manual' | 'off_site' | 'stale'
  accounted_at: string | null
  accounted_by: string | null
  notes: string | null
}

export interface MusterEventDetail {
  event: MusterEvent
  accounting: MusterAccounting[]
}

export interface BadgeSource {
  id: string
  name: string
  adapter_type: string
  enabled: boolean
  config: Record<string, unknown>
  poll_interval_s: number
  last_poll_at: string | null
  last_poll_ok: boolean | null
  last_error: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

export interface CreateShiftPayload {
  name: string
  crew_id?: string
  pattern_id?: string
  start_time: string
  end_time: string
  handover_minutes?: number
  notes?: string
}

export interface UpdateShiftPayload {
  name?: string
  crew_id?: string
  pattern_id?: string
  start_time?: string
  end_time?: string
  handover_minutes?: number
  notes?: string
  status?: string
}

export interface CreateCrewPayload {
  name: string
  description?: string
  color?: string
}

export interface UpdateCrewPayload {
  name?: string
  description?: string
  color?: string
}

export interface AddCrewMemberPayload {
  user_id: string
  role_label?: string
}

export interface CreateMusterPointPayload {
  name: string
  description?: string
  area?: string
  capacity?: number
  latitude?: number
  longitude?: number
  door_ids?: string[]
}

export interface DeclareMusterPayload {
  notes?: string
  trigger_type?: string
  trigger_ref_id?: string
}

export interface ResolveMusterPayload {
  notes?: string
}

export interface AccountPersonPayload {
  user_id: string
  status: string
  muster_point_id?: string
  notes?: string
}

export interface CreateBadgeSourcePayload {
  name: string
  adapter_type: string
  enabled?: boolean
  config?: Record<string, unknown>
  poll_interval_s?: number
}

export interface UpdateBadgeSourcePayload {
  name?: string
  adapter_type?: string
  enabled?: boolean
  config?: Record<string, unknown>
  poll_interval_s?: number
}

// ---------------------------------------------------------------------------
// API object
// ---------------------------------------------------------------------------

export const shiftsApi = {
  // --- Shift patterns ---
  listPatterns(): Promise<ApiResult<ShiftPattern[]>> {
    return api.get('/api/shifts/patterns')
  },

  // --- Shift crews ---
  listCrews(): Promise<ApiResult<ShiftCrew[]>> {
    return api.get('/api/shifts/crews')
  },
  createCrew(payload: CreateCrewPayload): Promise<ApiResult<ShiftCrew>> {
    return api.post('/api/shifts/crews', payload)
  },
  getCrew(id: string): Promise<ApiResult<ShiftCrewDetail>> {
    return api.get(`/api/shifts/crews/${id}`)
  },
  updateCrew(id: string, payload: UpdateCrewPayload): Promise<ApiResult<ShiftCrew>> {
    return api.put(`/api/shifts/crews/${id}`, payload)
  },
  deleteCrew(id: string): Promise<ApiResult<{ deleted: boolean }>> {
    return api.delete(`/api/shifts/crews/${id}`)
  },
  addCrewMember(crewId: string, payload: AddCrewMemberPayload): Promise<ApiResult<ShiftCrewMember>> {
    return api.post(`/api/shifts/crews/${crewId}/members`, payload)
  },
  removeCrewMember(crewId: string, userId: string): Promise<ApiResult<{ deleted: boolean }>> {
    return api.delete(`/api/shifts/crews/${crewId}/members/${userId}`)
  },

  // --- Shifts ---
  listShifts(params?: {
    from?: string
    to?: string
    status?: string
    crew_id?: string
  }): Promise<ApiResult<Shift[]>> {
    return api.get(`/api/shifts${queryString(params)}`)
  },
  createShift(payload: CreateShiftPayload): Promise<ApiResult<Shift>> {
    return api.post('/api/shifts', payload)
  },
  getShift(id: string): Promise<ApiResult<ShiftDetail>> {
    return api.get(`/api/shifts/${id}`)
  },
  updateShift(id: string, payload: UpdateShiftPayload): Promise<ApiResult<Shift>> {
    return api.put(`/api/shifts/${id}`, payload)
  },
  deleteShift(id: string): Promise<ApiResult<{ deleted: boolean }>> {
    return api.delete(`/api/shifts/${id}`)
  },

  // --- Presence ---
  listPresence(): Promise<ApiResult<PresenceStatus[]>> {
    return api.get('/api/presence')
  },
  getPresence(userId: string): Promise<ApiResult<PresenceStatus>> {
    return api.get(`/api/presence/${userId}`)
  },

  // --- Muster points ---
  listMusterPoints(): Promise<ApiResult<MusterPoint[]>> {
    return api.get('/api/muster/points')
  },
  createMusterPoint(payload: CreateMusterPointPayload): Promise<ApiResult<MusterPoint>> {
    return api.post('/api/muster/points', payload)
  },

  // --- Muster events ---
  listMusterEvents(params?: { status?: string }): Promise<ApiResult<MusterEvent[]>> {
    return api.get(`/api/muster/events${queryString(params)}`)
  },
  declareMusterEvent(payload: DeclareMusterPayload): Promise<ApiResult<MusterEvent>> {
    return api.post('/api/muster/events', payload)
  },
  getMusterEvent(id: string): Promise<ApiResult<MusterEventDetail>> {
    return api.get(`/api/muster/events/${id}`)
  },
  resolveMusterEvent(id: string, payload: ResolveMusterPayload): Promise<ApiResult<MusterEvent>> {
    return api.put(`/api/muster/events/${id}/resolve`, payload)
  },
  accountPerson(eventId: string, payload: AccountPersonPayload): Promise<ApiResult<MusterAccounting>> {
    return api.post(`/api/muster/events/${eventId}/account`, payload)
  },

  // --- Badge sources ---
  listBadgeSources(): Promise<ApiResult<BadgeSource[]>> {
    return api.get('/api/badge-sources')
  },
  createBadgeSource(payload: CreateBadgeSourcePayload): Promise<ApiResult<BadgeSource>> {
    return api.post('/api/badge-sources', payload)
  },
  updateBadgeSource(id: string, payload: UpdateBadgeSourcePayload): Promise<ApiResult<BadgeSource>> {
    return api.put(`/api/badge-sources/${id}`, payload)
  },
  deleteBadgeSource(id: string): Promise<ApiResult<{ deleted: boolean }>> {
    return api.delete(`/api/badge-sources/${id}`)
  },
}
