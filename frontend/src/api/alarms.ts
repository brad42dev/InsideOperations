import { api, queryString, type ApiResult } from './client'

export type AlarmPriority = 'critical' | 'high' | 'medium' | 'advisory'

export interface AlarmEvent {
  id: string
  timestamp: string
  priority: AlarmPriority
  point_id: string
  message: string
}

export const alarmsApi = {
  /**
   * Fetch alarm events within a time window.
   * Used by HistoricalPlaybackBar to render alarm markers on the scrub timeline.
   */
  getEvents: (params: {
    start: string
    end: string
    limit?: number
  }): Promise<ApiResult<AlarmEvent[]>> =>
    api.get<AlarmEvent[]>(
      `/api/v1/alarms/events${queryString({ ...params, limit: params.limit ?? 500 })}`,
    ),
}
