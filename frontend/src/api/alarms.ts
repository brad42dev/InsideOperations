import { api, queryString, type ApiResult } from './client'

export type AlarmPriority = 'critical' | 'high' | 'medium' | 'advisory'

export interface AlarmEvent {
  id: string
  timestamp: string
  priority: AlarmPriority
  point_id: string
  message: string
}

// Shape returned by GET /api/alarms/history (paged, via PagedResponse)
interface AlarmHistoryItem {
  id: string
  event_id: string
  state: string
  previous_state: string | null
  transitioned_at: string
  transitioned_by: string | null
  comment: string | null
  metadata: Record<string, unknown> | null
}

function mapHistoryItem(item: AlarmHistoryItem): AlarmEvent {
  const priority =
    (item.metadata?.priority as AlarmPriority | undefined) ??
    (item.metadata?.alarm_priority as AlarmPriority | undefined) ??
    'advisory'
  const point_id =
    (item.metadata?.point_id as string | undefined) ?? ''
  const message =
    item.comment ??
    (item.metadata?.message as string | undefined) ??
    item.state
  return {
    id: item.id,
    timestamp: item.transitioned_at,
    priority,
    point_id,
    message,
  }
}

export const alarmsApi = {
  /**
   * Fetch alarm history within a time window.
   * Used by HistoricalPlaybackBar to render alarm markers on the scrub timeline.
   * Backend params: from / to (not start / end).
   * Backend returns a PagedResponse; the api client wraps it as { data, pagination }.
   */
  getEvents: async (params: {
    start: string
    end: string
    limit?: number
  }): Promise<ApiResult<AlarmEvent[]>> => {
    const result = await api.get<{ data: AlarmHistoryItem[] }>(
      `/api/alarms/history${queryString({
        from: params.start,
        to: params.end,
        per_page: params.limit ?? 500,
      })}`,
    )
    if (!result.success) return result
    const items: AlarmHistoryItem[] = Array.isArray(result.data)
      ? (result.data as unknown as AlarmHistoryItem[])
      : (result.data?.data ?? [])
    return { success: true, data: items.map(mapHistoryItem) }
  },
}
